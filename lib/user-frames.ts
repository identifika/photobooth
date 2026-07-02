import { fsGetCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument } from './firestore';
import type { FrameConfig } from './frame-types';
import { applyCdnToFrameConfig } from './cdn';

export interface UserFrame {
  id: string;
  uid: string;
  config: FrameConfig;
  name: string;
  emoji?: string;
  categoryId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/** List all frames for a user. */
export async function listUserFrames(uid: string): Promise<UserFrame[]> {
  const docs = await fsGetCollection('user_frames', uid);
  const frames = docs.map((d) => {
    const data = d.data as Omit<UserFrame, 'id'>;
    if (data.config) data.config = applyCdnToFrameConfig(data.config) as FrameConfig;
    return { id: d.id, ...data } as UserFrame;
  });

  // Sort in memory to avoid requiring a composite index in Firestore
  frames.sort((a, b) => {
    const aTime = (a.updatedAt as any)?.toMillis?.() || (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0);
    const bTime = (b.updatedAt as any)?.toMillis?.() || (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0);
    return bTime - aTime;
  });

  return frames;
}

/** Load a single frame by ID. */
export async function loadUserFrame(uid: string, frameId: string): Promise<UserFrame | null> {
  const doc = await fsGetDocument(`user_frames/${frameId}`);
  if (!doc) return null;
  const data = doc.data as Omit<UserFrame, 'id'>;
  if (data.uid !== uid) return null;
  if (data.config) data.config = applyCdnToFrameConfig(data.config) as FrameConfig;
  return { id: doc.id, ...data } as UserFrame;
}

/** Create a new frame. Returns the new doc ID. */
export async function createUserFrame(
  uid: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<string> {
  return fsAddDocument('user_frames', { uid, ...data });
}

/** Update an existing frame. */
export async function updateUserFrame(
  uid: string,
  frameId: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<void> {
  await fsUpdateDocument(`user_frames/${frameId}`, data);
}

/** Delete a frame. */
export async function deleteUserFrame(uid: string, frameId: string): Promise<void> {
  await fsDeleteDocument(`user_frames/${frameId}`);
}
