import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from './db';

export interface AuthContext {
  uid: string;
  email?: string;
  isApiKey?: boolean;
  keyName?: string;
  role?: string;
}

export interface SessionUser {
  uid: string;
  email?: string;
  name?: string;
  isAdmin: boolean;
}

export function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  const rawList = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = rawList
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

/** Password hashing using Node.js scrypt with a unique random salt */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/** Constant-time password verification */
export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/** Generate a 256-bit random session token */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Create a session in the database valid for 30 days */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** Delete a session by token */
export async function deleteSession(token: string): Promise<void> {
  try {
    await prisma.session.delete({ where: { token } });
  } catch {
    // ignore if already deleted
  }
}

/** Extract session token from pika_session cookie or Authorization: Bearer <token> */
export function extractSessionToken(request: Request): string | null {
  // 1. Check Cookie header for pika_session
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)pika_session=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }

  // 2. Check Authorization header
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate && !candidate.startsWith('pk_')) {
      return candidate;
    }
  }

  return null;
}

/** Set the HTTP-only session cookie */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set('pika_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

/** Clear the session cookie */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set('pika_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Returns the currently signed-in user for this request from our Postgres `sessions` table.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = extractSessionToken(request);
  if (token) {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });
      if (session && session.expiresAt > new Date()) {
        return {
          uid: session.user.id,
          email: session.user.email,
          name: session.user.name || undefined,
          isAdmin: checkIsAdmin(session.user.email),
        };
      }
    } catch (e) {
      console.warn('Error reading session from database:', e);
    }
  }

  return null;
}

/**
 * Universal Auth verifier: Supports API Keys (header or query param) AND Session Tokens.
 */
export async function verifyAuthOrApiKey(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('x-api-token') || request.headers.get('apikey');
  
  let queryApiKey: string | null = null;
  try {
    const url = new URL(request.url);
    queryApiKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key');
  } catch {
    // ignore URL parse errors
  }

  // Check if Authorization header passed an API key (e.g. Bearer pk_live_...)
  let bearerApiKey: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.split('Bearer ')[1]?.trim();
    if (candidate && (candidate.startsWith('pk_') || (candidate.length > 20 && !candidate.includes('.')))) {
      bearerApiKey = candidate;
    }
  }

  const candidateKey = apiKeyHeader || queryApiKey || bearerApiKey;

  // 1. Check Master / Environment API Key
  const masterKey = process.env.PIKABOOTH_API_KEY || process.env.API_SECRET_KEY || process.env.ADMIN_API_KEY;
  if (candidateKey && masterKey && candidateKey === masterKey) {
    return {
      uid: 'master-api-host',
      isApiKey: true,
      role: 'admin',
      keyName: 'Master Environment API Key',
    };
  }

  // 2. Studio-generated API keys (Postgres)
  if (candidateKey) {
    try {
      const keyRow = await prisma.apiKey.findFirst({ where: { key: candidateKey, active: true } });
      if (keyRow) {
        await prisma.apiKey.update({ where: { id: keyRow.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        return {
          uid: keyRow.uid,
          isApiKey: true,
          role: 'user',
          keyName: keyRow.name,
        };
      }
    } catch (e) {
      console.warn('Error checking database API key:', e);
    }
  }

  // 3. Check Session / User Auth
  const sessionUser = await getSessionUser(request);
  if (sessionUser) {
    return {
      uid: sessionUser.uid,
      email: sessionUser.email,
      isApiKey: false,
      role: sessionUser.isAdmin ? 'admin' : 'user',
    };
  }

  return null;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
