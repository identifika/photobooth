import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';
import { toPrismaLayout } from '@/lib/frame-converters';

/**
 * POST /api/publish-requests/[id]/approve
 * Approve a publish request and create the corresponding public asset.
 * Admin only.
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

    let publicId = '';

    if (reqRow.type === 'filter' && reqRow.filter) {
      const filterData = reqRow.filter as any;
      const createdFilter = await prisma.publicFilter.create({
        data: {
          name: filterData.name,
          emoji: filterData.emoji || '📷',
          adjustments: filterData.adjustments || {},
          css: typeof filterData.css === 'string' ? filterData.css : null,
          description: filterData.description || `Custom filter: ${filterData.name}`,
          ownerUid: reqRow.userUid,
          ownerName: reqRow.userDisplayName,
          sortOrder: 0,
          active: true,
        },
      });
      publicId = createdFilter.id;
    } else if (reqRow.type === 'background' && reqRow.background) {
      const bgData = reqRow.background as any;
      const createdBg = await prisma.publicBackground.create({
        data: {
          name: bgData.name,
          type: bgData.type || 'upload',
          src: typeof bgData.src === 'string' ? bgData.src : null,
          ownerUid: reqRow.userUid,
          ownerName: reqRow.userDisplayName,
        },
      });
      publicId = createdBg.id;
    } else if (reqRow.frame) {
      const frameData = reqRow.frame as any;
      let layout: 'strip-2' | 'strip-3' | 'strip-4' | 'grid-2x2' = 'strip-4';
      let photoCount = 4;
      let aspectRatio = 4 / 3;

      if (frameData.config?.elements && Array.isArray(frameData.config.elements)) {
        const photos = frameData.config.elements.filter((e: any) => e.type === 'photo');
        photoCount = photos.length || 4;
        if (photoCount === 1 || photoCount === 2) {
          layout = 'strip-2';
          aspectRatio = 4 / 3;
        } else if (photoCount === 3) {
          layout = 'strip-3';
          aspectRatio = 4 / 3;
        } else if (photoCount === 4) {
          const first = photos[0];
          const second = photos[1];
          if (second && Math.abs(first.y - second.y) < 50) {
            layout = 'grid-2x2';
            aspectRatio = 1;
          } else {
            layout = 'strip-4';
            aspectRatio = 4 / 3;
          }
        }
      }

      const createdFrame = await prisma.publicFrame.create({
        data: {
          name: frameData.name,
          description: `Custom frame: ${frameData.name}`,
          layout: toPrismaLayout(layout),
          photoCount,
          aspectRatio,
          color: frameData.config?.color || '#f5f0e8',
          borderColor: frameData.config?.borderColor || '#1a1410',
          accentColor: frameData.config?.accentColor || '#c9a84c',
          emoji: frameData.emoji || '🎨',
          ownerUid: reqRow.userUid,
          ownerName: reqRow.userDisplayName || 'Anonymous',
          config: frameData.config || null,
          sortOrder: 0,
          active: true,
        },
      });
      publicId = createdFrame.id;
    } else {
      return jsonError('Invalid publish request: missing asset data', 400);
    }

    await prisma.publishRequest.update({
      where: { id },
      data: { status: 'approved' },
    });

    return NextResponse.json({
      success: true,
      publicId,
    });
  } catch (error: any) {
    console.error('Failed to approve publish request:', error);
    return jsonError(error.message || 'Failed to approve request', 500);
  }
}
