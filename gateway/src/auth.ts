import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import type { GatewayConfig } from './config.js';
import { TtlCache } from './cache.js';
import { pooledFetch } from './http.js';

export interface AuthUser {
  uid: string;
  email?: string;
  isAdmin: boolean;
  via: 'session' | 'api-key';
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

function extractAuthToken(c: Context): string {
  // 1. Check Cookie header for pika_session
  const cookieHeader = c.req.header('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)pika_session=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }

  // 2. Check Authorization Bearer header
  const auth = c.req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token && !token.startsWith('pk_')) return token;
  }
  return '';
}

export function isAdminEmail(config: GatewayConfig, email?: string): boolean {
  if (!email) return false;
  return config.adminEmails.includes(email.toLowerCase());
}

async function lookupSessionUser(config: GatewayConfig, token: string): Promise<{ uid: string; email?: string } | null> {
  const cacheKey = `sess:${sha256(token)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached?.state === 'fresh') return cached.value;

  // 1. Check direct database if configured
  if (config.databaseUrl) {
    try {
      const { getSessionFromDb } = await import('./db.js');
      const dbUser = await getSessionFromDb(config.databaseUrl, token);
      if (dbUser) {
        tokenCache.set(cacheKey, dbUser, 5 * 60_000, 30_000);
        return dbUser;
      }
    } catch (err) {
      console.warn('Gateway session lookup in DB failed:', err);
    }
  }

  // 2. Fallback to upstream Next.js app /api/auth/me
  if (config.upstreamOrigin) {
    try {
      const res = await pooledFetch(config, `${config.upstreamOrigin}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `pika_session=${token}`,
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { success?: boolean; user?: { id?: string; email?: string } };
        if (data.user?.id) {
          const verified = { uid: data.user.id, email: data.user.email };
          tokenCache.set(cacheKey, verified, 5 * 60_000, 30_000);
          return verified;
        }
      }
    } catch (err) {
      // upstream fetch error
    }
  }

  return null;
}

export async function authenticate(c: Context, config: GatewayConfig): Promise<AuthUser | null> {
  const apiKey = presentedKey(c);
  if (apiKey) {
    const match = config.masterKeys.find((master) => safeEqual(apiKey, master));
    if (match) {
      return { uid: 'gateway-api-key', isAdmin: true, via: 'api-key' };
    }
  }

  const token = extractAuthToken(c);
  if (!token) return null;

  try {
    const sessionUser = await lookupSessionUser(config, token);
    if (sessionUser) {
      return {
        uid: sessionUser.uid,
        email: sessionUser.email,
        isAdmin: isAdminEmail(config, sessionUser.email),
        via: 'session',
      };
    }

    return null;
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
