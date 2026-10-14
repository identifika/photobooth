import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublishRequest } from '@/lib/publish-request-converters';
import type { PublishRequestType } from '@/lib/generated/prisma/enums';

/**
 * GET /api/publish-requests
 * Query:
 * - ?status=pending (admin only — returns pending requests across all users)
 * - Otherwise returns the signed-in user's requests
 */
export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    if (statusParam === 'pending') {
      if (!user.isAdmin) {
        return jsonError('Forbidden: admin only', 403);
      }

      const rows = await prisma.publishRequest.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        count: rows.length,
        requests: rows.map(formatPublishRequest),
      });
    }

    // Regular user's own requests
    const rows = await prisma.publishRequest.findMany({
      where: { userUid: user.uid },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: rows.length,
      requests: rows.map(formatPublishRequest),
    });
  } catch (error: any) {
    console.error('Failed to list publish requests:', error);
    return jsonError(error.message || 'Failed to list publish requests', 500);
  }
}

/**
 * POST /api/publish-requests
 * Create a new publish request for frame, filter, or background.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      type = 'frame',
      frameId,
      filterId,
      backgroundId,
      user: userInfo,
      frame,
      filter,
      background,
    } = body;

    const userDisplayName = userInfo?.displayName || user.email || 'Anonymous';

    const newRow = await prisma.publishRequest.create({
      data: {
        type: (type as PublishRequestType) || 'frame',
        status: 'pending',
        frameId: frameId || null,
        filterId: filterId || null,
        backgroundId: backgroundId || null,
        userUid: user.uid,
        userDisplayName,
        frame: frame ?? null,
        filter: filter ?? null,
        background: background ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      id: newRow.id,
      request: formatPublishRequest(newRow),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create publish request:', error);
    return jsonError(error.message || 'Failed to create publish request', 500);
  }
}
