import { getApiUrl } from './api-config';
import { getClientAuthToken } from './auth-client';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Calls one of our `/api` routes. Adds the Firebase ID token when signed in,
 * resolves the URL for Capacitor/Tauri, and throws `ApiError` on non-2xx.
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers: extraHeaders, ...rest } = init;
  const headers: Record<string, string> = { ...(extraHeaders as Record<string, string>) };

  const token = await getClientAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(getApiUrl(path), {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
