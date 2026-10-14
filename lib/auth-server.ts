import { NextResponse } from 'next/server';
import { prisma } from './db';

export interface AuthContext {
  uid: string;
  email?: string;
  isApiKey?: boolean;
  keyName?: string;
  role?: string;
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

/**
 * Verifies standard Firebase ID tokens (Bearer JWT)
 */
export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  if (!token) return null;

  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn('Missing NEXT_PUBLIC_FIREBASE_API_KEY for server auth verification');
      return null;
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const user = data.users?.[0];
    const uid = user?.localId;
    const email = user?.email;
    return uid ? { uid, email } : null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Universal Auth verifier: Supports API Keys (header or query param) AND Firebase ID tokens.
 * Works seamlessly from outside the app (cURL, Postman, Python, Node, Zapier, Webhooks).
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
    if (candidate && (candidate.startsWith('pk_') || candidate.length > 20 && !candidate.includes('.'))) {
      bearerApiKey = candidate;
    }
  }

  const candidateKey = apiKeyHeader || queryApiKey || bearerApiKey;

  // 1. Check Master / Environment API Key (e.g. in .env PIKABOOTH_API_KEY or API_SECRET_KEY)
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

  // 3. Fallback: Verify Firebase ID Token
  if (authHeader) {
    const idAuth = await verifyIdToken(authHeader);
    if (idAuth) {
      return { uid: idAuth.uid, email: idAuth.email, isApiKey: false, role: checkIsAdmin(idAuth.email) ? 'admin' : 'user' };
    }
  }

  return null;
}

export interface SessionUser {
  uid: string;
  email?: string;
  isAdmin: boolean;
}

/** Signed-in Firebase user for this request, or null. */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const authUser = await verifyIdToken(request.headers.get('Authorization') || request.headers.get('authorization'));
  if (!authUser) return null;
  return { uid: authUser.uid, email: authUser.email, isAdmin: checkIsAdmin(authUser.email) };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
