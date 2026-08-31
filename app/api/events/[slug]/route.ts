import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEventBySlug, getEventById, type BoothEvent } from '@/lib/events';
import { fsUpdateDocument } from '@/lib/firestore';
import { verifyAuthOrApiKey } from '@/lib/auth-server';
import { generateQrDataUrl } from '@/lib/qr-helper';

const UpdateEventSchema = z.object({
  name: z.string().min(1).optional(),
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
 * GET /api/events/[slug]
 * Fetches event by slug and returns all formatted URLs & QR code
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(event, baseUrl);

    return NextResponse.json({
      success: true,
      event: formatted,
    });
  } catch (error: any) {
    console.error('Failed to get event by slug:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/events/[slug]
 * Updates event settings, including chosen frames (primaryFrameId, frameIds, allowFrameSelection)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const authContext = await verifyAuthOrApiKey(request);
    if (!authContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check ownership if not master/API key
    if (!authContext.isApiKey && authContext.uid !== event.hostUid) {
      return NextResponse.json({ error: 'Forbidden: you do not own this event' }, { status: 403 });
    }

    const json = await request.json();
    const result = UpdateEventSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const cleanUpdateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result.data)) {
      if (v !== undefined) {
        cleanUpdateData[k] = v;
      }
    }

    await fsUpdateDocument(`events/${event.id}`, cleanUpdateData);

    const updatedEvent = await getEventById(event.id);
    if (!updatedEvent) {
      return NextResponse.json({ error: 'Failed to reload updated event' }, { status: 500 });
    }

    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(updatedEvent, baseUrl);

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
      event: formatted,
    });
  } catch (error: any) {
    console.error('Failed to update event:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
