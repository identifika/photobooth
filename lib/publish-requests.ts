import { fsGetAllCollection, fsGetCollection, fsGetDocument, fsAddDocument, fsUpdateDocument } from '@/lib/firestore';
import type { FrameConfig } from '@/lib/frame-types';
import type { FilterPreset, BackgroundOption } from '@/lib/edit-types';
import { publishUserFrame } from '@/lib/public-frames';
import { publishUserFilter } from '@/lib/public-filters';
import { createPublicBackground } from '@/lib/public-backgrounds';
import { applyCdnToFrameConfig } from '@/lib/cdn';
import { isAdmin } from '@/hooks/useAdmin';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublishRequest {
  id: string;
  /** 'frame' | 'filter' | 'background' — defaults to 'frame' for backwards compat */
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

const COLLECTION = 'publish_requests';

// ─── User: Request publish ────────────────────────────────────────────────────

/** Request to publish a frame (created by user). */
export async function requestFramePublish(
  frameId: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string; emoji?: string; categoryId?: string },
): Promise<string> {
  return fsAddDocument(COLLECTION, {
    type: 'frame',
    frameId,
    user: { uid: user.uid, displayName: user.displayName || null },
    frame,
    status: 'pending',
  } as unknown as Record<string, unknown>);
}

/** Request to publish a filter (created by user). */
export async function requestFilterPublish(
  filterId: string,
  user: { uid: string; displayName: string | null },
  filter: FilterPreset & { description?: string },
): Promise<string> {
  return fsAddDocument(COLLECTION, {
    type: 'filter',
    filterId,
    user: { uid: user.uid, displayName: user.displayName || null },
    filter,
    status: 'pending',
  } as unknown as Record<string, unknown>);
}

/** Request to publish a background (created by user). */
export async function requestBackgroundPublish(
  backgroundId: string,
  user: { uid: string; displayName: string | null },
  background: BackgroundOption & { description?: string },
): Promise<string> {
  return fsAddDocument(COLLECTION, {
    type: 'background',
    backgroundId,
    user: { uid: user.uid, displayName: user.displayName || null },
    background,
    status: 'pending',
  } as unknown as Record<string, unknown>);
}

// ─── Admin: List pending ──────────────────────────────────────────────────────

/** List all pending requests (admin only). */
export async function listPendingRequests(): Promise<PublishRequest[]> {
  const all = await fsGetAllCollection(COLLECTION);
  return all
    .map((d) => {
      const data = d.data as Omit<PublishRequest, 'id'>;
      if (data.frame?.config) {
        data.frame.config = applyCdnToFrameConfig(data.frame.config) as FrameConfig;
      }
      return { id: d.id, ...data } as PublishRequest;
    })
    .filter((r) => r.status === 'pending');
}

// ─── Admin: Approve / Reject ──────────────────────────────────────────────────

/** Approve a publish request — handles both frames and filters. */
export async function approvePublishRequest(adminEmail: string, requestId: string): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  const doc = await fsGetDocument(`${COLLECTION}/${requestId}`);
  if (!doc) throw new Error('Request not found');

  const requestData = doc.data as unknown as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  let publicId: string;
  if (requestData.type === 'filter' && requestData.filter) {
    publicId = await publishUserFilter(adminEmail, requestData.user, requestData.filter);
  } else if (requestData.type === 'background' && requestData.background) {
    publicId = await createPublicBackground(adminEmail, {
      type: requestData.background.type,
      name: requestData.background.name,
      src: requestData.background.src,
      ownerUid: requestData.user.uid,
      ownerName: requestData.user.displayName,
    } as any);
  } else if (requestData.frame) {
    publicId = await publishUserFrame(adminEmail, requestData.user, requestData.frame);
  } else {
    throw new Error('Invalid publish request: missing frame, filter, or background data');
  }

  await fsUpdateDocument(`${COLLECTION}/${requestId}`, { status: 'approved' });
  return publicId;
}

/** Reject a publish request (admin only). */
export async function rejectPublishRequest(adminEmail: string, requestId: string): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  const doc = await fsGetDocument(`${COLLECTION}/${requestId}`);
  if (!doc) throw new Error('Request not found');

  const requestData = doc.data as unknown as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  await fsUpdateDocument(`${COLLECTION}/${requestId}`, { status: 'rejected' });
}

// ─── User: Check own requests ─────────────────────────────────────────────────

/** List user's own publish requests (to show status). */
export async function listUserPublishRequests(uid: string): Promise<PublishRequest[]> {
  const docs = await fsGetCollection(COLLECTION, uid, 'user.uid');
  return docs.map((d) => {
    const data = d.data as Omit<PublishRequest, 'id'>;
    return { id: d.id, ...data } as PublishRequest;
  });
}
