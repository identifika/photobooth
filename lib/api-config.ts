/**
 * Cross-platform API configuration and URL resolution utility.
 * Handles differences between standard Web, Capacitor (iOS/Android), and Tauri (Desktop).
 */

import { Capacitor } from '@capacitor/core';

export function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  return (
    (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')) &&
    port !== ''
  );
}

export function isPackagedNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Capacitor iOS / Android
  if (Capacitor.isNativePlatform() || window.location.protocol === 'capacitor:') {
    return true;
  }

  // Packaged Tauri app (custom protocol or port-less localhost/tauri.localhost)
  if (
    window.location.protocol === 'tauri:' ||
    window.location.hostname.endsWith('.localhost') ||
    (('__TAURI__' in window || '__TAURI_INTERNALS__' in window) && !isLocalDev()) ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  ) {
    return true;
  }

  return false;
}

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() ||
    '__TAURI__' in window ||
    '__TAURI_INTERNALS__' in window ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname.endsWith('.localhost') ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  );
}

/**
 * Returns the public web domain URL (e.g. https://pikabooth.web.id).
 * Guarantees that QR codes and share links never point to localhost, capacitor://, or tauri://.
 */
export function getPublicAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // If not on a local or native scheme, use the current origin
    if (
      !origin.startsWith('capacitor://') &&
      !origin.startsWith('tauri://') &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1')
    ) {
      return origin.replace(/\/$/, '');
    }
  }

  // Production fallback domain
  return 'https://app.pikabooth.web.id';
}

/**
 * Resolves an API endpoint path (e.g. '/api/upload') to a full URL when running
 * in Capacitor or Tauri, or keeps it relative in standard web/local development.
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // 1. If running against a local dev server (browser or tauri:dev), always use local/relative endpoint
  if (isLocalDev()) {
    return cleanEndpoint;
  }

  // 2. If running in packaged native app (Capacitor or packaged Tauri), use full public app URL
  if (isPackagedNativeApp()) {
    const baseUrl = getPublicAppUrl();
    return `${baseUrl}${cleanEndpoint}`;
  }

  // 3. In web, if an explicit external API is configured
  if (process.env.NEXT_PUBLIC_API_URL) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    return `${apiUrl}${cleanEndpoint}`;
  }

  // 4. Default to relative endpoint for same-origin web requests
  return cleanEndpoint;
}

/**
 * Generates a public shareable URL for a given session.
 */
export function getSessionShareUrl(sessionId: string): string {
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/share?s=${encodeURIComponent(sessionId)}`;
}
