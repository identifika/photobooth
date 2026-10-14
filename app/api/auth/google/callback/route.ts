import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth-server';

function getBaseUrl(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  let redirectTo = '/';
  if (stateRaw) {
    try {
      const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'));
      if (decoded.redirect && typeof decoded.redirect === 'string') {
        redirectTo = decoded.redirect;
      }
    } catch {
      // ignore state parse errors
    }
  }

  const baseUrl = getBaseUrl(request);

  if (error || !code) {
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('error', error ? `Google sign-in error: ${error}` : 'Missing authorization code');
    return NextResponse.redirect(loginUrl.toString());
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('error', 'Google OAuth credentials not configured on server');
    return NextResponse.redirect(loginUrl.toString());
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange failed:', errText);
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('error', 'Failed to exchange authorization code with Google');
      return NextResponse.redirect(loginUrl.toString());
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch user profile
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('error', 'Failed to fetch user profile from Google');
      return NextResponse.redirect(loginUrl.toString());
    }

    const userInfo = await userRes.json();
    const email = userInfo.email?.toLowerCase().trim();
    const sub = userInfo.sub;
    const name = userInfo.name || email.split('@')[0];

    if (!email || !sub) {
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('error', 'Incomplete profile from Google');
      return NextResponse.redirect(loginUrl.toString());
    }

    // Upsert User in database
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleSub: sub }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleSub: sub,
        },
      });
    } else if (!user.googleSub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSub: sub, name: user.name || name },
      });
    }

    const { token } = await createSession(user.id);

    const destination = new URL(redirectTo, baseUrl);
    const response = NextResponse.redirect(destination.toString());
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('Google OAuth callback unexpected error:', err);
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('error', 'Internal error processing Google login');
    return NextResponse.redirect(loginUrl.toString());
  }
}
