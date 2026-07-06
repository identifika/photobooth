import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { verifyIdToken } from '@/lib/auth-server';

const UploadRequestSchema = z.object({
  image: z.string().min(1, "Missing image data"),
  sessionId: z.string().optional(),
  filename: z.string().optional(),
  prefix: z.string().optional(),
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
    const result = UploadRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues?.[0]?.message || 'Validation failed' }, { status: 400 });
    }

    const user = await verifyIdToken(request.headers.get('Authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, sessionId, filename: customFilename, prefix } = result.data;

    // Parse base64
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid base64 string' }, { status: 400 });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    
    // Only allow PNG, JPEG, and GIF to prevent weird uploads
    if (!['image/png', 'image/gif', 'image/jpeg'].includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = contentType === 'image/gif' ? 'gif' : contentType === 'image/jpeg' ? 'jpg' : 'png';
    const finalFilename = customFilename || `${uuidv4()}.${extension}`;
    const key = [prefix, sessionId, finalFilename].filter(Boolean).join('/');
    const bucket = process.env.S3_BUCKET_NAME;

    // Retry S3 upload up to 3 times with exponential backoff (handles ECONNRESET / transient network drops)
    const MAX_RETRIES = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        lastError = null;
        break; // success — exit retry loop
      } catch (err: any) {
        lastError = err;
        const isRetryable = err?.code === 'ECONNRESET' || err?.name === 'NetworkError' ||
          err?.message?.includes('ECONNRESET') || err?.message?.includes('aborted') ||
          err?.message?.includes('socket hang up');
        if (!isRetryable || attempt === MAX_RETRIES - 1) throw err;
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        console.warn(`S3 upload attempt ${attempt + 1} failed (${err?.code}), retrying...`);
      }
    }
    if (lastError) throw lastError;

    const cdnUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/${bucket}/${key}`;

    return NextResponse.json({ url: cdnUrl });
  } catch (error: any) {
    const code = error?.code ?? error?.name ?? 'unknown';
    console.error(`Upload failed [${code}]:`, error);
    return NextResponse.json({ error: 'Upload failed', code }, { status: 500 });
  }
}
