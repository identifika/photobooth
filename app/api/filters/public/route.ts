import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublicFilter } from '@/lib/filter-converters';

/**
 * GET /api/filters/public
 * Returns public filters.
 * Query:
 * - ?ownerUid=... (filter by creator)
 * - ?all=true (admin can see inactive)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerUid = searchParams.get('ownerUid');
    const includeInactive = searchParams.get('all') === 'true';

    const user = await getSessionUser(request);
    const canSeeInactive = user?.isAdmin && includeInactive;

    const where: any = {};
    if (ownerUid) where.ownerUid = ownerUid;
    if (!canSeeInactive) where.active = true;

    const rows = await prisma.publicFilter.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const filters = rows.map(formatPublicFilter);

    return NextResponse.json({
      success: true,
      count: filters.length,
      filters,
    });
  } catch (error: any) {
    console.error('Failed to list public filters:', error);
    return jsonError(error.message || 'Failed to list public filters', 500);
  }
}

/**
 * POST /api/filters/public
 * Creates a public filter (admin only).
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden: admin only', 403);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      emoji = '📷',
      adjustments,
      css,
      description = '',
      ownerUid,
      ownerName,
      sortOrder = 0,
      active = true,
    } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Filter name is required', 400);
    }
    if (!adjustments || typeof adjustments !== 'object') {
      return jsonError('Filter adjustments are required', 400);
    }

    const newRow = await prisma.publicFilter.create({
      data: {
        name: name.trim(),
        emoji: typeof emoji === 'string' ? emoji : '📷',
        adjustments: adjustments as any,
        css: typeof css === 'string' ? css : null,
        description: typeof description === 'string' ? description.trim() : '',
        ownerUid: ownerUid || user.uid,
        ownerName: ownerName || null,
        sortOrder: Number(sortOrder) || 0,
        active: Boolean(active),
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      filter: formatPublicFilter(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create public filter:', error);
    return jsonError(error.message || 'Failed to create public filter', 500);
  }
}
