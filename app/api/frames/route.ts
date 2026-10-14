import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthOrApiKey, getSessionUser, jsonError } from '@/lib/auth-server';
import { FRAMES } from '@/lib/frames';
import { formatUserFrame, formatPublicFrame, userFrameToFrame } from '@/lib/frame-converters';

/**
 * GET /api/frames
 * Returns frames from Postgres (user_frames and optionally public_frames).
 * Query options:
 * - ?uid=... (filter frames by creator UID)
 * - ?photoCount=2|3|4 (filter by number of photos)
 * - ?category=... (filter by category)
 * - ?includePublic=true (optionally include preset public frames)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uidParam = searchParams.get('uid');
    const categoryParam = searchParams.get('category');
    const photoCountParam = searchParams.get('photoCount');
    const includePublic = searchParams.get('includePublic') === 'true';

    const authContext = await verifyAuthOrApiKey(request);
    const targetUid = uidParam || (authContext?.uid && authContext.uid !== 'api-host' && authContext.uid !== 'master-api-host' ? authContext.uid : null);

    // 1. Fetch user frames from Postgres
    const userFrameRows = await prisma.userFrame.findMany({
      where: targetUid ? { uid: targetUid } : undefined,
      orderBy: { updatedAt: 'desc' },
    });

    let frames = userFrameRows.map(formatUserFrame).map(userFrameToFrame);

    // 2. If includePublic=true, include public frames
    if (includePublic) {
      let publicFrames: any[] = [];
      try {
        const publicFrameRows = await prisma.publicFrame.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        publicFrames = publicFrameRows.map(formatPublicFrame);
      } catch (err) {
        console.warn('Failed to query public frames from Postgres, using static fallback:', err);
      }

      if (publicFrames.length === 0) {
        publicFrames = FRAMES;
      }

      const formattedPublic = publicFrames.map((f) => ({
        ...f,
        rawId: f.id,
        isCustom: false,
      }));
      frames = [...frames, ...formattedPublic];
    }

    // 3. Apply category & photoCount filters
    if (categoryParam) {
      frames = frames.filter((f) => f.categoryId === categoryParam);
    }

    if (photoCountParam) {
      const count = parseInt(photoCountParam, 10);
      if (!isNaN(count)) {
        frames = frames.filter((f) => f.photoCount === count);
      }
    }

    return NextResponse.json({
      success: true,
      count: frames.length,
      frames,
    });
  } catch (error: any) {
    console.error('Failed to list frames via API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list frames' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/frames
 * Create a new user frame for the signed-in user.
 * Body: { name, emoji?, categoryId, config }
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const { name, emoji, categoryId = '', config } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Frame name is required', 400);
    }
    if (!config || typeof config !== 'object') {
      return jsonError('Frame config is required', 400);
    }

    const newRow = await prisma.userFrame.create({
      data: {
        uid: user.uid,
        name: name.trim(),
        emoji: typeof emoji === 'string' ? emoji : null,
        categoryId: typeof categoryId === 'string' ? categoryId : '',
        config: config as any,
      },
    });

    const formatted = formatUserFrame(newRow);
    return NextResponse.json({
      success: true,
      id: newRow.id,
      frame: formatted,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create user frame:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create frame' },
      { status: 500 }
    );
  }
}
