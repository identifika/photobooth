import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { formatPublicBackground } from '@/lib/background-converters';

/**
 * GET /api/backgrounds/public/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await prisma.publicBackground.findUnique({ where: { id } });
    if (!row) return jsonError('Public background not found', 404);

    return NextResponse.json({
      success: true,
      background: formatPublicBackground(row),
    });
  } catch (error: any) {
    console.error('Failed to get public background:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * DELETE /api/backgrounds/public/[id]
 * Admin or owner only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  try {
    const { id } = await params;
    const existing = await prisma.publicBackground.findUnique({ where: { id } });
    if (!existing) return jsonError('Public background not found', 404);

    const isOwner = existing.ownerUid && existing.ownerUid === user.uid;
    if (!user.isAdmin && !isOwner) {
      return jsonError('Forbidden: you do not have permission to delete this background', 403);
    }

    await prisma.publicBackground.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete public background:', error);
    return jsonError(error.message || 'Failed to delete public background', 500);
  }
}
