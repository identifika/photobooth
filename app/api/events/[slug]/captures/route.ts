import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/auth-server';
import { formatEventCapture } from '@/lib/event-converters';

/**
 * GET /api/events/[slug]/captures
 * Returns event captures ordered newest first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return jsonError('Slug is required', 400);

    const cleanSlug = slug.toLowerCase().trim();
    let event = await prisma.event.findUnique({ where: { slug: cleanSlug } });
    if (!event) {
      // Allow passing eventId as fallback
      event = await prisma.event.findUnique({ where: { id: slug } });
    }

    if (!event) {
      return jsonError('Event not found', 404);
    }

    const rows = await prisma.eventCapture.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
    });

    const captures = rows.map(formatEventCapture);

    return NextResponse.json({
      success: true,
      count: captures.length,
      captures,
    });
  } catch (error: any) {
    console.error('Failed to get event captures:', error);
    return jsonError(error.message || 'Internal error', 500);
  }
}

/**
 * POST /api/events/[slug]/captures
 * Creates a new event capture.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return jsonError('Slug is required', 400);

    const cleanSlug = slug.toLowerCase().trim();
    let event = await prisma.event.findUnique({ where: { slug: cleanSlug } });
    if (!event) {
      event = await prisma.event.findUnique({ where: { id: slug } });
    }

    if (!event) {
      return jsonError('Event not found', 404);
    }

    const body = await request.json().catch(() => ({}));
    const { sessionId, stripUrl, gifUrl, photoUrls = [], liveClipUrls = [] } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return jsonError('Session ID is required', 400);
    }
    if (!stripUrl || typeof stripUrl !== 'string') {
      return jsonError('Strip URL is required', 400);
    }

    const newCapture = await prisma.eventCapture.create({
      data: {
        eventId: event.id,
        eventSlug: event.slug,
        sessionId,
        stripUrl,
        gifUrl: typeof gifUrl === 'string' ? gifUrl : null,
        photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
        liveClipUrls: Array.isArray(liveClipUrls) ? liveClipUrls : [],
      },
    });

    return NextResponse.json({
      success: true,
      id: newCapture.id,
      capture: formatEventCapture(newCapture),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to record event capture:', error);
    return jsonError(error.message || 'Failed to record capture', 500);
  }
}
