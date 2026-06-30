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
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FrameConfig } from '@/lib/frame-types';

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
  const q = query(collection(db, 'user_frames'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const frames = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserFrame));
  
  // Sort in memory to avoid requiring a composite index in Firestore
  frames.sort((a, b) => {
    const aTime = (a.updatedAt as any)?.toMillis?.() || 0;
    const bTime = (b.updatedAt as any)?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  return frames;
}

/** Load a single frame by ID. */
export async function loadUserFrame(uid: string, frameId: string): Promise<UserFrame | null> {
  const snap = await getDoc(doc(db, 'user_frames', frameId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.uid !== uid) return null; // Security check
  return { id: snap.id, ...data } as UserFrame;
}

/** Create a new frame. Returns the new doc ID. */
export async function createUserFrame(
  uid: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<string> {
  const ref = await addDoc(collection(db, 'user_frames'), {
    uid,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update an existing frame. */
export async function updateUserFrame(
  uid: string,
  frameId: string,
  data: { config: FrameConfig; name: string; emoji?: string; categoryId: string },
): Promise<void> {
  await updateDoc(doc(db, 'user_frames', frameId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a frame. */
export async function deleteUserFrame(uid: string, frameId: string): Promise<void> {
  await deleteDoc(doc(db, 'user_frames', frameId));
}
