import { useState } from 'react';
import { getClientAuthToken } from '@/lib/auth-client';
import { getApiUrl, getSessionShareUrl } from '@/lib/api-config';

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
    const uploadUrl = getApiUrl('/api/upload');

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const token = await getClientAuthToken();
        const res = await fetch(uploadUrl, {
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

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
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

      // 1. Upload main strip first (essential for the share link)
      const stripResult = await uploadWithRetry({
        image: stripDataUrl,
        sessionId,
        filename: 'strip.png',
        ...(eventSlug ? { prefix: eventSlug } : {}),
      });

      if (!stripResult || stripResult.error) {
        throw new Error(stripResult?.error || 'Failed to upload photo strip');
      }

      // 2. Prepare secondary assets
      const secondaryUploadTasks: Array<() => Promise<any>> = [];

      // Upload GIF
      if (gifDataUrl) {
        secondaryUploadTasks.push(() =>
          uploadWithRetry({
            image: gifDataUrl,
            sessionId,
            filename: 'strip.gif',
            ...(eventSlug ? { prefix: eventSlug } : {}),
          })
        );
      }

      // Upload Polaroids
      if (polaroidDataUrls && polaroidDataUrls.length > 0) {
        polaroidDataUrls.forEach((pUrl, i) => {
          secondaryUploadTasks.push(() =>
            uploadWithRetry({
              image: pUrl,
              sessionId,
              filename: `photo_${i + 1}.png`,
              ...(eventSlug ? { prefix: eventSlug } : {}),
            })
          );
        });
      }

      // Upload live clips
      if (liveClipGifs && liveClipGifs.length > 0) {
        liveClipGifs.forEach((gUrl, i) => {
          if (gUrl && gUrl !== 'pending' && gUrl !== 'error') {
            secondaryUploadTasks.push(() =>
              uploadWithRetry({
                image: gUrl,
                sessionId,
                filename: `live_${i + 1}.gif`,
                ...(eventSlug ? { prefix: eventSlug } : {}),
              })
            );
          }
        });
      }

      // Run secondary uploads in controlled batches of 2 to avoid mobile WebView memory spikes
      const secondaryResults: any[] = [];
      const BATCH_SIZE = 2;
      for (let i = 0; i < secondaryUploadTasks.length; i += BATCH_SIZE) {
        const batch = secondaryUploadTasks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(fn => fn().catch(err => {
          console.warn('Secondary asset upload warning:', err);
          return null;
        })));
        secondaryResults.push(...batchResults);
      }

      const allResults = [stripResult, ...secondaryResults];
      const shareSessionKey = eventSlug ? `${eventSlug}/${sessionId}` : sessionId;
      const shareUrl = getSessionShareUrl(shareSessionKey);

      // If this upload is for an event, record to the event's captures subcollection
      if (eventId) {
        try {
          const { createEventCapture } = await import('@/lib/events');
          const photoUrls = allResults
            .filter((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('photo_'))
            .map((r: any) => r.url);
          const liveClipUrls = allResults
            .filter((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('live_'))
            .map((r: any) => r.url);
          const gifResult = allResults.find((r: any) => r?.url && typeof r.url === 'string' && r.url.includes('strip.gif'));

          await createEventCapture(eventId, {
            eventId,
            eventSlug: eventSlug || '',
            sessionId: shareSessionKey,
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
    } catch (err: any) {
      console.error('Upload process failed:', err);
      alert(err?.message ? `Upload failed: ${err.message}` : 'Upload failed. Please check your network connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return { handleUpload, uploading, internalUploadedUrl };
}
