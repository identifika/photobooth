import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { FRAMES } from '@/lib/frames';
import { formatUserFrame, formatPublicFrame, userFrameToFrame } from '@/lib/frame-converters';

/**
 * GET /api/frames/[id]
 * Retrieves a single frame from user_frames or public_frames.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return jsonError('Frame ID is required', 400);
    }

    const rawId = id.startsWith('user-') ? id.replace('user-', '') : id;

    // 1. Try loading from user_frames
    const userRow = await prisma.userFrame.findUnique({ where: { id: rawId } });
    if (userRow) {
      return NextResponse.json({
        success: true,
        frame: userFrameToFrame(formatUserFrame(userRow)),
      });
    }

    // 2. Try loading from public_frames
    const publicRow = await prisma.publicFrame.findUnique({ where: { id: rawId } });
    if (publicRow) {
      const formatted = formatPublicFrame(publicRow);
      return NextResponse.json({
        success: true,
        frame: { ...formatted, rawId: formatted.id, isCustom: false },
      });
    }

    // 3. Fallback: static preset frames
    const staticMatch = FRAMES.find((f) => f.id === id || f.id === rawId);
    if (staticMatch) {
      return NextResponse.json({
        success: true,
        frame: { ...staticMatch, rawId: staticMatch.id, isCustom: false },
      });
    }

    return jsonError('Frame not found', 404);
  } catch (error: any) {
    console.error('Failed to get frame by ID:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * PATCH /api/frames/[id]
 * Updates an existing user frame. Owner or admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const rawId = id.startsWith('user-') ? id.replace('user-', '') : id;

    const existing = await prisma.userFrame.findUnique({ where: { id: rawId } });
    if (!existing) {
      return jsonError('Frame not found', 404);
    }

    if (!user.isAdmin && existing.uid !== user.uid) {
      return jsonError('Forbidden: you do not own this frame', 403);
    }

    const body = await request.json().catch(() => ({}));
    const updateData: any = {};
    if (typeof body.name === 'string') updateData.name = body.name.trim();
    if (body.emoji !== undefined) updateData.emoji = body.emoji;
    if (typeof body.categoryId === 'string') updateData.categoryId = body.categoryId;
    if (body.config && typeof body.config === 'object') updateData.config = body.config;

    const updated = await prisma.userFrame.update({
      where: { id: rawId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      frame: formatUserFrame(updated),
    });
  } catch (error: any) {
    console.error('Failed to update user frame:', error);
    return jsonError(error.message || 'Failed to update frame', 500);
  }
}

/**
 * DELETE /api/frames/[id]
 * Deletes a user frame. Owner or admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const rawId = id.startsWith('user-') ? id.replace('user-', '') : id;

    const existing = await prisma.userFrame.findUnique({ where: { id: rawId } });
    if (!existing) {
      return jsonError('Frame not found', 404);
    }

    if (!user.isAdmin && existing.uid !== user.uid) {
      return jsonError('Forbidden: you do not own this frame', 403);
    }

    await prisma.userFrame.delete({ where: { id: rawId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete user frame:', error);
    return jsonError(error.message || 'Failed to delete frame', 500);
  }
}
