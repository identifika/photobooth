import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublicBackground } from '@/lib/background-converters';
import type { BackgroundType } from '@/lib/generated/prisma/enums';

/**
 * GET /api/backgrounds/public
 * Lists public backgrounds.
 * Query: ?ownerUid=... (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerUid = searchParams.get('ownerUid');

    const rows = await prisma.publicBackground.findMany({
      where: ownerUid ? { ownerUid } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const backgrounds = rows.map(formatPublicBackground);

    return NextResponse.json({
      success: true,
      count: backgrounds.length,
      backgrounds,
    });
  } catch (error: any) {
    console.error('Failed to list public backgrounds:', error);
    return jsonError(error.message || 'Failed to list public backgrounds', 500);
  }
}

/**
 * POST /api/backgrounds/public
 * Creates a public background (admin only).
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden: admin only', 403);

  try {
    const body = await request.json().catch(() => ({}));
    const { name, type = 'upload', src, ownerUid, ownerName } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Background name is required', 400);
    }

    const newRow = await prisma.publicBackground.create({
      data: {
        ownerUid: ownerUid || user.uid,
        ownerName: ownerName || null,
        type: type as BackgroundType,
        name: name.trim(),
        src: typeof src === 'string' ? src : null,
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      background: formatPublicBackground(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create public background:', error);
    return jsonError(error.message || 'Failed to create public background', 500);
  }
}
