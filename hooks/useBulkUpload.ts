import { useState } from 'react';

interface UseBulkUploadProps {
  stripDataUrl: string;
  gifDataUrl: string;
  polaroidDataUrls: string[];
  liveClipGifs: (string | null | 'pending' | 'error')[];
  onUploadComplete?: (url: string) => void;
}

export function useBulkUpload({
  stripDataUrl,
  gifDataUrl,
  polaroidDataUrls,
  liveClipGifs,
  onUploadComplete,
}: UseBulkUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [internalUploadedUrl, setInternalUploadedUrl] = useState<string | undefined>();

  /** Upload a single image with automatic retry on network/5xx errors. */
  const uploadWithRetry = async (body: object, retries = 3): Promise<any> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        // Retry on server errors (502/503/504/500 with ECONNRESET code)
        if (res.status >= 500) {
          const data = await res.json().catch(() => ({}));
          lastErr = new Error(data.error ?? `HTTP ${res.status}`);
          if (attempt < retries - 1) {
            await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt)));
            console.warn(`Upload attempt ${attempt + 1} got ${res.status}, retrying...`);
            continue;
          }
          throw lastErr;
        }
        return res.json();
      } catch (err: any) {
        lastErr = err;
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt)));
          console.warn(`Upload attempt ${attempt + 1} failed (${err?.message}), retrying...`);
        }
      }
    }
    throw lastErr;
  };

  const handleUpload = async () => {
    if (!stripDataUrl) return;
    setUploading(true);
    try {
      const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

      const uploadPromises = [];

      // Upload strip (required)
      uploadPromises.push(
        uploadWithRetry({ image: stripDataUrl, sessionId, filename: 'strip.png' })
      );

      // Upload GIF
      if (gifDataUrl) {
        uploadPromises.push(
          uploadWithRetry({ image: gifDataUrl, sessionId, filename: 'strip.gif' })
        );
      }

      // Upload Polaroids
      if (polaroidDataUrls && polaroidDataUrls.length > 0) {
        polaroidDataUrls.forEach((pUrl, i) => {
          uploadPromises.push(
            uploadWithRetry({ image: pUrl, sessionId, filename: `photo_${i + 1}.png` })
          );
        });
      }

      // Upload live clips
      if (liveClipGifs && liveClipGifs.length > 0) {
        liveClipGifs.forEach((gUrl, i) => {
          if (gUrl && gUrl !== 'pending' && gUrl !== 'error') {
            uploadPromises.push(
              uploadWithRetry({ image: gUrl, sessionId, filename: `live_${i + 1}.gif` })
            );
          }
        });
      }

      const results = await Promise.all(uploadPromises);
      const stripResult = results[0];

      if (!stripResult || stripResult.error) throw new Error('Upload failed');
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const shareUrl = `${appUrl}/share?s=${sessionId}`;

      if (onUploadComplete) {
        onUploadComplete(shareUrl);
      } else {
        setInternalUploadedUrl(shareUrl);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return { handleUpload, uploading, internalUploadedUrl };
}
