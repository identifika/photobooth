import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie, checkIsAdmin, jsonError } from '@/lib/auth-server';

function getBaseUrl(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/';

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID).');
    return NextResponse.redirect(loginUrl.toString());
  }

  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const state = JSON.stringify({ redirect: redirectTo });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state: Buffer.from(state).toString('base64url'),
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/** Handles client-side tokens from Google One-Tap or Google Identity Services */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError('Invalid JSON', 400);

    const token = body.credential || body.idToken;
    let email = '';
    let sub = '';
    let name = '';

    if (token) {
      // Verify ID token with Google's tokeninfo endpoint
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!verifyRes.ok) {
        return jsonError('Invalid Google credential', 401);
      }
      const data = await verifyRes.json();
      email = data.email?.toLowerCase().trim();
      sub = data.sub;
      name = data.name || data.given_name || email.split('@')[0];
    } else if (body.accessToken) {
      // Verify Access token with Google's userinfo endpoint
      const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${body.accessToken}` },
      });
      if (!verifyRes.ok) {
        return jsonError('Invalid Google access token', 401);
      }
      const data = await verifyRes.json();
      email = data.email?.toLowerCase().trim();
      sub = data.sub;
      name = data.name || email.split('@')[0];
    } else {
      return jsonError('Missing credential or token', 400);
    }

    if (!email || !sub) {
      return jsonError('Google user information missing email or id', 400);
    }

    // Find or create User
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleSub: sub }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          googleSub: sub,
        },
      });
    } else if (!user.googleSub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSub: sub, name: user.name || name },
      });
    }

    const { token: sessionToken } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: checkIsAdmin(user.email),
      },
    });

    setSessionCookie(response, sessionToken);
    return response;
  } catch (err) {
    console.error('Google auth error:', err);
    return jsonError('Google authentication failed', 500);
  }
}
