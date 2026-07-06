import { fsGetAllCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument } from './firestore';
import type { Frame } from '@/lib/frames';
import type { FrameConfig } from '@/lib/frame-types';
import { applyCdnToFrameConfig } from '@/lib/cdn';
import { isAdmin } from '@/hooks/useAdmin';

export interface PublicFrame extends Frame {
  ownerUid?: string;
  ownerName?: string;
  config?: FrameConfig;
  sortOrder: number;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

const COLLECTION = 'public_frames';

/** List all public frames. */
export async function listPublicFrames(): Promise<PublicFrame[]> {
  const docs = await fsGetAllCollection(COLLECTION);
  return docs.map((d) => {
    const data = d.data as Omit<PublicFrame, 'id'>;
    if (data.config) data.config = applyCdnToFrameConfig(data.config);
    return { id: d.id, ...data } as PublicFrame;
  });
}

/** Create a new public frame. Returns new doc ID. */
export async function createPublicFrame(
  adminEmail: string,
  data: Omit<Frame, 'id'> & { sortOrder?: number; active?: boolean },
): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  return fsAddDocument(COLLECTION, {
    ...data,
    sortOrder: data.sortOrder ?? 0,
    active: data.active ?? true,
  });
}

/** Update a public frame. */
export async function updatePublicFrame(
  adminEmail: string,
  frameId: string,
  data: Partial<Omit<Frame, 'id'>> & { sortOrder?: number; active?: boolean },
): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsUpdateDocument(`${COLLECTION}/${frameId}`, data);
}

/** Delete a public frame. */
export async function deletePublicFrame(adminEmail: string, frameId: string): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsDeleteDocument(`${COLLECTION}/${frameId}`);
}

/** Update any public frame (admin only). */
export async function updateAnyPublicFrame(
  adminEmail: string,
  frameId: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsUpdateDocument(`${COLLECTION}/${frameId}`, data);
}

/** List public frames by owner. */
export async function listPublicFramesByOwner(ownerUid: string): Promise<PublicFrame[]> {
  // Get all and filter client-side (REST API filter is limited)
  const all = await listPublicFrames();
  return all.filter(f => f.ownerUid === ownerUid);
}

/** Load a single public frame by ID. */
export async function loadPublicFrame(frameId: string): Promise<PublicFrame | null> {
  const doc = await fsGetDocument(`${COLLECTION}/${frameId}`);
  if (!doc) return null;
  const data = doc.data as Omit<PublicFrame, 'id'>;
  if (data.config) data.config = applyCdnToFrameConfig(data.config);
  return { id: doc.id, ...data } as PublicFrame;
}

/** Update a public frame (only if owner matches). Returns true if updated. */
export async function updatePublicFrameAsOwner(
  frameId: string,
  ownerUid: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<boolean> {
  const frame = await loadPublicFrame(frameId);
  if (!frame) return false;
  if (frame.ownerUid !== ownerUid) return false;
  await fsUpdateDocument(`${COLLECTION}/${frameId}`, data);
  return true;
}

/** Delete a public frame (only if owner matches). Returns true if deleted. */
export async function deletePublicFrameAsOwner(
  frameId: string,
  ownerUid: string,
): Promise<boolean> {
  const frame = await loadPublicFrame(frameId);
  if (!frame) return false;
  if (frame.ownerUid !== ownerUid) return false;
  await fsDeleteDocument(`${COLLECTION}/${frameId}`);
  return true;
}

/** Publish a user frame to the community (public_frames collection). */
export async function publishUserFrame(
  adminEmail: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string },
): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  let layout: Frame['layout'] = 'strip-4';
  let photoCount = 4;
  let aspectRatio = 4 / 3;

  if (frame.config.elements) {
    const photos = frame.config.elements.filter((e) => e.type === 'photo');
    photoCount = photos.length;
    if (photoCount === 1) {
      layout = 'strip-2';
      aspectRatio = 4 / 3;
    } else if (photoCount === 2) {
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

  return fsAddDocument(COLLECTION, data as unknown as Record<string, unknown>);
}
