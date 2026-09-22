import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();

export interface SaveResult {
  success: boolean;
  path?: string;
  uri?: string;
  error?: string;
}

/**
 * Converts any image source (data URL, blob URL, remote HTTP URL, or raw base64)
 * to a base64 encoded string and MIME type.
 */
export async function toBase64(source: string): Promise<{ base64Data: string; mimeType: string }> {
  // 1. Data URL
  if (source.startsWith('data:')) {
    const commaIndex = source.indexOf(',');
    if (commaIndex !== -1) {
      const header = source.slice(0, commaIndex);
      const base64Data = source.slice(commaIndex + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      return { mimeType, base64Data };
    }
  }

  // 2. Blob URL, Remote HTTP/HTTPS URL, or Relative URL
  if (source.startsWith('blob:') || source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/')) {
    const res = await fetch(source);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(',');
        if (commaIndex !== -1) {
          const header = result.slice(0, commaIndex);
          const base64Data = result.slice(commaIndex + 1);
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : (blob.type || 'image/png');
          resolve({ mimeType, base64Data });
        } else {
          resolve({ mimeType: blob.type || 'image/png', base64Data: result });
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 3. Raw base64 string
  return { base64Data: source, mimeType: 'image/png' };
}

/**
 * Saves a file directly to device storage on Capacitor (Android / iOS).
 * - On Android: Saves to Documents/Pika (automatically indexed into MediaStore/Gallery).
 * - On iOS: Saves to app Documents/Pika folder (accessible via Files app).
 */
export async function saveToDevice(source: string, filename: string): Promise<SaveResult> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { base64Data } = await toBase64(source);

  // Request permissions if needed
  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      await Filesystem.requestPermissions();
    }
  } catch {
    // Ignore and proceed
  }

  // 1. Primary: Save to public Documents/Pika directory
  try {
    const result = await Filesystem.writeFile({
      path: `Pika/${filename}`,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { success: true, uri: result.uri, path: `Documents/Pika/${filename}` };
  } catch (err1) {
    console.warn('Failed to write to Documents/Pika, trying Documents root:', err1);
  }

  // 2. Fallback: Save to Documents root
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { success: true, uri: result.uri, path: `Documents/${filename}` };
  } catch (err2) {
    console.warn('Failed to write to Documents root, trying Data directory:', err2);
  }

  // 3. Final fallback: Save to Data directory
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Data,
      recursive: true,
    });
    return { success: true, uri: result.uri, path: filename };
  } catch (err3: any) {
    return { success: false, error: err3?.message ?? 'Failed to save file' };
  }
}

/**
 * Shares a file natively via the Capacitor Share Sheet.
 */
export async function shareFile(source: string, filename: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const { base64Data } = await toBase64(source);

  // Write to cache directory so share sheet can read the file via FileProvider
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: 'Pika Photobooth',
    text: 'My photo strip from Pika',
    url: result.uri,
    dialogTitle: 'Share Photo Strip',
  });
}

/**
 * Downloads a file across Web and Native platforms.
 * - On Native (Capacitor): saves directly to device storage.
 * - On Web: triggers browser download via <a> tag.
 */
export async function downloadFile(dataUrl: string, filename: string): Promise<SaveResult | void> {
  if (isNativePlatform()) {
    return saveToDevice(dataUrl, filename);
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
