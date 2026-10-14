import type { Context } from 'hono';
import type { GatewayConfig } from './config.js';
import { metrics, SingleFlight, TtlCache } from './cache.js';
import { cacheScope, sha256 } from './auth.js';
import { pooledFetch } from './http.js';

interface StoredResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
  etag: string;
}

let responseCache: TtlCache<StoredResponse> | null = null;
const flights = new SingleFlight();

function cacheFor(config: GatewayConfig): TtlCache<StoredResponse> {
  if (!responseCache) responseCache = new TtlCache<StoredResponse>(config.cacheMaxEntries);
  return responseCache;
}

class Passthrough extends Error {
  constructor(
    readonly status: number,
    readonly contentType: string,
    readonly body: Uint8Array
  ) {
    super('passthrough');
  }
}

const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
]);

const CACHEABLE = [
  /^\/api\/frames\/?$/,
  /^\/api\/frames\/(?!ai-agent(?:\/|$))[^/]+\/?$/,
  /^\/api\/events\/?$/,
  /^\/api\/events\/[^/]+\/?$/,
];

export function proxyInflight(): number {
  return flights.size;
}

export function responseCacheSize(): number {
  return responseCache?.size ?? 0;
}

export function purgeResponseCache(): number {
  if (!responseCache) return 0;
  const size = responseCache.size;
  responseCache.clear();
  return size;
}

function ttlFor(config: GatewayConfig, pathname: string): number {
  if (pathname.startsWith('/api/frames')) return config.cacheFramesTtlMs;
  if (pathname.startsWith('/api/events')) return config.cacheEventsTtlMs;
  return config.cacheDefaultTtlMs;
}

function isCacheableGet(method: string, pathname: string): boolean {
  return method === 'GET' && CACHEABLE.some((pattern) => pattern.test(pathname));
}

function cacheKey(c: Context, pathname: string, search: string): string {
  return `up:${pathname}${search}:${cacheScope(c)}`;
}

function toResponse(stored: StoredResponse, cacheState: string, requestEtag: string | undefined): Response {
  if (requestEtag && requestEtag === stored.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: stored.etag,
        'X-Cache': cacheState,
      },
    });
  }
  return new Response(stored.body as unknown as BodyInit, {
    status: stored.status,
    headers: {
      'Content-Type': stored.contentType,
      ETag: stored.etag,
      'X-Cache': cacheState,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}

async function forward(c: Context, config: GatewayConfig, target: URL): Promise<Response> {
  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (!HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('x-forwarded-host', c.req.header('host') || '');
  headers.set('x-forwarded-proto', 'http');
  const method = c.req.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const response = await pooledFetch(config, target.toString(), {
    method,
    headers,
    body: hasBody ? c.req.raw.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal: AbortSignal.timeout(config.upstreamTimeoutMs),
  });

  const outHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_HEADERS.has(lower) || lower.startsWith('access-control-')) return;
    outHeaders.set(key, value);
  });
  outHeaders.set('X-Cache', 'BYPASS');
  return new Response(response.body, { status: response.status, headers: outHeaders });
}

function snapshotHeaders(c: Context): Headers {
  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (!HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function loadUpstream(config: GatewayConfig, target: URL, headers: Headers): Promise<StoredResponse> {
  const response = await pooledFetch(config, target.toString(), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(config.upstreamTimeoutMs),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok || bytes.byteLength > config.cacheMaxBodyBytes || response.headers.get('set-cookie')) {
    throw new Passthrough(response.status, response.headers.get('content-type') || 'application/json', bytes);
  }
  return {
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    body: bytes,
    etag: `"${sha256(bytes).slice(0, 16)}"`,
  };
}

function passthroughResponse(error: Passthrough): Response {
  return new Response(error.body as unknown as BodyInit, {
    status: error.status,
    headers: {
      'Content-Type': error.contentType,
      'X-Cache': error.status >= 500 ? 'MISS' : 'BYPASS',
    },
  });
}

export async function proxyUpstream(c: Context, config: GatewayConfig): Promise<Response> {
  if (!config.upstreamOrigin) {
    return c.json({ error: 'UPSTREAM_ORIGIN is not configured', code: 'NO_UPSTREAM' }, 503);
  }

  const length = Number(c.req.header('content-length') || 0);
  if (length > 25 * 1024 * 1024) {
    return c.json({ error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  const url = new URL(c.req.url);
  const target = new URL(`${url.pathname}${url.search}`, config.upstreamOrigin);
  const pathname = url.pathname;

  if (!isCacheableGet(c.req.method, pathname)) {
    metrics.bypass += 1;
    try {
      return await forward(c, config, target);
    } catch (error) {
      metrics.upstreamErrors += 1;
      const message = error instanceof Error ? error.message : 'upstream failed';
      return c.json({ error: 'Upstream request failed', detail: message, code: 'BAD_GATEWAY' }, 502);
    }
  }

  const key = cacheKey(c, pathname, url.search);
  const ttl = ttlFor(config, pathname);
  const store = cacheFor(config);
  const headers = snapshotHeaders(c);
  const hit = store.get(key);
  if (hit?.state === 'fresh') {
    metrics.hits += 1;
    return toResponse(hit.value, 'HIT', c.req.header('if-none-match'));
  }
  if (hit?.state === 'stale') {
    metrics.stale += 1;
    void flights.do(`revalidate:${key}`, async () => {
      try {
        const fresh = await loadUpstream(config, target, headers);
        store.set(key, fresh, ttl, config.cacheSwrMs);
      } catch (error) {
        if (!(error instanceof Passthrough)) metrics.upstreamErrors += 1;
      }
    }).catch(() => undefined);
    return toResponse(hit.value, 'STALE', c.req.header('if-none-match'));
  }

  try {
    const stored = await flights.do(key, async () => {
      const fresh = await loadUpstream(config, target, headers);
      store.set(key, fresh, ttl, config.cacheSwrMs);
      return fresh;
    }, () => {
      metrics.coalesced += 1;
    });
    metrics.misses += 1;
    return toResponse(stored, 'MISS', c.req.header('if-none-match'));
  } catch (error) {
    if (error instanceof Passthrough) {
      if (error.status >= 500) metrics.negative += 1;
      return passthroughResponse(error);
    }
    metrics.upstreamErrors += 1;
    return c.json({ error: 'Upstream request failed', code: 'BAD_GATEWAY' }, 502);
  }
}
