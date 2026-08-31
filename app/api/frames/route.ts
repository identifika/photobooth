import { NextResponse } from 'next/server';
import { loadPublicFrames, FRAMES, type Frame } from '@/lib/frames';
import { listUserFrames, type UserFrame } from '@/lib/user-frames';
import { verifyAuthOrApiKey } from '@/lib/auth-server';

function userFrameToFrame(f: UserFrame): Frame {
  const photoCount = Math.max(1, f.config?.elements?.filter((e) => e.type === 'photo').length || 4);
  return {
    id: `user-${f.id}`,
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
  };
}

/**
 * GET /api/frames
 * Returns a list of available photobooth frames.
 * Query options:
 * - ?photoCount=2|3|4 (filter by number of photos)
 * - ?layout=strip-2|strip-3|strip-4|grid-2x2
 * - ?includeCustom=true (includes authenticated user's custom frames)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const photoCountParam = searchParams.get('photoCount');
    const layoutParam = searchParams.get('layout');
    const includeCustomParam = searchParams.get('includeCustom') !== 'false';

    // 1. Fetch public & preset frames
    const publicFrames = await loadPublicFrames().catch(() => FRAMES);

    const allFrames: (Frame & { isCustom: boolean })[] = publicFrames.map((f) => ({
      ...f,
      isCustom: false,
    }));

    // 2. If authenticated, fetch custom user frames
    if (includeCustomParam) {
      const authContext = await verifyAuthOrApiKey(request);
      if (authContext?.uid && authContext.uid !== 'api-host' && authContext.uid !== 'master-api-host') {
        try {
          const userFrames = await listUserFrames(authContext.uid);
          const converted = userFrames.map((uf) => ({
            ...userFrameToFrame(uf),
            isCustom: true,
          }));
          allFrames.unshift(...converted);
        } catch (e) {
          console.warn('Failed to load user frames:', e);
        }
      }
    }

    // 3. Apply optional filters
    let filtered = allFrames;

    if (photoCountParam) {
      const count = parseInt(photoCountParam, 10);
      if (!isNaN(count)) {
        filtered = filtered.filter((f) => f.photoCount === count);
      }
    }

    if (layoutParam) {
      filtered = filtered.filter((f) => f.layout === layoutParam);
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      frames: filtered,
    });
  } catch (error: any) {
    console.error('Failed to list frames via API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list frames' },
      { status: 500 }
    );
  }
}
