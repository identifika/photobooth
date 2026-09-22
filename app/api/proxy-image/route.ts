import { NextResponse } from 'next/server';

/**
 * Proxy route to fetch external images server-side.
 * This allows the browser to load images as same-origin data,
 * preventing canvas CORS taint when compositing backgrounds and strips.
 *
 * Usage:
 * - POST /api/proxy-image with { url: <encoded-url> }
 * - GET /api/proxy-image?url=<encoded-url>
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function jsonResponse(data: Record<string, unknown>, status: number) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Checks if a hostname or URL points to a private/internal IP address (SSRF check).
 */
function isPrivateOrLocalUrl(targetUrl: URL): boolean {
  const host = targetUrl.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 private ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return false;
}

/**
 * Validates if the target URL is allowed to be proxied.
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (isPrivateOrLocalUrl(parsed)) {
      return false;
    }

    // Configured origins
    const cdnBase = process.env.NEXT_PUBLIC_CDN_URL ?? '';
    const s3Endpoint = process.env.S3_ENDPOINT ?? '';
    const nextPublicS3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT ?? '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    const allowedPrefixes = [
      cdnBase,
      s3Endpoint,
      nextPublicS3Endpoint,
      appUrl,
      'https://app.pikabooth.web.id',
      'https://pikabooth.web.id',
      'https://firebasestorage.googleapis.com',
      'https://storage.googleapis.com',
      'https://lh3.googleusercontent.com',
      'https://images.unsplash.com',
    ].filter(Boolean).map(p => p.replace(/\/$/, ''));

    const isExplicitlyAllowed = allowedPrefixes.some(prefix => urlString.startsWith(prefix));
    if (isExplicitlyAllowed) {
      return true;
    }

    // Allow firebase storage app domains (*.firebasestorage.app)
    if (parsed.hostname.endsWith('.firebasestorage.app')) {
      return true;
    }

    // Allow public HTTPS image requests that do not target private/internal networks
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function handleProxy(url: string | null | undefined) {
  if (!url) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  if (!isAllowedUrl(url)) {
    return jsonResponse({ error: 'URL not allowed' }, 403);
  }

  try {
    const res = await fetch(url, {
      cache: 'force-cache',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return jsonResponse({ error: `Upstream error: ${res.status}` }, 502);
    }

    let contentType = res.headers.get('content-type');
    if (!contentType || contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
      const cleanUrl = url.split('?')[0].toLowerCase();
      if (cleanUrl.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (cleanUrl.endsWith('.png')) {
        contentType = 'image/png';
      } else if (cleanUrl.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (cleanUrl.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      } else {
        contentType = 'image/jpeg';
      }
    }

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('[proxy-image] error:', err?.message ?? err);
    return jsonResponse({ error: 'Failed to fetch image' }, 500);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleProxy(body?.url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleProxy(searchParams.get('url'));
}
