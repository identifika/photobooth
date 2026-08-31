import { NextResponse } from 'next/server';
import { getEventBySlug, type BoothEvent } from '@/lib/events';
import { generateQrDataUrl } from '@/lib/qr-helper';

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
