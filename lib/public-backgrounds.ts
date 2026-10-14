import { apiFetch } from './api-client';
import type { BackgroundOption } from '@/lib/edit-types';

/** List all public backgrounds. */
export async function listPublicBackgrounds(): Promise<BackgroundOption[]> {
  try {
    const res = await apiFetch<{ success: boolean; backgrounds: BackgroundOption[] }>('/api/backgrounds/public');
    return res.backgrounds || [];
  } catch (err) {
    console.error('Failed to load public backgrounds', err);
    return [];
  }
}

/** List all public backgrounds by a specific owner. */
export async function listPublicBackgroundsByOwner(uid: string): Promise<BackgroundOption[]> {
  try {
    const res = await apiFetch<{ success: boolean; backgrounds: BackgroundOption[] }>(`/api/backgrounds/public?ownerUid=${encodeURIComponent(uid)}`);
    return res.backgrounds || [];
  } catch (err) {
    return [];
  }
}

/** Create a new public background. Returns new doc ID. */
export async function createPublicBackground(
  _adminEmail: string,
  data: Omit<BackgroundOption, 'id'>
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string; background: BackgroundOption }>('/api/backgrounds/public', {
    method: 'POST',
    json: data,
  });
  return res.id;
}

/** Delete a public background. */
export async function deletePublicBackground(_adminEmail: string, bgId: string): Promise<void> {
  await apiFetch(`/api/backgrounds/public/${encodeURIComponent(bgId)}`, {
    method: 'DELETE',
  });
}

/** Delete a public background if owned by user. */
export async function deletePublicBackgroundAsOwner(bgId: string, _uid: string): Promise<boolean> {
  try {
    await apiFetch(`/api/backgrounds/public/${encodeURIComponent(bgId)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}
