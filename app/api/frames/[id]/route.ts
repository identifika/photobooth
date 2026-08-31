import { NextResponse } from 'next/server';
import { loadUserFrameById, type UserFrame } from '@/lib/user-frames';
import { loadPublicFrames, FRAMES, type Frame } from '@/lib/frames';

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
 * GET /api/frames/[id]
 * Retrieves a single frame from user_frames (or fallback preset).
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

    const rawId = id.startsWith('user-') ? id.replace('user-', '') : id;

    // 1. Try loading from user_frames first
    const userFrame = await loadUserFrameById(rawId);
    if (userFrame) {
      return NextResponse.json({
        success: true,
        frame: userFrameToFrame(userFrame),
      });
    }

    // 2. Fallback: check public frames if not found in user_frames
    const publicFrames = await loadPublicFrames().catch(() => FRAMES);
    let match = publicFrames.find((f) => f.id === id || f.id === rawId);
    if (!match) {
      match = FRAMES.find((f) => f.id === id || f.id === rawId);
    }

    if (!match) {
      return NextResponse.json({ error: 'Frame not found in user frames' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      frame: { ...match, rawId: match.id, isCustom: false },
    });
  } catch (error: any) {
    console.error('Failed to get frame by ID:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
