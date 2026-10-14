import { apiFetch } from './api-client';
import type { BackgroundOption } from '@/lib/edit-types';
import type { UserBackground } from './background-converters';

export type { UserBackground };

export async function listUserBackgrounds(uid: string): Promise<UserBackground[]> {
  try {
    const res = await apiFetch<{ success: boolean; backgrounds: UserBackground[] }>(`/api/backgrounds?uid=${encodeURIComponent(uid)}`);
    return res.backgrounds || [];
  } catch (err) {
    console.error('Failed to list user backgrounds', err);
    return [];
  }
}

/** Save an uploaded background for a user. Returns new doc ID. */
export async function createUserBackground(
  data: Omit<UserBackground, 'id'>
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string; background: UserBackground }>('/api/backgrounds', {
    method: 'POST',
    json: data,
  });
  return res.id;
}

/** Delete a user background. */
export async function deleteUserBackground(_uid: string, bgId: string): Promise<void> {
  await apiFetch(`/api/backgrounds/${encodeURIComponent(bgId)}`, {
    method: 'DELETE',
  });
}
