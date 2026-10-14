import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatUserBackground, formatPublicBackground } from '@/lib/background-converters';

/**
 * GET /api/backgrounds/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userRow = await prisma.userBackground.findUnique({ where: { id } });
    if (userRow) {
      return NextResponse.json({
        success: true,
        background: formatUserBackground(userRow),
      });
    }

    const publicRow = await prisma.publicBackground.findUnique({ where: { id } });
    if (publicRow) {
      return NextResponse.json({
        success: true,
        background: formatPublicBackground(publicRow),
      });
    }

    return jsonError('Background not found', 404);
  } catch (error: any) {
    console.error('Failed to get background by ID:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * DELETE /api/backgrounds/[id]
 * Delete user background. Owner or admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.userBackground.findUnique({ where: { id } });
    if (!existing) return jsonError('Background not found', 404);

    if (!user.isAdmin && existing.ownerUid !== user.uid) {
      return jsonError('Forbidden: you do not own this background', 403);
    }

    await prisma.userBackground.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete user background:', error);
    return jsonError(error.message || 'Failed to delete background', 500);
  }
}
