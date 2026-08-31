import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEvent, getEventById, getEventBySlug, listUserEvents, type BoothEvent } from '@/lib/events';
import { verifyAuthOrApiKey } from '@/lib/auth-server';
import { generateQrDataUrl } from '@/lib/qr-helper';

const CreateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  slug: z.string().optional(),
  tagline: z.string().optional(),
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
 * Creates a new event and returns full URLs & QR code
 * Authenticate via:
 * - Header: x-api-key: pk_live_... (or Authorization: Bearer pk_live_...)
 * - Header: Authorization: Bearer <firebase_jwt>
 * - Query: ?apiKey=...
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = CreateEventSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const authContext = await verifyAuthOrApiKey(request);
    const uid = authContext?.uid || 'api-host';
    const hostEmail = authContext?.isApiKey ? (authContext.keyName || 'API Key User') : 'authenticated-user';

    const eventData = result.data;
    const eventId = await createEvent(uid, hostEmail, {
      name: eventData.name,
      slug: eventData.slug || '',
      tagline: eventData.tagline,
      eventDate: eventData.eventDate || new Date().toISOString().split('T')[0],
      venue: eventData.venue,
      primaryFrameId: eventData.primaryFrameId || '',
      frameIds: eventData.frameIds || [],
      allowFrameSelection: eventData.allowFrameSelection ?? true,
      mode: eventData.mode || 'hybrid',
      enableLiveGallery: eventData.enableLiveGallery ?? true,
      requirePasscode: eventData.requirePasscode,
      customLogoUrl: eventData.customLogoUrl,
      themeColor: eventData.themeColor || '#e11d48',
      customMessage: eventData.customMessage,
      hashtag: eventData.hashtag,
      wifiSsid: eventData.wifiSsid,
      wifiPassword: eventData.wifiPassword,
      active: eventData.active ?? true,
    });

    const createdEvent = await getEventById(eventId);
    if (!createdEvent) {
      return NextResponse.json({ error: 'Failed to retrieve created event' }, { status: 500 });
    }

    const baseUrl = getBaseUrl(request);
    const formatted = await formatEventWithUrls(createdEvent, baseUrl);

    return NextResponse.json({
      success: true,
      event: formatted,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create event via API:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 });
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
      const event = await getEventBySlug(slug);
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      const formatted = await formatEventWithUrls(event, baseUrl);
      return NextResponse.json({ success: true, event: formatted });
    }

    if (id) {
      const event = await getEventById(id);
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      const formatted = await formatEventWithUrls(event, baseUrl);
      return NextResponse.json({ success: true, event: formatted });
    }

    // List events if authorized (Firebase Token or API Key)
    const authContext = await verifyAuthOrApiKey(request);
    if (!authContext) {
      return NextResponse.json({ error: 'Provide ?slug=..., ?id=..., or authenticate via x-api-key / Bearer token' }, { status: 400 });
    }

    const events = await listUserEvents(authContext.uid);
    const formattedEvents = await Promise.all(events.map((e) => formatEventWithUrls(e, baseUrl)));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
    });
  } catch (error: any) {
    console.error('Failed to get events:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}
