
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

    const { sessionId } = result.data;

    const bucket = process.env.S3_BUCKET_NAME;

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${sessionId}/`,
    });

    const response = await s3.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      return NextResponse.json({ error: 'Session not found or empty' }, { status: 404 });
    }

    const baseUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/${bucket}`;
    
    // Sort so strip is first, then photos, then live clips
    const items = response.Contents.map(item => ({
      key: item.Key!,
      url: `${baseUrl}/${item.Key}`,
      size: item.Size,
      lastModified: item.LastModified,
    })).sort((a, b) => {
      // Prioritize strip
      if (a.key.includes('strip.png')) return -1;
      if (b.key.includes('strip.png')) return 1;
      if (a.key.includes('strip.gif')) return -1;
      if (b.key.includes('strip.gif')) return 1;
      // Sort alphabetically for others
      return a.key.localeCompare(b.key);
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list session:', error);
    return NextResponse.json({ error: 'Failed to retrieve session contents' }, { status: 500 });
  }
}
