import { apiFetch } from './api-client';
import type { FrameConfig } from '@/lib/frame-types';
import type { FilterPreset, BackgroundOption } from '@/lib/edit-types';

export interface PublishRequest {
  id: string;
  type?: 'frame' | 'filter' | 'background';
  frameId?: string;
  filterId?: string;
  backgroundId?: string;
  user: {
    uid: string;
    displayName: string | null;
  };
  frame?: {
    config: FrameConfig;
    name: string;
    emoji?: string;
    categoryId?: string;
  };
  filter?: FilterPreset & { description?: string };
  background?: BackgroundOption & { description?: string };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: unknown;
  updatedAt: unknown;
}

/** Request to publish a frame (created by user). */
export async function requestFramePublish(
  frameId: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string; emoji?: string; categoryId?: string },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/publish-requests', {
    method: 'POST',
    json: {
      type: 'frame',
      frameId,
      user,
      frame,
    },
  });
  return res.id;
}

/** Request to publish a filter (created by user). */
export async function requestFilterPublish(
  filterId: string,
  user: { uid: string; displayName: string | null },
  filter: FilterPreset & { description?: string },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/publish-requests', {
    method: 'POST',
    json: {
      type: 'filter',
      filterId,
      user,
      filter,
    },
  });
  return res.id;
}

/** Request to publish a background (created by user). */
export async function requestBackgroundPublish(
  backgroundId: string,
  user: { uid: string; displayName: string | null },
  background: BackgroundOption & { description?: string },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/publish-requests', {
    method: 'POST',
    json: {
      type: 'background',
      backgroundId,
      user,
      background,
    },
  });
  return res.id;
}

/** List all pending requests (admin only). */
export async function listPendingRequests(): Promise<PublishRequest[]> {
  try {
    const res = await apiFetch<{ success: boolean; requests: PublishRequest[] }>('/api/publish-requests?status=pending');
    return res.requests || [];
  } catch (err) {
    console.error('Failed to list pending publish requests:', err);
    return [];
  }
}

/** Approve a publish request (admin only). Returns the new public asset ID. */
export async function approvePublishRequest(_adminEmail: string, requestId: string): Promise<string> {
  const res = await apiFetch<{ success: boolean; publicId: string }>(`/api/publish-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
  });
  return res.publicId;
}

/** Reject a publish request (admin only). */
export async function rejectPublishRequest(_adminEmail: string, requestId: string): Promise<void> {
  await apiFetch(`/api/publish-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
  });
}

/** List user's own publish requests (to show status). */
export async function listUserPublishRequests(_uid: string): Promise<PublishRequest[]> {
  try {
    const res = await apiFetch<{ success: boolean; requests: PublishRequest[] }>('/api/publish-requests');
    return res.requests || [];
  } catch (err) {
    console.error('Failed to list user publish requests:', err);
    return [];
  }
}
