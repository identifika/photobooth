import { getApiUrl } from './api-config';
import { Capacitor } from '@capacitor/core';

/**
 * Cross-platform image loader optimized for HTML5 Canvas rendering.
 * Prevents canvas CORS taint errors across Local Dev, Web, Tauri, and Capacitor.
 */

function loadDirectImage(src: string, anonymous = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (anonymous) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches an image natively via CapacitorHttp if running on iOS/Android.
 */
async function fetchViaCapacitorHttp(url: string): Promise<string | null> {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const { CapacitorHttp } = await import('@capacitor/core');
    const response = await CapacitorHttp.get({
      url,
      responseType: 'blob',
    });

    if (response.status >= 200 && response.status < 300 && response.data) {
      if (typeof response.data === 'string') {
        if (response.data.startsWith('data:')) {
          return response.data;
        }
        const mime =
          response.headers?.['content-type'] ||
          response.headers?.['Content-Type'] ||
          'image/png';
        return `data:${mime};base64,${response.data}`;
      }
    }
  } catch {
    // Ignore and fallback to standard proxy
  }

  return null;
}

/**
 * Fetches an image via the server-side proxy route (/api/proxy-image).
 */
async function fetchViaProxy(src: string): Promise<string | null> {
  try {
    const proxyUrl = getApiUrl('/api/proxy-image');
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: src }),
    });

    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // Ignore proxy failure and continue fallback
  }

  return null;
}

/**
 * Loads an image safely for Canvas drawing without CORS tainting.
 *
 * Strategy:
 * 1. Data URLs & Blob URLs are loaded directly.
 * 2. Relative URLs are loaded directly with crossOrigin = 'anonymous'.
 * 3. Remote HTTP(S) URLs:
 *    a. Try direct CORS load first. S3 and CDN endpoints have CORS enabled,
 *       which avoids proxy roundtrip latency and uses browser cache.
 *    b. If direct load fails (e.g. external server without CORS), try CapacitorHttp (native).
 *    c. If not native or CapacitorHttp fails, fetch through /api/proxy-image.
 *    d. Final fallback: Load without crossOrigin so image still displays.
 */
export async function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  if (!src) {
    throw new Error('loadImageForCanvas: empty image source');
  }

  // 1. Data or blob URLs
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return loadDirectImage(src, false);
  }

  // 2. Relative local paths (same origin)
  if (src.startsWith('/') && !src.startsWith('//')) {
    return loadDirectImage(src, true);
  }

  // 3. Remote HTTP/HTTPS URL
  // Step 3a: Try direct CORS load first (fastest, keeps canvas untainted)
  try {
    return await loadDirectImage(src, true);
  } catch {
    // Direct CORS load failed (e.g. blocked by CORS policy)
  }

  // Step 3b: Capacitor native bypass
  const capacitorDataUrl = await fetchViaCapacitorHttp(src);
  if (capacitorDataUrl) {
    try {
      return await loadDirectImage(capacitorDataUrl, false);
    } catch {
      // Continue to proxy
    }
  }

  // Step 3c: Server-side proxy
  const proxyObjectUrl = await fetchViaProxy(src);
  if (proxyObjectUrl) {
    try {
      const img = await loadDirectImage(proxyObjectUrl, true);
      URL.revokeObjectURL(proxyObjectUrl);
      return img;
    } catch {
      URL.revokeObjectURL(proxyObjectUrl);
    }
  }

  // Step 3d: Last-resort fallback without crossOrigin
  return loadDirectImage(src, false);
}

/**
 * Fetches an external image as a local Data URL to safely draw onto a canvas.
 * Useful for caching or state retention.
 */
export async function fetchImageAsDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith('data:')) return src;

  // Blob URL
  if (src.startsWith('blob:')) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    } catch {
      return src;
    }
  }

  // Capacitor native check
  const nativeDataUrl = await fetchViaCapacitorHttp(src);
  if (nativeDataUrl) return nativeDataUrl;

  // Direct fetch attempt
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    }
  } catch {
    // Direct fetch failed, fallback to proxy
  }

  // Proxy attempt
  try {
    const proxyUrl = getApiUrl('/api/proxy-image');
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: src }),
    });
    if (res.ok) {
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    }
  } catch {
    // Fallback
  }

  return src;
}
