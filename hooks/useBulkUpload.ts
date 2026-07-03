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

  const handleUpload = async () => {
    if (!stripDataUrl) return;
    setUploading(true);
    try {
      const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

      const uploadPromises = [];

      // Upload strip
      uploadPromises.push(
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: stripDataUrl, sessionId, filename: 'strip.png' }),
        }).then(r => r.json())
      );

      // Upload GIF
      if (gifDataUrl) {
        uploadPromises.push(
          fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: gifDataUrl, sessionId, filename: 'strip.gif' }),
          }).then(r => r.json())
        );
      }

      // Upload Polaroids
      if (polaroidDataUrls && polaroidDataUrls.length > 0) {
        polaroidDataUrls.forEach((pUrl, i) => {
          uploadPromises.push(
            fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: pUrl, sessionId, filename: `photo_${i + 1}.png` }),
            }).then(r => r.json())
          );
        });
      }

      // Upload live clips
      if (liveClipGifs && liveClipGifs.length > 0) {
        liveClipGifs.forEach((gUrl, i) => {
          if (gUrl && gUrl !== 'pending' && gUrl !== 'error') {
            uploadPromises.push(
              fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: gUrl, sessionId, filename: `live_${i + 1}.gif` }),
              }).then(r => r.json())
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
      alert('Failed to upload images.');
    } finally {
      setUploading(false);
    }
  };

  return { handleUpload, uploading, internalUploadedUrl };
}
