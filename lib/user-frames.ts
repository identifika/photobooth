import { apiFetch } from './api-client';
import type { FrameConfig } from './frame-types';
import type { UserFrame } from './frame-converters';

export type { UserFrame };

/** List all frames for a specific user. */
export async function listUserFrames(uid: string): Promise<UserFrame[]> {
  try {
    const res = await apiFetch<{ success: boolean; frames: any[] }>(`/api/frames?uid=${encodeURIComponent(uid)}`);
    // res.frames comes from /api/frames as formatted Frame objects with rawId or id
    return (res.frames || []).map((f) => ({
      id: f.rawId || f.id.replace(/^user-/, ''),
      uid: f.uid || uid,
      config: f.config,
      name: f.name,
      emoji: f.emoji,
      categoryId: f.categoryId || '',
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  } catch (err) {
    console.error('Failed to list user frames:', err);
    return [];
  }
}

/** List all custom user frames across the system. */
export async function listAllUserFrames(): Promise<UserFrame[]> {
  try {
    const res = await apiFetch<{ success: boolean; frames: any[] }>('/api/frames');
    return (res.frames || []).map((f) => ({
      id: f.rawId || f.id.replace(/^user-/, ''),
      uid: f.uid,
      config: f.config,
      name: f.name,
      emoji: f.emoji,
      categoryId: f.categoryId || '',
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  } catch (err) {
    console.error('Failed to list all user frames:', err);
    return [];
  }
}

/** Load a single frame by Document ID without user restriction (e.g. for booth/API loading). */
export async function loadUserFrameById(frameId: string): Promise<UserFrame | null> {
  try {
    const cleanId = frameId.startsWith('user-') ? frameId.replace('user-', '') : frameId;
    const res = await apiFetch<{ success: boolean; frame: any }>(`/api/frames/${encodeURIComponent(cleanId)}`);
    if (!res.frame) return null;
    return {
      id: res.frame.rawId || cleanId,
      uid: res.frame.uid || '',
      config: res.frame.config,
      name: res.frame.name,
      emoji: res.frame.emoji,
      categoryId: res.frame.categoryId || '',
      createdAt: res.frame.createdAt,
      updatedAt: res.frame.updatedAt,
    };
  } catch (err) {
    return null;
  }
}

/** Load a single frame by ID for a specific user. */
export async function loadUserFrame(uid: string, frameId: string): Promise<UserFrame | null> {
  const frame = await loadUserFrameById(frameId);
  if (!frame || (frame.uid && frame.uid !== uid)) return null;
  return frame;
}

/** Create a new frame. Returns the new doc ID. */
export async function createUserFrame(
  _uid: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string; frame: UserFrame }>('/api/frames', {
    method: 'POST',
    json: data,
  });
  return res.id;
}

/** Update an existing frame. */
export async function updateUserFrame(
  _uid: string,
  frameId: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<void> {
  const cleanId = frameId.startsWith('user-') ? frameId.replace('user-', '') : frameId;
  await apiFetch(`/api/frames/${encodeURIComponent(cleanId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete a frame. */
export async function deleteUserFrame(_uid: string, frameId: string): Promise<void> {
  const cleanId = frameId.startsWith('user-') ? frameId.replace('user-', '') : frameId;
  await apiFetch(`/api/frames/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
  });
}
