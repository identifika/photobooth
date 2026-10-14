import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, verifyAuthOrApiKey, jsonError } from '@/lib/auth-server';
import { formatUserBackground } from '@/lib/background-converters';
import type { BackgroundType } from '@/lib/generated/prisma/enums';

/**
 * GET /api/backgrounds
 * Lists user backgrounds.
 * Query: ?uid=... (filter by owner UID)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uidParam = searchParams.get('uid');

    const authContext = await verifyAuthOrApiKey(request);
    const targetUid = uidParam || (authContext?.uid && authContext.uid !== 'api-host' ? authContext.uid : null);

    const rows = await prisma.userBackground.findMany({
      where: targetUid ? { ownerUid: targetUid } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const backgrounds = rows.map(formatUserBackground);

    return NextResponse.json({
      success: true,
      count: backgrounds.length,
      backgrounds,
    });
  } catch (error: any) {
    console.error('Failed to list user backgrounds:', error);
    return jsonError(error.message || 'Failed to list backgrounds', 500);
  }
}

/**
 * POST /api/backgrounds
 * Create a new user background.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const { name, type = 'upload', src, ownerName } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Background name is required', 400);
    }

    const newRow = await prisma.userBackground.create({
      data: {
        ownerUid: user.uid,
        ownerName: ownerName || null,
        type: type as BackgroundType,
        name: name.trim(),
        src: typeof src === 'string' ? src : null,
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      background: formatUserBackground(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create user background:', error);
    return jsonError(error.message || 'Failed to create background', 500);
  }
}
