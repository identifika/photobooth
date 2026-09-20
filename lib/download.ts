import { Capacitor } from '@capacitor/core';

const isNativePlatform = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();

/**
 * Download a data URL or base64 string as a file.
 * Web: uses <a> download with Blob Object URL.
 * Native: uses Capacitor Filesystem + Share.
 */
export async function downloadFile(dataUrl: string, filename: string): Promise<void> {
  if (isNativePlatform()) {
    return nativeDownload(dataUrl, filename);
  }
  return webDownload(dataUrl, filename);
}

async function webDownload(dataUrl: string, filename: string): Promise<void> {
  let blobUrl: string | null = null;

  try {
    if (dataUrl.startsWith('data:') || dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
    } else {
      // Raw base64 fallback
      const byteCharacters = atob(dataUrl);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const mime = filename.endsWith('.gif')
        ? 'image/gif'
        : filename.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';
      const blob = new Blob([byteNumbers], { type: mime });
      blobUrl = URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('Failed to convert to blob URL, falling back to direct link:', err);
    blobUrl = null;
  }

  const a = document.createElement('a');
  a.href = blobUrl || dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }, 1000);
}

async function nativeDownload(dataUrl: string, filename: string): Promise<void> {
  // Extract base64 data and media type
  const { base64Data, mediaType } = parseDataUrl(dataUrl);

  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  // Write to cache directory
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });

  // Try to share/save via Share API
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: 'Pika Photobooth',
      text: 'Save your photobooth strip',
      url: result.uri,
      dialogTitle: 'Save Photo Strip',
    });
  } catch {
    // Share not available — open in browser as fallback
    window.open(dataUrl, '_blank');
  }
}

function parseDataUrl(dataUrl: string): { base64Data: string; mediaType: string } {
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { base64Data: match[2], mediaType: match[1] };
    }
  }
  // Assume raw base64
  return { base64Data: dataUrl, mediaType: 'image/png' };
}
