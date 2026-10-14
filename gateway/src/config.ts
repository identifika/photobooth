export interface GatewayConfig {
  port: number;
  host: string;
  corsOrigins: string[] | '*';
  trustProxy: boolean;
  upstreamOrigin: string;
  upstreamTimeoutMs: number;
  httpConnections: number;
  httpKeepAliveMs: number;
  cacheMaxEntries: number;
  cacheDefaultTtlMs: number;
  cacheFramesTtlMs: number;
  cacheEventsTtlMs: number;
  cacheAiTtlMs: number;
  cacheSwrMs: number;
  cacheMaxBodyBytes: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  aiRateLimitMax: number;
  masterKeys: string[];
  adminEmails: string[];
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  openaiApiKey: string;
  openaiModel: string;
  aiDailyLimit: number;
  aiTimeoutMs: number;
  allowClientAiKeys: boolean;
  allowLocalAi: boolean;
  databaseUrl: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

function listEnv(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function loadConfig(): GatewayConfig {
  const corsRaw = (process.env.CORS_ORIGIN || '*').trim();
  const masterKeys = [
    process.env.GATEWAY_API_KEY,
    process.env.PIKABOOTH_API_KEY,
    process.env.API_SECRET_KEY,
    process.env.ADMIN_API_KEY,
  ]
    .map((key) => (key || '').trim())
    .filter(Boolean);

  return {
    port: intEnv('PORT', 8788),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: corsRaw === '*' ? '*' : corsRaw.split(',').map((origin) => origin.trim()).filter(Boolean),
    trustProxy: boolEnv('TRUST_PROXY', true),
    upstreamOrigin: (process.env.UPSTREAM_ORIGIN || '').replace(/\/$/, ''),
    upstreamTimeoutMs: intEnv('UPSTREAM_TIMEOUT_MS', 20_000),
    httpConnections: intEnv('HTTP_CONNECTIONS', 64),
    httpKeepAliveMs: intEnv('HTTP_KEEPALIVE_MS', 30_000),
    cacheMaxEntries: intEnv('CACHE_MAX_ENTRIES', 2000),
    cacheDefaultTtlMs: intEnv('CACHE_DEFAULT_TTL_MS', 30_000),
    cacheFramesTtlMs: intEnv('CACHE_FRAMES_TTL_MS', 60_000),
    cacheEventsTtlMs: intEnv('CACHE_EVENTS_TTL_MS', 15_000),
    cacheAiTtlMs: intEnv('CACHE_AI_TTL_MS', 600_000),
    cacheSwrMs: intEnv('CACHE_SWR_MS', 15_000),
    cacheMaxBodyBytes: intEnv('CACHE_MAX_BODY_BYTES', 1_048_576),
    rateLimitWindowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMax: intEnv('RATE_LIMIT_MAX', 120),
    aiRateLimitMax: intEnv('AI_RATE_LIMIT_MAX', 20),
    masterKeys,
    adminEmails: listEnv('ADMIN_EMAILS').map((email) => email.toLowerCase()),
    aiProvider: (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
    aiApiKey: (process.env.AI_API_KEY || '').trim(),
    aiModel: (process.env.AI_MODEL || '').trim(),
    aiBaseUrl: (process.env.AI_BASE_URL || '').trim(),
    geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
    geminiModel: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    groqApiKey: (process.env.GROQ_API_KEY || '').trim(),
    groqModel: (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
    openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
    openaiModel: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
    aiDailyLimit: intEnv('AI_DAILY_LIMIT', 3),
    aiTimeoutMs: intEnv('AI_TIMEOUT_MS', 45_000),
    allowClientAiKeys: boolEnv('ALLOW_CLIENT_AI_KEYS', true),
    allowLocalAi: boolEnv('ALLOW_LOCAL_AI', true),
    databaseUrl: (process.env.DATABASE_URL || '').trim(),
  };
}
