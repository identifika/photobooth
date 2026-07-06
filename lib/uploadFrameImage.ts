import { getClientAuthToken } from './auth-client';

const BUCKET_NAME = 'photobooth';

/**
 * Uploads an image file to S3 under a per-purpose, per-user
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

  // Fetch the presigned URL from our API route instead of building it client-side
  const token = await getClientAuthToken();
  const presignRes = await fetch('/api/presign', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      filename: path,
      contentType: file.type || 'application/octet-stream',
    }),
  });

  if (!presignRes.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { url: presignedUrl, bucket } = await presignRes.json();

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
    // Ensure no trailing slash in CDN URL before joining.
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, '');
    return `${cdnUrl}/${bucket}/${path}`;
  }

  // Fallback if no CDN is configured
  const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT || '';
  const cleanEndpoint = s3Endpoint.replace(/\/$/, '');
  return `${cleanEndpoint}/${bucket}/${path}`;
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
