import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublicFrame, toPrismaLayout } from '@/lib/frame-converters';

/**
 * GET /api/frames/public/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await prisma.publicFrame.findUnique({ where: { id } });
    if (!row) return jsonError('Public frame not found', 404);

    return NextResponse.json({
      success: true,
      frame: formatPublicFrame(row),
    });
  } catch (error: any) {
    console.error('Failed to get public frame:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * PATCH /api/frames/public/[id]
 * Update a public frame. Admin or owner only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.publicFrame.findUnique({ where: { id } });
    if (!existing) return jsonError('Public frame not found', 404);

    const isOwner = existing.ownerUid && existing.ownerUid === user.uid;
    if (!user.isAdmin && !isOwner) {
      return jsonError('Forbidden: you do not have permission to edit this frame', 403);
    }

    const body = await request.json().catch(() => ({}));
    const updateData: any = {};

    if (typeof body.name === 'string') updateData.name = body.name.trim();
    if (typeof body.description === 'string') updateData.description = body.description.trim();
    if (body.photoCount !== undefined) updateData.photoCount = Number(body.photoCount);
    if (body.layout !== undefined) updateData.layout = toPrismaLayout(body.layout);
    if (body.aspectRatio !== undefined) updateData.aspectRatio = Number(body.aspectRatio);
    if (typeof body.color === 'string') updateData.color = body.color;
    if (typeof body.borderColor === 'string') updateData.borderColor = body.borderColor;
    if (typeof body.accentColor === 'string') updateData.accentColor = body.accentColor;
    if (typeof body.emoji === 'string') updateData.emoji = body.emoji;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.width !== undefined) updateData.width = body.width ? Number(body.width) : null;
    if (body.height !== undefined) updateData.height = body.height ? Number(body.height) : null;
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const updated = await prisma.publicFrame.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      frame: formatPublicFrame(updated),
    });
  } catch (error: any) {
    console.error('Failed to update public frame:', error);
    return jsonError(error.message || 'Failed to update public frame', 500);
  }
}

/**
 * DELETE /api/frames/public/[id]
 * Delete a public frame. Admin or owner only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.publicFrame.findUnique({ where: { id } });
    if (!existing) return jsonError('Public frame not found', 404);

    const isOwner = existing.ownerUid && existing.ownerUid === user.uid;
    if (!user.isAdmin && !isOwner) {
      return jsonError('Forbidden: you do not have permission to delete this frame', 403);
    }

    await prisma.publicFrame.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete public frame:', error);
    return jsonError(error.message || 'Failed to delete public frame', 500);
  }
}
