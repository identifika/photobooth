import { v4 as uuidv4 } from 'uuid';
import { apiFetch } from './api-client';

export interface ApiKey {
  id: string;
  uid: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: string | number | Date;
  lastUsedAt?: string | number | Date | null;
}

/** Generate a secure random API key starting with pk_live_ */
export function generateApiKeyString(): string {
  const randomPart = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 8);
  return `pk_live_${randomPart}`;
}

/** List the signed-in user's API keys. `uid` is kept for call-site compatibility; the server uses the token. */
export async function listUserApiKeys(_uid: string): Promise<ApiKey[]> {
  const res = await apiFetch<{ keys: ApiKey[] }>('/api/keys');
  return res.keys;
}

export async function createApiKey(_uid: string, name: string): Promise<ApiKey> {
  const res = await apiFetch<{ key: ApiKey }>('/api/keys', { method: 'POST', json: { name } });
  return res.key;
}

export async function deleteApiKey(_uid: string, keyId: string): Promise<void> {
  await apiFetch(`/api/keys?id=${encodeURIComponent(keyId)}`, { method: 'DELETE' });
}
