import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublicFilter } from '@/lib/filter-converters';

/**
 * GET /api/filters/public/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await prisma.publicFilter.findUnique({ where: { id } });
    if (!row) return jsonError('Public filter not found', 404);

    return NextResponse.json({
      success: true,
      filter: formatPublicFilter(row),
    });
  } catch (error: any) {
    console.error('Failed to get public filter:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * PATCH /api/filters/public/[id]
 * Updates a public filter. Admin or owner only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.publicFilter.findUnique({ where: { id } });
    if (!existing) return jsonError('Public filter not found', 404);

    const isOwner = existing.ownerUid && existing.ownerUid === user.uid;
    if (!user.isAdmin && !isOwner) {
      return jsonError('Forbidden: you do not have permission to edit this filter', 403);
    }

    const body = await request.json().catch(() => ({}));
    const updateData: any = {};

    if (typeof body.name === 'string') updateData.name = body.name.trim();
    if (typeof body.emoji === 'string') updateData.emoji = body.emoji;
    if (body.adjustments && typeof body.adjustments === 'object') updateData.adjustments = body.adjustments;
    if (body.css !== undefined) updateData.css = typeof body.css === 'string' ? body.css : null;
    if (typeof body.description === 'string') updateData.description = body.description.trim();
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const updated = await prisma.publicFilter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      filter: formatPublicFilter(updated),
    });
  } catch (error: any) {
    console.error('Failed to update public filter:', error);
    return jsonError(error.message || 'Failed to update public filter', 500);
  }
}

/**
 * DELETE /api/filters/public/[id]
 * Deletes a public filter. Admin or owner only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.publicFilter.findUnique({ where: { id } });
    if (!existing) return jsonError('Public filter not found', 404);

    const isOwner = existing.ownerUid && existing.ownerUid === user.uid;
    if (!user.isAdmin && !isOwner) {
      return jsonError('Forbidden: you do not have permission to delete this filter', 403);
    }

    await prisma.publicFilter.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete public filter:', error);
    return jsonError(error.message || 'Failed to delete public filter', 500);
  }
}
