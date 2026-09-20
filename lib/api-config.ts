/**
 * Cross-platform API configuration and URL resolution utility.
 * Handles differences between standard Web, Capacitor (iOS/Android), and Tauri (Desktop).
 */

import { Capacitor } from '@capacitor/core';

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
 * in Capacitor or Tauri, or keeps it relative in standard web development.
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (isNativePlatform()) {
    const baseUrl = getPublicAppUrl();
    return `${baseUrl}${cleanEndpoint}`;
  }

  // In standard web, allow NEXT_PUBLIC_APP_URL if defined and different, or use relative
  if (process.env.NEXT_PUBLIC_APP_URL && typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    // If hosted on a different domain or static export
    if (envUrl && !window.location.origin.includes(new URL(envUrl).hostname)) {
      return `${envUrl}${cleanEndpoint}`;
    }
  }

  return cleanEndpoint;
}

/**
 * Generates a public shareable URL for a given session.
 */
export function getSessionShareUrl(sessionId: string): string {
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/share?s=${encodeURIComponent(sessionId)}`;
}
