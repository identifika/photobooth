import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, checkIsAdmin } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.uid },
    });

    if (!dbUser && sessionUser.email) {
      // Check if user exists by email
      dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email },
      });

      if (!dbUser) {
        // Auto-provision user from fallback session preserving their UID as ID
        try {
          dbUser = await prisma.user.create({
            data: {
              id: sessionUser.uid,
              email: sessionUser.email,
              name: sessionUser.name || sessionUser.email.split('@')[0],
            },
          });
        } catch {
          // In case of race condition
          dbUser = await prisma.user.findFirst({
            where: { OR: [{ id: sessionUser.uid }, { email: sessionUser.email }] },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: sessionUser.uid,
        email: sessionUser.email || dbUser?.email || '',
        name: dbUser?.name || sessionUser.name || (sessionUser.email ? sessionUser.email.split('@')[0] : 'User'),
        hasPassword: !!dbUser?.passwordHash,
        hasGoogle: !!dbUser?.googleSub,
        isAdmin: checkIsAdmin(sessionUser.email || dbUser?.email),
      },
    });
  } catch (error) {
    console.error('Auth /me error:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
