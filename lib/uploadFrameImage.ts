import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const minioClient = new S3Client({
  endpoint: `http${process.env.NEXT_PUBLIC_MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.NEXT_PUBLIC_MINIO_ENDPOINT}${process.env.NEXT_PUBLIC_MINIO_PORT && process.env.NEXT_PUBLIC_MINIO_PORT !== '80' && process.env.NEXT_PUBLIC_MINIO_PORT !== '443' ? ':' + process.env.NEXT_PUBLIC_MINIO_PORT : ''}`,
  region: 'us-east-1', // MinIO requires a region, us-east-1 is the standard default
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_MINIO_ACCESS_KEY || '',
    secretAccessKey: process.env.NEXT_PUBLIC_MINIO_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET_NAME = process.env.NEXT_PUBLIC_MINIO_BUCKET || 'photobooth';

/**
 * Uploads an image file to MinIO Storage under a per-purpose, per-user
 * (when available) path and returns its public download URL.
 *
 * @param file        The File object selected by the user
 * @param pathPrefix  Logical bucket folder, e.g. "frame-elements" or "frame-backgrounds"
 * @param ownerId     User ID to namespace uploads
 */
export async function uploadFrameImage(
  file: File,
  pathPrefix: 'frame-elements' | 'frame-backgrounds',
  ownerId: string = 'anonymous',
): Promise<string> {
  validateImageFile(file);

  const safeName = sanitizeFileName(file.name);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const path = `${pathPrefix}/${ownerId}/${uniqueName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
    ContentType: file.type || 'application/octet-stream',
    CacheControl: 'max-age=31536000, public',
  });

  // Generate a presigned URL instead of sending the file directly via the SDK.
  // This avoids signature mismatch errors caused by browser-injected headers or binary handling.
  const presignedUrl = await getSignedUrl(minioClient, command, { expiresIn: 3600 });

  // Use the native fetch API to upload the file to the presigned URL
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Cache-Control': 'max-age=31536000, public',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Upload failed with response:", errorText);
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  // Construct the public URL
  if (process.env.NEXT_PUBLIC_CDN_URL) {
    // If a CDN is configured (e.g., Cloudflare, CloudFront, etc.)
    // It is expected to point to the root of the bucket or wrap the MinIO server.
    // Ensure no trailing slash in CDN URL before joining.
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, '');
    return `${cdnUrl}/${BUCKET_NAME}/${path}`;
  }

  const protocol = process.env.NEXT_PUBLIC_MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const endpoint = process.env.NEXT_PUBLIC_MINIO_ENDPOINT;
  const port = process.env.NEXT_PUBLIC_MINIO_PORT;
  
  // If standard ports, don't include them in the URL to make it cleaner
  const portStr = (port && port !== '80' && port !== '443') ? `:${port}` : '';
  
  // pathStyle URLs look like: https://endpoint:port/bucket/key
  const url = `${protocol}://${endpoint}${portStr}/${BUCKET_NAME}/${path}`;
  
  return url;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB raw file cap
const ACCEPTED_MIME_PREFIXES = ['image/'];

function validateImageFile(file: File): void {
  if (!ACCEPTED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
    throw new Error('Only image files are allowed.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
      `Max allowed is ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB.`,
    );
  }
}

function sanitizeFileName(name: string): string {
  // Strip path separators and non-alphanumeric/dot/dash/underscore chars to keep paths safe.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}
