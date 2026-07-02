import { fsGetAllCollection, fsGetDocument, fsAddDocument, fsUpdateDocument } from '@/lib/firestore';
import type { FrameConfig } from '@/lib/frame-types';
import { publishUserFrame } from '@/lib/public-frames';
import { applyCdnToFrameConfig } from '@/lib/cdn';

export interface PublishRequest {
  id: string;
  frameId: string;
  user: {
    uid: string;
    displayName: string | null;
  };
  frame: {
    config: FrameConfig;
    name: string;
    emoji?: string;
    categoryId?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: unknown;
  updatedAt: unknown;
}

const COLLECTION = 'publish_requests';

/** Request to publish a frame (created by user). */
export async function requestFramePublish(
  frameId: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string; emoji?: string; categoryId?: string },
): Promise<string> {
  return fsAddDocument(COLLECTION, {
    frameId,
    user: { uid: user.uid, displayName: user.displayName || null },
    frame,
    status: 'pending',
  } as unknown as Record<string, unknown>);
}

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

/** Approve a publish request (admin only). */
export async function approvePublishRequest(requestId: string): Promise<string> {
  const doc = await fsGetDocument(`${COLLECTION}/${requestId}`);
  if (!doc) throw new Error('Request not found');

  const requestData = doc.data as unknown as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  const publicFrameId = await publishUserFrame(requestData.user, requestData.frame);
  await fsUpdateDocument(`${COLLECTION}/${requestId}`, { status: 'approved' });
  return publicFrameId;
}

/** Reject a publish request (admin only). */
export async function rejectPublishRequest(requestId: string): Promise<void> {
  const doc = await fsGetDocument(`${COLLECTION}/${requestId}`);
  if (!doc) throw new Error('Request not found');

  const requestData = doc.data as unknown as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  await fsUpdateDocument(`${COLLECTION}/${requestId}`, { status: 'rejected' });
}

/** List user's own publish requests (to show status). */
export async function listUserPublishRequests(uid: string): Promise<PublishRequest[]> {
  const all = await fsGetAllCollection(COLLECTION);
  return all
    .map((d) => {
      const data = d.data as Omit<PublishRequest, 'id'>;
      return { id: d.id, ...data } as PublishRequest;
    })
    .filter((r) => r.user?.uid === uid);
}
