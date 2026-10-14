import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { metrics } from './cache.js';
import type { GatewayConfig } from './config.js';
import { authenticate, clientIp } from './auth.js';
import { aiCacheSize, aiInflight, completeChat, generateFrames, purgeAiCache, readUsage, type ChatInput, type GenerateInput } from './ai/generate.js';
import { proxyInflight, proxyUpstream, purgeResponseCache, responseCacheSize } from './proxy.js';

const startedAt = Date.now();
const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(c: Context, config: GatewayConfig, ip: string) {
  const ai = c.req.path.startsWith('/v1/') || c.req.path.includes('ai-agent');
  if (c.req.path === '/health' || c.req.path === '/ready' || c.req.path === '/') return null;
  const max = ai ? config.aiRateLimitMax : config.rateLimitMax;
  const key = `${ai ? 'ai' : 'api'}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + config.rateLimitWindowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [id, value] of buckets) {
      if (now >= value.reset) buckets.delete(id);
    }
  }
  if (bucket.count > max) {
    const retry = Math.max(1, Math.ceil((bucket.reset - now) / 1000));
    return c.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      429,
      { 'Retry-After': String(retry) }
    );
  }
  return null;
}

async function readBody(c: Context): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.length > 64_000) {
    const error = new Error('Request body is too large') as Error & { status: number };
    error.status = 413;
    throw error;
  }
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object');
  }
  return parsed as Record<string, unknown>;
}

function httpError(error: unknown): { status: number; message: string; code: string; usage?: unknown } {
  const err = error as { status?: number; message?: string; code?: string; usage?: unknown };
  const message = err.message || 'Request failed';
  if (err.status === 429) return { status: 429, message, code: err.code || 'DAILY_LIMIT_EXCEEDED', usage: err.usage };
  if (err.status === 413 || /too large|json|invalid|not allowed|disabled|requires|no credentials|no .+api key/i.test(message)) {
    return { status: err.status === 413 ? 413 : 400, message, code: 'BAD_REQUEST' };
  }
  return { status: 502, message, code: 'UPSTREAM_ERROR' };
}

export function createApp(config: GatewayConfig) {
  const app = new Hono();

  app.use('*', secureHeaders({
    crossOriginResourcePolicy: 'cross-origin',
  }));
  app.use('*', cors({
    origin: config.corsOrigins === '*' ? '*' : config.corsOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-api-token', 'apikey', 'Idempotency-Key', 'Range'],
    exposeHeaders: ['X-Cache', 'X-Request-Id', 'X-Response-Time', 'ETag', 'Retry-After'],
    maxAge: 86400,
  }));

  app.use('*', async (c, next) => {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    c.set('requestId' as never, requestId);
    c.header('X-Request-Id', requestId);
    const limited = rateLimit(c, config, clientIp(c, config.trustProxy));
    if (limited) return limited;
    await next();
    c.res.headers.set('X-Request-Id', requestId);
    c.res.headers.set('X-Response-Time', `${Date.now() - started}ms`);
    if (c.req.path !== '/health') {
      console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - started}ms ${c.res.headers.get('X-Cache') || '-'}`);
    }
  });

  app.get('/', (c) => c.json({
    service: 'photobooth-gateway',
    routes: {
      health: 'GET /health',
      ready: 'GET /ready',
      generate: 'POST /v1/generate',
      usage: 'GET /v1/generate',
      chat: 'POST /v1/ai/chat',
      framesAlias: 'GET|POST /api/frames/ai-agent',
      proxy: 'ALL /api/*',
      cache: 'GET|DELETE /v1/cache',
    },
  }));

  app.get('/health', (c) => c.json({
    ok: true,
    service: 'photobooth-gateway',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    cache: {
      upstreamEntries: responseCacheSize(),
      aiEntries: aiCacheSize(),
    },
    metrics,
  }));

  app.get('/ready', async (c) => {
    if (!config.upstreamOrigin) {
      return c.json({ ok: true, upstream: 'disabled' });
    }
    try {
      const response = await fetch(config.upstreamOrigin, { signal: AbortSignal.timeout(3000), method: 'HEAD' });
      return c.json({ ok: response.status < 500, upstream: response.status });
    } catch {
      return c.json({ ok: false, upstream: 'unreachable' }, 503);
    }
  });

  const generate = async (c: Context) => {
    if (c.req.method === 'GET') {
      const user = await authenticate(c, config);
      return c.json(readUsage(config, user));
    }

    const user = await authenticate(c, config);
    if (!user) {
      return c.json({
        error: 'Authentication required. Please sign in to use the AI Frame Designer.',
        code: 'UNAUTHORIZED',
      }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await readBody(c);
    } catch (error) {
      const parsed = httpError(error instanceof SyntaxError ? new Error('Invalid JSON') : error);
      return c.json({ error: parsed.message, code: parsed.code }, parsed.status as 400);
    }

    const prompt = String(body.prompt || '').trim();
    if (!prompt) return c.json({ error: 'prompt is required', code: 'BAD_REQUEST' }, 400);
    if (prompt.length > 4000) return c.json({ error: 'prompt is too long', code: 'BAD_REQUEST' }, 400);

    const input: GenerateInput = {
      prompt,
      count: Math.max(1, Math.min(Number(body.count) || 3, 3)),
      provider: body.provider ? String(body.provider) : 'auto',
      apiKey: body.apiKey ? String(body.apiKey) : undefined,
      model: body.model ? String(body.model) : undefined,
      baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
      currentFrame: body.currentFrame,
      chatHistory: Array.isArray(body.chatHistory)
        ? body.chatHistory.slice(-6).map((turn) => {
          const item = turn as { role?: string; content?: string };
          return { role: String(item.role || 'user'), content: String(item.content || '').slice(0, 500) };
        })
        : undefined,
      idempotencyKey: c.req.header('idempotency-key') || c.req.header('x-idempotency-key') || undefined,
    };

    try {
      const generated = await generateFrames(config, user, input);
      c.header('X-Cache', generated.cache);
      c.header('Cache-Control', 'private, no-store');
      return c.json({
        ...generated.result,
        usage: generated.usage,
      });
    } catch (error) {
      const parsed = httpError(error);
      return c.json({ error: parsed.message, code: parsed.code, usage: parsed.usage }, parsed.status as 400);
    }
  };

  app.get('/v1/generate', generate);
  app.post('/v1/generate', generate);
  app.get('/api/frames/ai-agent', generate);
  app.post('/api/frames/ai-agent', generate);

  app.post('/v1/ai/chat', async (c) => {
    const user = await authenticate(c, config);
    if (!user) return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401);

    let body: Record<string, unknown>;
    try {
      body = await readBody(c);
    } catch (error) {
      const parsed = httpError(error instanceof SyntaxError ? new Error('Invalid JSON') : error);
      return c.json({ error: parsed.message, code: parsed.code }, parsed.status as 400);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 20) {
      return c.json({ error: 'messages must contain 1 to 20 items', code: 'BAD_REQUEST' }, 400);
    }
    const normalized = [];
    for (const message of messages) {
      const item = message as { role?: string; content?: string };
      const role = String(item.role || '');
      const content = String(item.content || '');
      if (!['system', 'user', 'assistant'].includes(role) || !content || content.length > 8000) {
        return c.json({ error: 'Each message needs role system|user|assistant and content up to 8000 characters', code: 'BAD_REQUEST' }, 400);
      }
      normalized.push({ role, content });
    }

    const input: ChatInput = {
      provider: body.provider ? String(body.provider) : 'auto',
      model: body.model ? String(body.model) : undefined,
      baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
      apiKey: body.apiKey ? String(body.apiKey) : undefined,
      messages: normalized,
      temperature: body.temperature === undefined ? undefined : Number(body.temperature),
      stream: body.stream === true,
      cache: body.cache !== false,
    };

    try {
      const result = await completeChat(config, user, input);
      if (result.streamed) {
        const headers = new Headers();
        headers.set('Content-Type', result.contentType);
        headers.set('X-Cache', 'BYPASS');
        headers.set('Cache-Control', 'no-store');
        return new Response(result.streamed.body, { status: result.streamed.status, headers });
      }
      c.header('X-Cache', result.cache);
      c.header('Cache-Control', 'private, no-store');
      return new Response(result.body, {
        status: 200,
        headers: { 'Content-Type': result.contentType, 'X-Cache': result.cache },
      });
    } catch (error) {
      const parsed = httpError(error);
      return c.json({ error: parsed.message, code: parsed.code }, parsed.status as 400);
    }
  });

  app.get('/v1/cache', async (c) => {
    const user = await authenticate(c, config);
    if (!user?.isAdmin) return c.json({ error: 'Admin access required', code: 'FORBIDDEN' }, 403);
    return c.json({
      upstreamEntries: responseCacheSize(),
      aiEntries: aiCacheSize(),
      inflight: aiInflight() + proxyInflight(),
      metrics,
    });
  });

  app.delete('/v1/cache', async (c) => {
    const user = await authenticate(c, config);
    if (!user?.isAdmin) return c.json({ error: 'Admin access required', code: 'FORBIDDEN' }, 403);
    const prefix = c.req.query('prefix') || '';
    return c.json({
      clearedUpstream: prefix ? 0 : purgeResponseCache(),
      clearedAi: purgeAiCache(prefix),
    });
  });

  app.all('/api/*', (c) => proxyUpstream(c, config));

  app.notFound((c) => c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404));

  return app;
}
