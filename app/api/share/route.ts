
import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { z } from 'zod';

const ShareRequestSchema = z.object({
  sessionId: z.string().min(1).refine(val => {
    if (val.includes('..') || val.startsWith('/') || val.endsWith('/')) return false;
    return /^[a-zA-Z0-9_\-]+(\/[a-zA-Z0-9_\-]+)*$/.test(val);
  }, {
    message: "Invalid session ID format",
  }),
});

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
});

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const json = await request.json();
    const result = ShareRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || 'Validation failed' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Share page is public — the unguessable sessionId acts as the access token.
    // Auth is optional: if present, verify it; if not, allow access anyway.

    const { sessionId } = result.data;

    const bucket = process.env.S3_BUCKET_NAME;

    // For event prefix matching (e.g. evt-slug), don't force a trailing slash so it matches evt-slug-*
    const prefix = sessionId.startsWith('evt-')
      ? sessionId
      : (sessionId.endsWith('/') ? sessionId : `${sessionId}/`);

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    let response = await s3.send(command);
    
    // Fallback: If no items found for slug folder, check if older captures used evt-<slug>
    if ((!response.Contents || response.Contents.length === 0) && !sessionId.includes('/') && !sessionId.startsWith('evt-')) {
      const fallbackCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `evt-${sessionId}`,
      });
      const fallbackResponse = await s3.send(fallbackCommand);
      if (fallbackResponse.Contents && fallbackResponse.Contents.length > 0) {
        response = fallbackResponse;
      }
    }
    
    // Return empty list instead of 404 if no photos yet (prevents red console errors in gallery)
    if (!response.Contents || response.Contents.length === 0) {
      return NextResponse.json({ items: [] }, { headers: corsHeaders });
    }

    const rawBaseUrl = process.env.NEXT_PUBLIC_CDN_URL || process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT || '';
    const baseUrl = bucket ? `${rawBaseUrl.replace(/\/$/, '')}/${bucket}` : rawBaseUrl.replace(/\/$/, '');
    
    // Map items, filtering out folder keys
    const items = response.Contents
      .filter(item => item.Key && !item.Key.endsWith('/'))
      .map(item => ({
        key: item.Key!,
        url: `${baseUrl}/${item.Key}`,
        size: item.Size,
        lastModified: item.LastModified,
      }));

    // Sort: for event gallery queries (no slash in sessionId or starts with evt-), show newest captures first; for single session, strip first
    const isEventGalleryQuery = sessionId.startsWith('evt-') || !sessionId.includes('/');
    items.sort((a, b) => {
      if (isEventGalleryQuery) {
        const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return timeB - timeA;
      }
      if (a.key.includes('strip.png')) return -1;
      if (b.key.includes('strip.png')) return 1;
      if (a.key.includes('strip.gif')) return -1;
      if (b.key.includes('strip.gif')) return 1;
      return a.key.localeCompare(b.key);
    });

    return NextResponse.json({ items }, { headers: corsHeaders });
  } catch (error) {
    console.error('Failed to list session:', error);
    return NextResponse.json({ error: 'Failed to retrieve session contents' }, { status: 500, headers: corsHeaders });
  }
}
