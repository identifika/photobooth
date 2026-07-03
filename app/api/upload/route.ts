import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const UploadRequestSchema = z.object({
  image: z.string().min(1, "Missing image data"),
  sessionId: z.string().optional(),
  filename: z.string().optional(),
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

    const { image, sessionId, filename: customFilename } = result.data;

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
    const key = sessionId ? `${sessionId}/${finalFilename}` : finalFilename;
    const bucket = process.env.S3_BUCKET_NAME;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const cdnUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/${bucket}/${key}`;

    return NextResponse.json({ url: cdnUrl });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
