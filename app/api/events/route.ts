import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyAuthOrApiKey, getSessionUser, jsonError } from '@/lib/auth-server';
import { generateQrDataUrl } from '@/lib/qr-helper';
import { slugify, type BoothEvent } from '@/lib/events';
import { formatBoothEvent } from '@/lib/event-converters';
import type { EventMode } from '@/lib/generated/prisma/enums';

const CreateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
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

/**
 * POST /api/events
 * Creates or updates an event in Postgres and returns full URLs & QR code
 */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const result = CreateEventSchema.safeParse(json);

    if (!result.success) {
      return jsonError(result.error.issues?.[0]?.message || 'Validation failed', 400);
    }

    const authContext = await verifyAuthOrApiKey(request);
    const sessionUser = await getSessionUser(request);
    const uid = sessionUser?.uid || authContext?.uid;
    if (!uid) {
      return jsonError('Unauthorized: please sign in or provide a valid API key', 401);
    }

    const hostEmail = sessionUser?.email || (authContext?.isApiKey ? (authContext.keyName || 'API Key User') : 'authenticated-user');
    const eventData = result.data;
    const targetSlug = slugify(eventData.slug || eventData.name || 'event');

    // Check if an event with this slug already exists
    const existing = await prisma.event.findUnique({ where: { slug: targetSlug } });

    let eventRow;
    if (existing) {
      // If user doesn't own it and isn't admin/api key, error
      if (!sessionUser?.isAdmin && !authContext?.isApiKey && existing.hostUid !== uid) {
        return jsonError('This event URL slug is already taken by another user', 409);
      }

      eventRow = await prisma.event.update({
        where: { id: existing.id },
        data: {
          name: eventData.name,
          tagline: eventData.tagline ?? existing.tagline,
          brideName: eventData.brideName ?? existing.brideName,
          groomName: eventData.groomName ?? existing.groomName,
          eventDate: eventData.eventDate ?? existing.eventDate,
          venue: eventData.venue ?? existing.venue,
          primaryFrameId: eventData.primaryFrameId ?? existing.primaryFrameId,
          frameIds: eventData.frameIds ?? existing.frameIds,
          allowFrameSelection: eventData.allowFrameSelection ?? existing.allowFrameSelection,
          mode: (eventData.mode as EventMode) ?? existing.mode,
          enableLiveGallery: eventData.enableLiveGallery ?? existing.enableLiveGallery,
          requirePasscode: eventData.requirePasscode ?? existing.requirePasscode,
          customLogoUrl: eventData.customLogoUrl ?? existing.customLogoUrl,
          themeColor: eventData.themeColor ?? existing.themeColor,
          customMessage: eventData.customMessage ?? existing.customMessage,
          hashtag: eventData.hashtag ?? existing.hashtag,
          wifiSsid: eventData.wifiSsid ?? existing.wifiSsid,
          wifiPassword: eventData.wifiPassword ?? existing.wifiPassword,
          active: eventData.active ?? existing.active,
        },
      });
    } else {
      eventRow = await prisma.event.create({
        data: {
          slug: targetSlug,
          name: eventData.name,
          tagline: eventData.tagline ?? null,
          brideName: eventData.brideName ?? null,
          groomName: eventData.groomName ?? null,
          hostUid: uid,
          hostEmail,
          eventDate: eventData.eventDate || new Date().toISOString().split('T')[0],
          venue: eventData.venue ?? null,
          primaryFrameId: eventData.primaryFrameId || '',
          frameIds: eventData.frameIds || [],
          allowFrameSelection: eventData.allowFrameSelection ?? true,
          mode: (eventData.mode as EventMode) || 'hybrid',
          enableLiveGallery: eventData.enableLiveGallery ?? true,
          requirePasscode: eventData.requirePasscode ?? null,
          customLogoUrl: eventData.customLogoUrl ?? null,
          themeColor: eventData.themeColor || '#e11d48',
          customMessage: eventData.customMessage ?? null,
          hashtag: eventData.hashtag ?? null,
          wifiSsid: eventData.wifiSsid ?? null,
          wifiPassword: eventData.wifiPassword ?? null,
          active: eventData.active ?? true,
        },
      });
    }

    const formattedEvent = formatBoothEvent(eventRow);
    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(formattedEvent, baseUrl);

    return NextResponse.json({
      success: true,
      event: formatted,
    }, { status: existing ? 200 : 201 });
  } catch (error: any) {
    console.error('Failed to create event via API:', error);
    return jsonError(error.message || 'Failed to create event', 500);
  }
}

/**
 * GET /api/events
 * Query an event by `?slug=...` or `?id=...`, or list events for authenticated user / API key
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');
    const baseUrl = getBaseUrl(request);

    if (slug) {
      const eventRow = await prisma.event.findUnique({
        where: { slug: slug.toLowerCase().trim() },
      });
      if (!eventRow) {
        return jsonError('Event not found', 404);
      }
      const formatted = await formatEventWithUrls(formatBoothEvent(eventRow), baseUrl);
      return NextResponse.json({ success: true, event: formatted });
    }

    if (id) {
      const eventRow = await prisma.event.findUnique({ where: { id } });
      if (!eventRow) {
        return jsonError('Event not found', 404);
      }
      const formatted = await formatEventWithUrls(formatBoothEvent(eventRow), baseUrl);
      return NextResponse.json({ success: true, event: formatted });
    }

    // List events if authorized
    const authContext = await verifyAuthOrApiKey(request);
    const sessionUser = await getSessionUser(request);
    const uid = sessionUser?.uid || authContext?.uid;

    if (!uid) {
      return jsonError('Provide ?slug=..., ?id=..., or authenticate via x-api-key / Bearer token', 400);
    }

    const rows = await prisma.event.findMany({
      where: sessionUser?.isAdmin ? undefined : { hostUid: uid },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedEvents = await Promise.all(
      rows.map((row) => formatEventWithUrls(formatBoothEvent(row), baseUrl))
    );

    return NextResponse.json({
      success: true,
      events: formattedEvents,
    });
  } catch (error: any) {
    console.error('Failed to get events:', error);
    return jsonError(error.message || 'Failed to fetch events', 500);
  }
}
