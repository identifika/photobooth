import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import type { GatewayConfig } from './config.js';
import { TtlCache } from './cache.js';
import { pooledFetch } from './http.js';

export interface AuthUser {
  uid: string;
  email?: string;
  isAdmin: boolean;
  via: 'firebase' | 'api-key';
}

const tokenCache = new TtlCache<{ uid: string; email?: string }>(1000);

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
    const realIp = c.req.header('x-real-ip');
    if (realIp) return realIp.trim();
  }
  return 'local';
}

function presentedKey(c: Context): string {
  const headerKey = c.req.header('x-api-key') || c.req.header('x-api-token') || c.req.header('apikey') || '';
  if (headerKey) return headerKey.trim();
  const auth = c.req.header('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  const token = auth.slice(7).trim();
  if (!token || token.includes('.')) return '';
  if (token.startsWith('pk_') || token.length > 20) return token;
  return '';
}

function bearerToken(c: Context): string {
  const auth = c.req.header('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  const token = auth.slice(7).trim();
  if (!token.includes('.')) return '';
  return token;
}

export function isAdminEmail(config: GatewayConfig, email?: string): boolean {
  if (!email) return false;
  return config.adminEmails.includes(email.toLowerCase());
}

async function lookupFirebaseUser(config: GatewayConfig, idToken: string): Promise<{ uid: string; email?: string } | null> {
  const cacheKey = `fb:${sha256(idToken)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached?.state === 'fresh') return cached.value;
  if (!config.firebaseApiKey) return cached?.value ?? null;

  const response = await pooledFetch(
    config,
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.firebaseApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { users?: Array<{ localId?: string; email?: string }> };
  const user = data.users?.[0];
  if (!user?.localId) return null;
  const verified = { uid: user.localId, email: user.email };
  tokenCache.set(cacheKey, verified, 5 * 60_000, 30_000);
  return verified;
}

export async function authenticate(c: Context, config: GatewayConfig): Promise<AuthUser | null> {
  const apiKey = presentedKey(c);
  if (apiKey) {
    const match = config.masterKeys.find((master) => safeEqual(apiKey, master));
    if (match) {
      return { uid: 'gateway-api-key', isAdmin: true, via: 'api-key' };
    }
  }

  const token = bearerToken(c);
  if (!token) return null;
  try {
    const user = await lookupFirebaseUser(config, token);
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      isAdmin: isAdminEmail(config, user.email),
      via: 'firebase',
    };
  } catch {
    return null;
  }
}

/** Scope a shared cache entry so one user's private response is never reused for another. */
export function cacheScope(c: Context): string {
  const auth = c.req.header('authorization') || '';
  const apiKey = c.req.header('x-api-key') || c.req.header('x-api-token') || '';
  if (!auth && !apiKey) return 'public';
  return sha256(`${auth}\n${apiKey}`).slice(0, 16);
}
