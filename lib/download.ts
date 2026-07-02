const IS_NATIVE = typeof window !== 'undefined' && ('Capacitor' in window);

/**
 * Download a data URL or base64 string as a file.
 * Web: uses <a> download trick.
 * Native: uses Capacitor Filesystem + Share.
 */
export async function downloadFile(dataUrl: string, filename: string): Promise<void> {
  if (IS_NATIVE) {
    return nativeDownload(dataUrl, filename);
  }
  return webDownload(dataUrl, filename);
}

function webDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
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
