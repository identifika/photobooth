import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

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
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Parse base64
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid base64 string' }, { status: 400 });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    
    // Only allow PNG and GIF to prevent weird uploads
    if (!['image/png', 'image/gif'].includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = contentType === 'image/gif' ? 'gif' : 'png';
    const filename = `${uuidv4()}.${extension}`;
    const bucket = process.env.S3_BUCKET_NAME;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const cdnUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/${bucket}/${filename}`;

    return NextResponse.json({ url: cdnUrl });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
