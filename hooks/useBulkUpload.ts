import { useState } from 'react';
import { getClientAuthToken } from '@/lib/auth-client';

interface UseBulkUploadProps {
  stripDataUrl: string;
  gifDataUrl: string;
  polaroidDataUrls: string[];
  liveClipGifs: (string | null | 'pending' | 'error')[];
  sessionId?: string;
  eventId?: string;
  eventSlug?: string;
  onUploadComplete?: (url: string) => void;
}

export function useBulkUpload({
  stripDataUrl,
  gifDataUrl,
  polaroidDataUrls,
  liveClipGifs,
  sessionId: customSessionId,
  eventId,
  eventSlug,
  onUploadComplete,
}: UseBulkUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [internalUploadedUrl, setInternalUploadedUrl] = useState<string | undefined>();

  /** Upload a single image with automatic retry on network/5xx errors. */
  const uploadWithRetry = async (body: object, retries = 3): Promise<any> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const token = await getClientAuthToken();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
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
      const sessionId = customSessionId || (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));

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

      // If this upload is for an event, record to the event's captures subcollection
      if (eventId) {
        try {
          const { createEventCapture } = await import('@/lib/events');
          const photoUrls = results
            .filter((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('photo_'))
            .map((r: any) => r.url);
          const liveClipUrls = results
            .filter((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('live_'))
            .map((r: any) => r.url);
          const gifResult = results.find((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('strip.gif'));

          await createEventCapture(eventId, {
            eventId,
            eventSlug: eventSlug || '',
            sessionId,
            stripUrl: stripResult.url,
            gifUrl: gifResult?.url,
            photoUrls,
            liveClipUrls,
          });
        } catch (captureErr) {
          console.error('Failed to record capture in Firestore event subcollection:', captureErr);
        }
      }

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
