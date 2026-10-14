import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyAuthOrApiKey, getSessionUser, jsonError } from '@/lib/auth-server';
import { generateQrDataUrl } from '@/lib/qr-helper';
import { slugify, type BoothEvent } from '@/lib/events';
import { formatBoothEvent } from '@/lib/event-converters';
import type { EventMode } from '@/lib/generated/prisma/enums';

const UpdateEventSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  tagline: z.string().optional(),
  brideName: z.string().optional(),
  groomName: z.string().optional(),
  eventDate: z.string().optional(),
  venue: z.string().optional(),
  primaryFrameId: z.string().optional(),
  frameIds: z.array(z.string()).optional(),
  allowFrameSelection: z.boolean().optional(),
  mode: z.enum(['kiosk', 'guest_mobile', 'hybrid']).optional(),
  enableLiveGallery: z.boolean().optional(),
  requirePasscode: z.string().optional(),
  customLogoUrl: z.string().optional(),
  themeColor: z.string().optional(),
  customMessage: z.string().optional(),
  hashtag: z.string().optional(),
  wifiSsid: z.string().optional(),
  wifiPassword: z.string().optional(),
  active: z.boolean().optional(),
});

function getBaseUrl(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'https://pikabooth.app';
}

async function formatEventWithUrls(event: BoothEvent, baseUrl: string) {
  const boothUrl = `${baseUrl}/e/${event.slug}`;
  const kioskUrl = `${baseUrl}/e/${event.slug}?mode=kiosk`;
  const galleryUrl = `${baseUrl}/e/${event.slug}/gallery`;
  const qrStudioUrl = `${baseUrl}/events/${event.id}/qr`;

  const qrCodeDataUrl = await generateQrDataUrl(boothUrl, {
    width: 512,
    color: {
      dark: event.themeColor || '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'Q',
  });

  return {
    ...event,
    urls: {
      boothUrl,
      kioskUrl,
      galleryUrl,
      qrStudioUrl,
      qrCodeDataUrl,
    },
  };
}

async function findEventBySlugOrId(slugOrId: string) {
  const clean = slugOrId.toLowerCase().trim();
  const bySlug = await prisma.event.findUnique({ where: { slug: clean } });
  if (bySlug) return bySlug;
  return prisma.event.findUnique({ where: { id: slugOrId } });
}

/**
 * GET /api/events/[slug]
 * Fetches event by slug or id and returns formatted URLs & QR code
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return jsonError('Slug is required', 400);

    const eventRow = await findEventBySlugOrId(slug);
    if (!eventRow) {
      return jsonError('Event not found', 404);
    }

    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(formatBoothEvent(eventRow), baseUrl);

    return NextResponse.json({
      success: true,
      event: formatted,
    });
  } catch (error: any) {
    console.error('Failed to get event by slug:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * PATCH /api/events/[slug]
 * Updates event settings in Postgres.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return jsonError('Slug is required', 400);

    const authContext = await verifyAuthOrApiKey(request);
    const sessionUser = await getSessionUser(request);
    const uid = sessionUser?.uid || authContext?.uid;

    if (!uid) {
      return jsonError('Unauthorized', 401);
    }

    const eventRow = await findEventBySlugOrId(slug);
    if (!eventRow) {
      return jsonError('Event not found', 404);
    }

    // Check ownership if not admin/master API key
    if (!sessionUser?.isAdmin && !authContext?.isApiKey && authContext?.uid !== eventRow.hostUid) {
      return jsonError('Forbidden: you do not own this event', 403);
    }

    const json = await request.json().catch(() => ({}));
    const result = UpdateEventSchema.safeParse(json);

    if (!result.success) {
      return jsonError(result.error.issues?.[0]?.message || 'Validation failed', 400);
    }

    const data = result.data;
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) {
      const newSlug = slugify(data.slug);
      if (newSlug !== eventRow.slug) {
        const taken = await prisma.event.findUnique({ where: { slug: newSlug } });
        if (taken && taken.id !== eventRow.id) {
          return jsonError('This event URL slug is already taken. Please choose another.', 409);
        }
        updateData.slug = newSlug;
      }
    }
    if (data.tagline !== undefined) updateData.tagline = data.tagline;
    if (data.brideName !== undefined) updateData.brideName = data.brideName;
    if (data.groomName !== undefined) updateData.groomName = data.groomName;
    if (data.eventDate !== undefined) updateData.eventDate = data.eventDate;
    if (data.venue !== undefined) updateData.venue = data.venue;
    if (data.primaryFrameId !== undefined) updateData.primaryFrameId = data.primaryFrameId;
    if (data.frameIds !== undefined) updateData.frameIds = data.frameIds;
    if (data.allowFrameSelection !== undefined) updateData.allowFrameSelection = data.allowFrameSelection;
    if (data.mode !== undefined) updateData.mode = data.mode as EventMode;
    if (data.enableLiveGallery !== undefined) updateData.enableLiveGallery = data.enableLiveGallery;
    if (data.requirePasscode !== undefined) updateData.requirePasscode = data.requirePasscode;
    if (data.customLogoUrl !== undefined) updateData.customLogoUrl = data.customLogoUrl;
    if (data.themeColor !== undefined) updateData.themeColor = data.themeColor;
    if (data.customMessage !== undefined) updateData.customMessage = data.customMessage;
    if (data.hashtag !== undefined) updateData.hashtag = data.hashtag;
    if (data.wifiSsid !== undefined) updateData.wifiSsid = data.wifiSsid;
    if (data.wifiPassword !== undefined) updateData.wifiPassword = data.wifiPassword;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await prisma.event.update({
      where: { id: eventRow.id },
      data: updateData,
    });

    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(formatBoothEvent(updated), baseUrl);

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
      event: formatted,
    });
  } catch (error: any) {
    console.error('Failed to update event:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * DELETE /api/events/[slug]
 * Deletes an event. Owner or admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return jsonError('Slug is required', 400);

    const sessionUser = await getSessionUser(request);
    const authContext = await verifyAuthOrApiKey(request);
    const uid = sessionUser?.uid || authContext?.uid;

    if (!uid) return jsonError('Unauthorized', 401);

    const eventRow = await findEventBySlugOrId(slug);
    if (!eventRow) return jsonError('Event not found', 404);

    if (!sessionUser?.isAdmin && !authContext?.isApiKey && eventRow.hostUid !== uid) {
      return jsonError('Forbidden: you do not own this event', 403);
    }

    await prisma.event.delete({ where: { id: eventRow.id } });

    return NextResponse.json({ success: true, message: 'Event deleted' });
  } catch (error: any) {
    console.error('Failed to delete event:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}
