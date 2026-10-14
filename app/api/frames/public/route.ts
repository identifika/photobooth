import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { FRAMES } from '@/lib/frames';
import { formatPublicFrame, toPrismaLayout, type PublicFrame } from '@/lib/frame-converters';

/**
 * GET /api/frames/public
 * Lists public frames.
 * Options:
 * - ?ownerUid=... (filter by creator)
 * - ?all=true (admin can include inactive frames)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerUid = searchParams.get('ownerUid');
    const includeInactive = searchParams.get('all') === 'true';

    const user = await getSessionUser(request);
    const canSeeInactive = user?.isAdmin && includeInactive;

    const where: any = {};
    if (ownerUid) {
      where.ownerUid = ownerUid;
    }
    if (!canSeeInactive) {
      where.active = true;
    }

    const rows = await prisma.publicFrame.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    let frames: PublicFrame[] = rows.map(formatPublicFrame);

    // If database is empty and no ownerUid filter, fall back to static list
    if (frames.length === 0 && !ownerUid) {
      frames = FRAMES.map((f) => ({
        ...f,
        sortOrder: 0,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    return NextResponse.json({
      success: true,
      count: frames.length,
      frames,
    });
  } catch (error: any) {
    console.error('Failed to list public frames:', error);
    return jsonError(error.message || 'Failed to list public frames', 500);
  }
}

/**
 * POST /api/frames/public
 * Creates a public frame (admin only).
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden: admin only', 403);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      description = '',
      photoCount = 4,
      layout = 'strip-4',
      aspectRatio = 1.333333,
      color = '#f5f0e8',
      borderColor = '#1a1410',
      accentColor = '#c9a84c',
      emoji = '🎨',
      config,
      width,
      height,
      ownerUid,
      ownerName,
      sortOrder = 0,
      active = true,
    } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Frame name is required', 400);
    }

    const newRow = await prisma.publicFrame.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        photoCount: Number(photoCount) || 4,
        layout: toPrismaLayout(layout),
        aspectRatio: Number(aspectRatio) || 1.333333,
        color: typeof color === 'string' ? color : '#f5f0e8',
        borderColor: typeof borderColor === 'string' ? borderColor : '#1a1410',
        accentColor: typeof accentColor === 'string' ? accentColor : '#c9a84c',
        emoji: typeof emoji === 'string' ? emoji : '🎨',
        config: config ?? null,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        ownerUid: ownerUid || user.uid,
        ownerName: ownerName || null,
        sortOrder: Number(sortOrder) || 0,
        active: Boolean(active),
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      frame: formatPublicFrame(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create public frame:', error);
    return jsonError(error.message || 'Failed to create public frame', 500);
  }
}
