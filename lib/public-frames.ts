import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Frame } from '@/lib/frames';
import type { FrameConfig } from '@/lib/frame-types';
import { applyCdnToFrameConfig } from '@/lib/cdn';

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

function colRef() {
  return collection(db, COLLECTION);
}

/** List all public frames sorted by sortOrder. */
export async function listPublicFrames(): Promise<PublicFrame[]> {
  const q = query(colRef(), orderBy('sortOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PublicFrame, 'id'>;
    if (data.config) data.config = applyCdnToFrameConfig(data.config);
    return { id: d.id, ...data } as PublicFrame;
  });
}

/** Create a new public frame. Returns new doc ID. */
export async function createPublicFrame(
  data: Omit<Frame, 'id'> & { sortOrder?: number; active?: boolean },
): Promise<string> {
  const ref = await addDoc(colRef(), {
    ...data,
    sortOrder: data.sortOrder ?? 0,
    active: data.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update a public frame. */
export async function updatePublicFrame(
  frameId: string,
  data: Partial<Omit<Frame, 'id'>> & { sortOrder?: number; active?: boolean },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, frameId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a public frame. */
export async function deletePublicFrame(frameId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, frameId));
}

/** Update any public frame (admin only). */
export async function updateAnyPublicFrame(
  frameId: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, frameId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** List public frames by owner. */
export async function listPublicFramesByOwner(ownerUid: string): Promise<PublicFrame[]> {
  const q = query(colRef(), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PublicFrame, 'id'>;
    if (data.config) data.config = applyCdnToFrameConfig(data.config);
    return { id: d.id, ...data } as PublicFrame;
  });
}

/** Load a single public frame by ID. */
export async function loadPublicFrame(frameId: string): Promise<PublicFrame | null> {
  const snap = await getDoc(doc(db, COLLECTION, frameId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<PublicFrame, 'id'>;
  if (data.config) data.config = applyCdnToFrameConfig(data.config);
  return { id: snap.id, ...data } as PublicFrame;
}

/** Update a public frame (only if owner matches). Returns true if updated. */
export async function updatePublicFrameAsOwner(
  frameId: string,
  ownerUid: string,
  data: Partial<Omit<PublicFrame, 'id'>>,
): Promise<boolean> {
  const ref = doc(db, COLLECTION, frameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const frame = snap.data() as PublicFrame;
  if (frame.ownerUid !== ownerUid) return false;
  
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return true;
}

/** Delete a public frame (only if owner matches). Returns true if deleted. */
export async function deletePublicFrameAsOwner(
  frameId: string,
  ownerUid: string,
): Promise<boolean> {
  const ref = doc(db, COLLECTION, frameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const frame = snap.data() as PublicFrame;
  if (frame.ownerUid !== ownerUid) return false;
  
  await deleteDoc(ref);
  return true;
}

/** Publish a user frame to the community (public_frames collection). */
export async function publishUserFrame(
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string },
): Promise<string> {
  // Infer layout from config.elements if not provided
  let layout: Frame['layout'] = 'strip-4';
  let photoCount = 4;
  let aspectRatio = 4 / 3;

  if (frame.config.elements) {
    const photos = frame.config.elements.filter((e) => e.type === 'photo');
    photoCount = photos.length;
    if (photoCount === 1) {
      layout = 'strip-2'; // Use 2-column layout for single photo
      aspectRatio = 4 / 3;
    } else if (photoCount === 2) {
      layout = 'strip-2';
      aspectRatio = 4 / 3;
    } else if (photoCount === 3) {
      layout = 'strip-3';
      aspectRatio = 4 / 3;
    } else if (photoCount === 4) {
      // Check if grid or strip based on positions
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

  const data: Omit<PublicFrame, 'id'> = {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(colRef(), data);
  return ref.id;
}
