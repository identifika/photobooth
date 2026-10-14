import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatUserFilter, formatPublicFilter } from '@/lib/filter-converters';

/**
 * GET /api/filters/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userRow = await prisma.userFilter.findUnique({ where: { id } });
    if (userRow) {
      return NextResponse.json({
        success: true,
        filter: formatUserFilter(userRow),
      });
    }

    const publicRow = await prisma.publicFilter.findUnique({ where: { id } });
    if (publicRow) {
      return NextResponse.json({
        success: true,
        filter: formatPublicFilter(publicRow),
      });
    }

    return jsonError('Filter not found', 404);
  } catch (error: any) {
    console.error('Failed to get filter by ID:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * PATCH /api/filters/[id]
 * Updates a user filter. Owner or admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.userFilter.findUnique({ where: { id } });
    if (!existing) return jsonError('Filter not found', 404);

    if (!user.isAdmin && existing.uid !== user.uid) {
      return jsonError('Forbidden: you do not own this filter', 403);
    }

    const body = await request.json().catch(() => ({}));
    const updateData: any = {};
    if (typeof body.name === 'string') updateData.name = body.name.trim();
    if (typeof body.emoji === 'string') updateData.emoji = body.emoji;
    if (body.adjustments && typeof body.adjustments === 'object') updateData.adjustments = body.adjustments;
    if (body.css !== undefined) updateData.css = typeof body.css === 'string' ? body.css : null;

    const updated = await prisma.userFilter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      filter: formatUserFilter(updated),
    });
  } catch (error: any) {
    console.error('Failed to update filter:', error);
    return jsonError(error.message || 'Failed to update filter', 500);
  }
}

/**
 * DELETE /api/filters/[id]
 * Deletes a user filter. Owner or admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.userFilter.findUnique({ where: { id } });
    if (!existing) return jsonError('Filter not found', 404);

    if (!user.isAdmin && existing.uid !== user.uid) {
      return jsonError('Forbidden: you do not own this filter', 403);
    }

    await prisma.userFilter.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete filter:', error);
    return jsonError(error.message || 'Failed to delete filter', 500);
  }
}
