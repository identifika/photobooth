import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyPassword,
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

    if (!email || !password) {
      return jsonError('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return jsonError('Invalid email or password', 401);
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return jsonError('Invalid email or password', 401);
    }

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
    console.error('Login error:', error);
    return jsonError('Failed to sign in', 500);
  }
}
