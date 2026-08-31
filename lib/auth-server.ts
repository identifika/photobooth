import { fsGetCollection } from './firestore';

export interface AuthContext {
  uid: string;
  isApiKey?: boolean;
  keyName?: string;
  role?: string;
}

/**
 * Verifies standard Firebase ID tokens (Bearer JWT)
 */
export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string } | null> {
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
    const uid = data.users?.[0]?.localId;
    return uid ? { uid } : null;
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

  // 2. Check Database API Keys collection (for Studio-generated API keys)
  if (candidateKey) {
    try {
      let keys = await fsGetCollection('user_api_keys', candidateKey, 'key').catch(() => []);
      if (!keys || keys.length === 0) {
        keys = await fsGetCollection('api_keys', candidateKey, 'key').catch(() => []);
      }
      if (keys && keys.length > 0) {
        const keyDoc = keys[0].data as any;
        if (keyDoc.active !== false) {
          return {
            uid: keyDoc.uid || 'studio-api-user',
            isApiKey: true,
            role: 'user',
            keyName: keyDoc.name || 'Studio API Key',
          };
        }
      }
    } catch (e) {
      console.warn('Error checking database API key:', e);
    }
  }

  // 3. Fallback: Verify Firebase ID Token
  if (authHeader) {
    const idAuth = await verifyIdToken(authHeader);
    if (idAuth) {
      return { uid: idAuth.uid, isApiKey: false };
    }
  }

  return null;
}
