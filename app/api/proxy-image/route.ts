import { NextResponse } from 'next/server';

/**
 * Proxy route to fetch external images server-side.
 * This allows the browser to load images as same-origin data,
 * preventing canvas CORS taint when compositing backgrounds.
 *
 * Usage: POST /api/proxy-image with { url: <encoded-url> }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = body?.url;

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow fetching from trusted sources (S3 / CDN configured on the server)
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL ?? '';
  const s3Endpoint = process.env.S3_ENDPOINT ?? '';

  const allowedOrigins = [cdnBase, s3Endpoint].filter(Boolean);
  
  if (allowedOrigins.length === 0) {
    return NextResponse.json({ error: 'Server misconfigured: No allowed origins' }, { status: 500 });
  }
  
  const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));

  if (!isAllowed) {
    return NextResponse.json({ error: 'URL not from an allowed origin' }, { status: 403 });
  }

  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[proxy-image] error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
