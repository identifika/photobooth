import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';

/**
 * POST /api/publish-requests/[id]/reject
 * Reject a publish request. Admin only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden: admin only', 403);

  try {
    const { id } = await params;
    const reqRow = await prisma.publishRequest.findUnique({ where: { id } });
    if (!reqRow) return jsonError('Publish request not found', 404);

    if (reqRow.status !== 'pending') {
      return jsonError('Request is not pending', 400);
    }

    await prisma.publishRequest.update({
      where: { id },
      data: { status: 'rejected' },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to reject publish request:', error);
    return jsonError(error.message || 'Failed to reject request', 500);
  }
}
