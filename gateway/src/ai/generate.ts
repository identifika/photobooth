import type { GatewayConfig } from '../config.js';
import { metrics, SingleFlight, TtlCache } from '../cache.js';
import { sha256, type AuthUser } from '../auth.js';
import { pooledFetch } from '../http.js';
import { getDbDailyUsage, incrementDbDailyUsage, decrementDbDailyUsage, getDbStudioSettings } from '../db.js';
import {
  buildUserInstruction,
  generateAlgorithmicFrames,
  sanitizeCandidate,
  SYSTEM_PROMPT,
  type GeneratedFrames,
} from './frames.js';

export interface GenerateInput {
  prompt: string;
  count: number;
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  currentFrame?: unknown;
  chatHistory?: Array<{ role: string; content: string }>;
  idempotencyKey?: string;
}

export interface UsageStatus {
  authenticated: boolean;
  isAdmin: boolean;
  usedToday: number;
  maxDaily: number | null;
  remainingToday: number | null;
}

interface ProviderCall {
  name: string;
  model: string;
  run: () => Promise<GeneratedFrames>;
}

const usage = new Map<string, number>();
const breakers = new Map<string, { failures: number; openUntil: number }>();

function todayKey(uid: string): string {
  return `${uid}:${new Date().toISOString().slice(0, 10)}`;
}

export async function readUsage(config: GatewayConfig, user: AuthUser | null): Promise<UsageStatus> {
  const dbSettings = config.databaseUrl ? await getDbStudioSettings(config.databaseUrl) : null;
  const effectiveLimit = typeof dbSettings?.aiDailyLimit === 'number' ? dbSettings.aiDailyLimit : config.aiDailyLimit;

  if (!user) {
    return {
      authenticated: false,
      isAdmin: false,
      usedToday: 0,
      maxDaily: effectiveLimit,
      remainingToday: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  let usedToday = usage.get(todayKey(user.uid)) || 0;

  if (config.databaseUrl) {
    const dbCount = await getDbDailyUsage(config.databaseUrl, user.uid, today);
    if (dbCount !== null) {
      usedToday = dbCount;
    }
  }

  if (user.isAdmin) {
    return { authenticated: true, isAdmin: true, usedToday, maxDaily: null, remainingToday: null };
  }
  return {
    authenticated: true,
    isAdmin: false,
    usedToday,
    maxDaily: effectiveLimit,
    remainingToday: Math.max(0, effectiveLimit - usedToday),
  };
}

function bumpUsage(uid: string): number {
  const key = todayKey(uid);
  const next = (usage.get(key) || 0) + 1;
  usage.set(key, next);
  return next;
}

function breakerOpen(name: string): boolean {
  const state = breakers.get(name);
  return !!state && Date.now() < state.openUntil;
}

function breakerFail(name: string): void {
  const state = breakers.get(name) || { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= 3) {
    state.openUntil = Date.now() + 15_000;
    state.failures = 0;
  }
  breakers.set(name, state);
}

function breakerOk(name: string): void {
  breakers.delete(name);
}

export function redact(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/key=[^&\s]+/gi, 'key=[redacted]')
    .slice(0, 300);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Model did not return JSON');
  }
}

function fromParsed(parsed: unknown, count: number, fallbackMessage: string): Omit<GeneratedFrames, 'providerUsed'> {
  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : [parsed];
  const candidates = rawCandidates.slice(0, count).map((candidate, index) => sanitizeCandidate(candidate, index));
  return {
    message: String(record.message || fallbackMessage),
    candidates,
  };
}

function assertPublicBase(config: GatewayConfig, baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('AI base URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('AI base URL must be http or https');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'metadata.google.internal' || host === '169.254.169.254') {
    throw new Error('AI base URL is not allowed');
  }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  const privateNet = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  if ((local || privateNet) && !config.allowLocalAi) {
    throw new Error('Local AI base URLs are disabled');
  }
  return url;
}

async function callGemini(
  config: GatewayConfig,
  apiKey: string,
  model: string,
  instruction: string,
  count: number
): Promise<Omit<GeneratedFrames, 'providerUsed'>> {
  const response = await pooledFetch(
    config,
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs),
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini error (${response.status}): ${redact(await response.text())}`);
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return fromParsed(extractJson(text), count, `Here are ${count} frame designs.`);
}

async function callOpenAICompatible(
  config: GatewayConfig,
  endpoint: string,
  apiKey: string,
  model: string,
  instruction: string,
  count: number
): Promise<Omit<GeneratedFrames, 'providerUsed'>> {
  const response = await pooledFetch(config, endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: instruction },
      ],
    }),
    signal: AbortSignal.timeout(config.aiTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`AI error (${response.status}): ${redact(await response.text())}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from model');
  return fromParsed(extractJson(content), count, `Here are ${count} frame designs.`);
}

function providerChain(config: GatewayConfig, input: GenerateInput): { explicit: boolean; chain: ProviderCall[] } {
  const clientProvider = (input.provider || 'auto').toLowerCase();
  const explicit = clientProvider !== 'auto';
  const preferred = explicit ? clientProvider : (config.aiProvider || 'auto').toLowerCase();
  const clientKey = config.allowClientAiKeys ? (input.apiKey || '').trim() : '';
  const generalKey = clientKey || config.aiApiKey;
  const modelOverride = (input.model || '').trim() || config.aiModel;
  const baseUrl = (input.baseUrl || '').trim() || config.aiBaseUrl;
  const instruction = buildUserInstruction(input);
  const chain: ProviderCall[] = [];
  const keyFor = (name: string, specific: string): string => {
    const ownsGeneral = explicit ? preferred === name : preferred === 'auto' || preferred === name;
    return ownsGeneral ? generalKey || specific : specific;
  };

  const geminiKey = keyFor('gemini', config.geminiApiKey);
  const geminiModel = modelOverride || config.geminiModel;
  if (geminiKey && (!explicit || preferred === 'gemini')) {
    chain.push({
      name: 'gemini',
      model: geminiModel,
      run: () => callGemini(config, geminiKey, geminiModel, instruction, input.count).then((result) => ({
        ...result,
        providerUsed: `Google Gemini (${geminiModel})`,
      })),
    });
  }

  const groqKey = keyFor('groq', config.groqApiKey);
  const groqModel = modelOverride || config.groqModel;
  if (groqKey && (!explicit || preferred === 'groq')) {
    chain.push({
      name: 'groq',
      model: groqModel,
      run: () => callOpenAICompatible(
        config,
        'https://api.groq.com/openai/v1/chat/completions',
        groqKey,
        groqModel,
        instruction,
        input.count
      ).then((result) => ({ ...result, providerUsed: `Groq (${groqModel})` })),
    });
  }

  const openaiKey = keyFor('openai', config.openaiApiKey);
  const openaiModel = modelOverride || config.openaiModel;
  if (openaiKey && (!explicit || preferred === 'openai')) {
    const endpoint = baseUrl && preferred === 'openai'
      ? `${assertPublicBase(config, baseUrl).toString().replace(/\/$/, '')}/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';
    chain.push({
      name: 'openai',
      model: openaiModel,
      run: () => callOpenAICompatible(config, endpoint, openaiKey, openaiModel, instruction, input.count).then((result) => ({
        ...result,
        providerUsed: `OpenAI (${openaiModel})`,
      })),
    });
  }

  if (preferred === 'custom' || (!explicit && baseUrl)) {
    try {
      const endpointBase = baseUrl || 'http://127.0.0.1:11434/v1';
      const endpoint = `${assertPublicBase(config, endpointBase).toString().replace(/\/$/, '')}/chat/completions`;
      const customModel = modelOverride || 'llama3';
      chain.push({
        name: 'custom',
        model: customModel,
        run: () => callOpenAICompatible(config, endpoint, generalKey || 'local', customModel, instruction, input.count).then((result) => ({
          ...result,
          providerUsed: `Custom (${customModel})`,
        })),
      });
    } catch (error) {
      if (explicit) throw error;
    }
  }

  if (explicit) {
    const only = chain.filter((provider) => provider.name === preferred);
    if (only.length === 0) {
      throw new Error(`No credentials configured for provider "${preferred}"`);
    }
    return { explicit: true, chain: only };
  }

  if (preferred !== 'auto') {
    chain.sort((a, b) => Number(b.name === preferred) - Number(a.name === preferred));
  }
  return { explicit: false, chain };
}

async function generateUncached(config: GatewayConfig, input: GenerateInput): Promise<GeneratedFrames> {
  const { explicit, chain } = providerChain(config, input);
  let lastError = '';

  for (const provider of chain) {
    if (!explicit && breakerOpen(provider.name)) continue;
    metrics.aiProviderCalls += 1;
    try {
      const result = await provider.run();
      breakerOk(provider.name);
      if (result.candidates.length > 0) return result;
      lastError = `${provider.name} returned no candidates`;
    } catch (error) {
      breakerFail(provider.name);
      lastError = error instanceof Error ? error.message : 'provider failed';
      if (explicit) throw error;
    }
  }

  const candidates = generateAlgorithmicFrames(input.prompt, input.count);
  return {
    message: lastError
      ? `The model was unavailable, so I designed ${candidates.length} frames for "${input.prompt.slice(0, 80)}" with the built-in engine.`
      : `I designed ${candidates.length} photobooth frames for "${input.prompt.slice(0, 80)}".`,
    candidates,
    providerUsed: 'Smart Frame Engine',
  };
}

const aiCache = new TtlCache<GeneratedFrames>(500);
const aiFlight = new SingleFlight();

export function aiCacheSize(): number {
  return aiCache.size;
}

export function aiInflight(): number {
  return aiFlight.size + chatFlight.size;
}

export function purgeAiCache(prefix = ''): number {
  if (!prefix) {
    const size = aiCache.size;
    aiCache.clear();
    return size;
  }
  return aiCache.deletePrefix(prefix);
}

function generationCacheKey(user: AuthUser, input: GenerateInput): string {
  if (input.idempotencyKey) return `ai:idem:${user.uid}:${sha256(input.idempotencyKey)}`;
  const clientKey = input.apiKey ? sha256(input.apiKey).slice(0, 12) : 'server';
  const fingerprint = sha256(JSON.stringify({
    prompt: input.prompt.trim().toLowerCase(),
    count: input.count,
    provider: input.provider || 'auto',
    model: input.model || '',
    baseUrl: input.baseUrl || '',
    history: input.chatHistory || [],
    frame: input.currentFrame || null,
    clientKey,
  }));
  return `ai:prompt:${fingerprint}`;
}

export async function generateFrames(
  config: GatewayConfig,
  user: AuthUser,
  input: GenerateInput
): Promise<{ result: GeneratedFrames; usage: UsageStatus; cache: 'HIT' | 'MISS' }> {
  const dbSettings = config.databaseUrl ? await getDbStudioSettings(config.databaseUrl) : null;
  const effectiveConfig: GatewayConfig = dbSettings ? {
    ...config,
    aiProvider: dbSettings.aiProvider || config.aiProvider,
    aiModel: dbSettings.aiModel || config.aiModel,
    aiApiKey: dbSettings.aiApiKey || config.aiApiKey,
    aiBaseUrl: dbSettings.aiBaseUrl || config.aiBaseUrl,
    aiDailyLimit: typeof dbSettings.aiDailyLimit === 'number' ? dbSettings.aiDailyLimit : config.aiDailyLimit,
  } : config;

  const key = generationCacheKey(user, input);
  const cached = aiCache.get(key);
  if (cached?.state === 'fresh') {
    metrics.aiCacheHits += 1;
    return { result: cached.value, usage: await readUsage(effectiveConfig, user), cache: 'HIT' };
  }

  const limit = await readUsage(effectiveConfig, user);
  if (!user.isAdmin && (limit.remainingToday ?? 0) <= 0) {
    const error = new Error(`You have reached your daily limit of ${effectiveConfig.aiDailyLimit} AI frame prompts. Limit resets tomorrow.`) as Error & {
      status: number;
      code: string;
      usage: UsageStatus;
    };
    error.status = 429;
    error.code = 'DAILY_LIMIT_EXCEEDED';
    error.usage = limit;
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  let produced = false;
  const result = await aiFlight.do(key, async () => {
    if (!user.isAdmin) {
      const current = await readUsage(effectiveConfig, user);
      if ((current.usedToday ?? 0) >= effectiveConfig.aiDailyLimit) {
        const error = new Error(`You have reached your daily limit of ${effectiveConfig.aiDailyLimit} AI frame prompts. Limit resets tomorrow.`) as Error & {
          status: number;
          code: string;
          usage: UsageStatus;
        };
        error.status = 429;
        error.code = 'DAILY_LIMIT_EXCEEDED';
        error.usage = current;
        throw error;
      }

      if (effectiveConfig.databaseUrl) {
        await incrementDbDailyUsage(effectiveConfig.databaseUrl, user.uid, user.email || '', today, input.prompt);
      }
      bumpUsage(user.uid);
    }
    try {
      const generated = await generateUncached(effectiveConfig, input);
      aiCache.set(key, generated, input.idempotencyKey ? 60 * 60_000 : effectiveConfig.cacheAiTtlMs, effectiveConfig.cacheSwrMs);
      produced = true;
      return generated;
    } catch (error) {
      if (!user.isAdmin) {
        if (config.databaseUrl) {
          await decrementDbDailyUsage(config.databaseUrl, user.uid, today);
        }
        const slot = todayKey(user.uid);
        usage.set(slot, Math.max(0, (usage.get(slot) || 1) - 1));
      }
      throw error;
    }
  }, () => {
    metrics.coalesced += 1;
  });

  return { result, usage: await readUsage(config, user), cache: produced ? 'MISS' : 'HIT' };
}

export interface ChatInput {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  stream?: boolean;
  cache?: boolean;
}

function resolveChatProvider(config: GatewayConfig, input: ChatInput): string {
  const requested = (input.provider || 'auto').toLowerCase();
  if (requested !== 'auto') return requested;
  const configured = (config.aiProvider || 'auto').toLowerCase();
  if (configured !== 'auto') return configured;
  if (config.aiApiKey || config.geminiApiKey) return 'gemini';
  if (config.groqApiKey) return 'groq';
  if (config.openaiApiKey) return 'openai';
  if (input.baseUrl || config.aiBaseUrl) return 'custom';
  return 'gemini';
}

function chatEndpoint(config: GatewayConfig, input: ChatInput): { url: string; apiKey: string; model: string; kind: 'gemini' | 'openai' } {
  const provider = resolveChatProvider(config, input);
  const clientKey = config.allowClientAiKeys ? (input.apiKey || '').trim() : '';
  const generalKey = clientKey || config.aiApiKey;
  const model = (input.model || '').trim() || config.aiModel;

  if (provider === 'gemini') {
    const apiKey = generalKey || config.geminiApiKey;
    const geminiModel = model || config.geminiModel;
    if (!apiKey) throw new Error('No Gemini API key configured');
    return {
      kind: 'gemini',
      apiKey,
      model: geminiModel,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    };
  }

  if (provider === 'groq') {
    const apiKey = generalKey || config.groqApiKey;
    if (!apiKey) throw new Error('No Groq API key configured');
    return { kind: 'openai', apiKey, model: model || config.groqModel, url: 'https://api.groq.com/openai/v1/chat/completions' };
  }

  if (provider === 'custom') {
    const base = input.baseUrl || config.aiBaseUrl;
    if (!base) throw new Error('Custom provider requires baseUrl');
    const url = `${assertPublicBase(config, base).toString().replace(/\/$/, '')}/chat/completions`;
    return { kind: 'openai', apiKey: generalKey || 'local', model: model || 'llama3', url };
  }

  const apiKey = generalKey || config.openaiApiKey;
  if (!apiKey) throw new Error('No OpenAI API key configured');
  const base = input.baseUrl || config.aiBaseUrl;
  const url = base
    ? `${assertPublicBase(config, base).toString().replace(/\/$/, '')}/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';
  return { kind: 'openai', apiKey, model: model || config.openaiModel, url };
}

const chatCache = new TtlCache<string>(400);
const chatFlight = new SingleFlight();

export async function completeChat(
  config: GatewayConfig,
  user: AuthUser,
  input: ChatInput
): Promise<{ body: string; cache: 'HIT' | 'MISS' | 'BYPASS'; contentType: string; streamed?: Response }> {
  const target = chatEndpoint(config, input);
  if (input.stream) {
    if (target.kind === 'gemini') throw new Error('Streaming is available for OpenAI-compatible providers');
    metrics.bypass += 1;
    const response = await pooledFetch(config, target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify({
        model: target.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        stream: true,
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs),
    });
    return { body: '', cache: 'BYPASS', contentType: response.headers.get('content-type') || 'text/event-stream', streamed: response };
  }

  const cacheable = input.cache !== false;
  const key = `chat:${user.uid}:${sha256(JSON.stringify({ target: target.url, model: target.model, messages: input.messages, temperature: input.temperature ?? 0.7 }))}`;
  if (cacheable) {
    const hit = chatCache.get(key);
    if (hit?.state === 'fresh') {
      metrics.aiCacheHits += 1;
      return { body: hit.value, cache: 'HIT', contentType: 'application/json' };
    }
  }

  const body = await chatFlight.do(key, async () => {
    metrics.aiProviderCalls += 1;
    if (target.kind === 'gemini') {
      const contents = input.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(message.content || '') }],
        }));
      const system = input.messages.find((message) => message.role === 'system')?.content;
      const response = await pooledFetch(config, target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { temperature: input.temperature ?? 0.7 },
        }),
        signal: AbortSignal.timeout(config.aiTimeoutMs),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Gemini error (${response.status}): ${redact(text)}`);
      return text;
    }

    const response = await pooledFetch(config, target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify({
        model: target.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`AI error (${response.status}): ${redact(text)}`);
    return text;
  }, () => {
    metrics.coalesced += 1;
  });

  if (cacheable) chatCache.set(key, body, config.cacheAiTtlMs, 0);
  return { body, cache: 'MISS', contentType: 'application/json' };
}
