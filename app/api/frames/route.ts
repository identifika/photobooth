import { NextResponse } from 'next/server';
import { listAllUserFrames, listUserFrames, type UserFrame } from '@/lib/user-frames';
import { loadPublicFrames, FRAMES, type Frame } from '@/lib/frames';
import { verifyAuthOrApiKey } from '@/lib/auth-server';

function userFrameToFrame(f: UserFrame): Frame & { rawId: string; categoryId?: string; uid?: string; isCustom: boolean } {
  const photoCount = Math.max(1, f.config?.elements?.filter((e) => e.type === 'photo').length || 4);
  return {
    id: `user-${f.id}`,
    rawId: f.id,
    name: f.name || 'Custom Frame',
    description: f.config?.description || 'Custom user frame',
    photoCount,
    layout: photoCount <= 2 ? 'strip-2' : photoCount === 3 ? 'strip-3' : 'grid-2x2',
    aspectRatio: 4 / 3,
    color: f.config?.color || '#f5f0e8',
    borderColor: f.config?.borderColor || '#1a1410',
    accentColor: f.config?.accentColor || '#c9a84c',
    emoji: f.emoji || '✨',
    config: f.config,
    width: f.config?.width,
    height: f.config?.height,
    categoryId: f.categoryId,
    uid: f.uid,
    isCustom: true,
  };
}

/**
 * GET /api/frames
 * Returns existing custom frames from user_frames collection.
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

    // 1. Fetch user frames from Firestore (user_frames collection)
    let rawUserFrames: UserFrame[] = [];
    if (targetUid) {
      rawUserFrames = await listUserFrames(targetUid).catch(() => []);
    } else {
      rawUserFrames = await listAllUserFrames().catch(() => []);
    }

    let frames = rawUserFrames.map(userFrameToFrame);

    // 2. If includePublic=true or if no user frames exist, include public frames
    if (includePublic) {
      const publicFrames = await loadPublicFrames().catch(() => FRAMES);
      const formattedPublic = publicFrames.map((f) => ({
        ...f,
        rawId: f.id,
        isCustom: false,
      }));
      frames = [...frames, ...formattedPublic];
    }

    // 3. Apply filters
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
    console.error('Failed to list user frames via API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list frames' },
      { status: 500 }
    );
  }
}
