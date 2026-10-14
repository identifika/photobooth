import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, verifyAuthOrApiKey, jsonError } from '@/lib/auth-server';
import { formatUserFilter } from '@/lib/filter-converters';

/**
 * GET /api/filters
 * Returns user filters.
 * Query: ?uid=... (filter by creator UID)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uidParam = searchParams.get('uid');

    const authContext = await verifyAuthOrApiKey(request);
    const targetUid = uidParam || (authContext?.uid && authContext.uid !== 'api-host' ? authContext.uid : null);

    const rows = await prisma.userFilter.findMany({
      where: targetUid ? { uid: targetUid } : undefined,
      orderBy: { updatedAt: 'desc' },
    });

    const filters = rows.map(formatUserFilter);

    return NextResponse.json({
      success: true,
      count: filters.length,
      filters,
    });
  } catch (error: any) {
    console.error('Failed to list user filters:', error);
    return jsonError(error.message || 'Failed to list filters', 500);
  }
}

/**
 * POST /api/filters
 * Creates a new user filter for the signed-in user.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const { name, emoji = '📷', adjustments, css } = body;

    if (!name || typeof name !== 'string') {
      return jsonError('Filter name is required', 400);
    }
    if (!adjustments || typeof adjustments !== 'object') {
      return jsonError('Filter adjustments are required', 400);
    }

    const newRow = await prisma.userFilter.create({
      data: {
        uid: user.uid,
        name: name.trim(),
        emoji: typeof emoji === 'string' ? emoji : '📷',
        adjustments: adjustments as any,
        css: typeof css === 'string' ? css : null,
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      filter: formatUserFilter(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create user filter:', error);
    return jsonError(error.message || 'Failed to create filter', 500);
  }
}
