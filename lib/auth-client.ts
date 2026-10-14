/**
 * Client authentication token management.
 * Stores and retrieves session tokens for web and native (Capacitor/Tauri) platforms.
 */

export function getClientSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('pika_session_token');
  } catch {
    return null;
  }
}

export function setClientSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem('pika_session_token', token);
    } else {
      localStorage.removeItem('pika_session_token');
    }
  } catch {
    // ignore storage quota / access errors
  }
}

/**
 * Returns the bearer token for API requests.
 * Uses the session token from localStorage.
 */
export async function getClientAuthToken(): Promise<string | null> {
  return getClientSessionToken();
}

