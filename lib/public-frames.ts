import { apiFetch } from './api-client';
import type { Frame } from '@/lib/frames';
import type { FrameConfig } from '@/lib/frame-types';
import type { PublicFrame } from '@/lib/frame-converters';

export type { PublicFrame };

/** List all public frames. */
export async function listPublicFrames(): Promise<PublicFrame[]> {
  try {
    const res = await apiFetch<{ success: boolean; frames: PublicFrame[] }>('/api/frames/public?all=true');
    return res.frames || [];
  } catch (err) {
    console.error('Failed to list public frames:', err);
    return [];
  }
}

/** Create a new public frame. Returns new doc ID. */
export async function createPublicFrame(
  _adminEmail: string,
  data: Omit<Frame, 'id'> & { sortOrder?: number; active?: boolean },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string; frame: PublicFrame }>('/api/frames/public', {
    method: 'POST',
    json: {
      ...data,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
    },
  });
  return res.id;
}

/** Update a public frame. */
export async function updatePublicFrame(
  _adminEmail: string,
  frameId: string,
  data: Partial<Omit<Frame, 'id'>> & { sortOrder?: number; active?: boolean },
): Promise<void> {
  await apiFetch(`/api/frames/public/${encodeURIComponent(frameId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete a public frame. */
export async function deletePublicFrame(_adminEmail: string, frameId: string): Promise<void> {
  await apiFetch(`/api/frames/public/${encodeURIComponent(frameId)}`, {
    method: 'DELETE',
  });
}

/** Update any public frame (admin only). */
export async function updateAnyPublicFrame(
  _adminEmail: string,
  frameId: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<void> {
  await apiFetch(`/api/frames/public/${encodeURIComponent(frameId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** List public frames by owner. */
export async function listPublicFramesByOwner(ownerUid: string): Promise<PublicFrame[]> {
  try {
    const res = await apiFetch<{ success: boolean; frames: PublicFrame[] }>(`/api/frames/public?ownerUid=${encodeURIComponent(ownerUid)}`);
    return res.frames || [];
  } catch (err) {
    console.error('Failed to list public frames by owner:', err);
    return [];
  }
}

/** Load a single public frame by ID. */
export async function loadPublicFrame(frameId: string): Promise<PublicFrame | null> {
  try {
    const res = await apiFetch<{ success: boolean; frame: PublicFrame }>(`/api/frames/public/${encodeURIComponent(frameId)}`);
    return res.frame || null;
  } catch (err) {
    return null;
  }
}

/** Update a public frame (only if owner matches). Returns true if updated. */
export async function updatePublicFrameAsOwner(
  frameId: string,
  _ownerUid: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<boolean> {
  try {
    await apiFetch(`/api/frames/public/${encodeURIComponent(frameId)}`, {
      method: 'PATCH',
      json: data,
    });
    return true;
  } catch {
    return false;
  }
}

/** Delete a public frame (only if owner matches). Returns true if deleted. */
export async function deletePublicFrameAsOwner(
  frameId: string,
  _ownerUid: string,
): Promise<boolean> {
  try {
    await apiFetch(`/api/frames/public/${encodeURIComponent(frameId)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/** Publish a user frame to the community (public_frames collection). */
export async function publishUserFrame(
  _adminEmail: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string },
): Promise<string> {
  let layout: Frame['layout'] = 'strip-4';
  let photoCount = 4;
  let aspectRatio = 4 / 3;

  if (frame.config.elements) {
    const photos = frame.config.elements.filter((e) => e.type === 'photo');
    photoCount = photos.length;
    if (photoCount === 1 || photoCount === 2) {
      layout = 'strip-2';
      aspectRatio = 4 / 3;
    } else if (photoCount === 3) {
      layout = 'strip-3';
      aspectRatio = 4 / 3;
    } else if (photoCount === 4) {
      const firstPhoto = photos[0];
      const secondPhoto = photos[1];
      if (secondPhoto && Math.abs(firstPhoto.y - secondPhoto.y) < 50) {
        layout = 'grid-2x2';
        aspectRatio = 1;
      } else {
        layout = 'strip-4';
        aspectRatio = 4 / 3;
      }
    }
  }

  const data = {
    ...frame,
    description: `Custom frame: ${frame.name}`,
    layout,
    photoCount,
    aspectRatio,
    color: frame.config.color ?? '#f5f0e8',
    borderColor: frame.config.borderColor ?? '#1a1410',
    accentColor: frame.config.accentColor ?? '#c9a84c',
    emoji: '🎨',
    ownerUid: user.uid,
    ownerName: user.displayName ?? 'Anonymous',
    config: frame.config,
    sortOrder: 0,
    active: true,
  };

  const res = await apiFetch<{ success: boolean; id: string }>('/api/frames/public', {
    method: 'POST',
    json: data,
  });
  return res.id;
}
