import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, hashPassword, jsonError } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return jsonError('Unauthorized', 401);
    }

    const body = await request.json().catch(() => null);
    if (!body) return jsonError('Invalid JSON', 400);

    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length < 6) {
      return jsonError('Password must be at least 6 characters long', 400);
    }

    const passwordHash = hashPassword(password);

    await prisma.user.update({
      where: { id: sessionUser.uid },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    console.error('Set password error:', error);
    return jsonError('Failed to set password', 500);
  }
}
