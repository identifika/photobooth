import { NextResponse } from 'next/server';
import { loadPublicFrames, FRAMES, type Frame } from '@/lib/frames';
import { loadUserFrame, type UserFrame } from '@/lib/user-frames';
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
 * GET /api/frames/[id]
 * Retrieves a single frame by its ID (preset, public, or custom).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Frame ID is required' }, { status: 400 });
    }

    // 1. Check if it's a custom user frame (id starts with "user-")
    if (id.startsWith('user-')) {
      const rawId = id.replace('user-', '');
      const authContext = await verifyAuthOrApiKey(request);
      const uid = authContext?.uid;
      
      if (uid) {
        const userFrame = await loadUserFrame(uid, rawId);
        if (userFrame) {
          return NextResponse.json({
            success: true,
            frame: { ...userFrameToFrame(userFrame), isCustom: true },
          });
        }
      }
    }

    // 2. Check public & preset frames
    const publicFrames = await loadPublicFrames().catch(() => FRAMES);
    let match = publicFrames.find((f) => f.id === id);

    if (!match) {
      match = FRAMES.find((f) => f.id === id);
    }

    if (!match) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      frame: { ...match, isCustom: false },
    });
  } catch (error: any) {
    console.error('Failed to get frame by ID:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
