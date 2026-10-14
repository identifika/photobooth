import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  hashPassword,
  createSession,
  setSessionCookie,
  checkIsAdmin,
  jsonError,
} from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError('Invalid JSON body', 400);

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!email || !email.includes('@')) {
      return jsonError('Valid email address is required', 400);
    }
    if (!password || password.length < 6) {
      return jsonError('Password must be at least 6 characters long', 400);
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      if (!existing.passwordHash && existing.googleSub) {
        return jsonError('An account with this email was created with Google. Please sign in with Google.', 400);
      }
      return jsonError('An account with this email already exists', 400);
    }

    const passwordHash = hashPassword(password);
    const displayName = name || email.split('@')[0];

    const user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
      },
    });

    const { token } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: checkIsAdmin(user.email),
      },
    });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return jsonError('Failed to create account', 500);
  }
}
