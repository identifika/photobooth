
import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { z } from 'zod';

const ShareRequestSchema = z.object({
  sessionId: z.string().min(1).refine(val => !val.includes('/') && !val.includes('..'), {
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

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = ShareRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues?.[0]?.message || 'Validation failed' }, { status: 400 });
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

    const response = await s3.send(command);
    
    // Return empty list instead of 404 if no photos yet (prevents red console errors in gallery)
    if (!response.Contents || response.Contents.length === 0) {
      return NextResponse.json({ items: [] });
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

    // Sort: for events, show newest captures first; for single session, strip first
    items.sort((a, b) => {
      if (sessionId.startsWith('evt-')) {
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

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list session:', error);
    return NextResponse.json({ error: 'Failed to retrieve session contents' }, { status: 500 });
  }
}
