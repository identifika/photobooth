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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FrameConfig } from '@/lib/frame-types';

export interface UserFrame {
  id: string;
  uid: string;
  config: FrameConfig;
  name: string;
  categoryId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Get the subcollection ref for a user's frames. */
function framesCol(uid: string) {
  return collection(db, 'users', uid, 'frames');
}

/** List all frames for a user. */
export async function listUserFrames(uid: string): Promise<UserFrame[]> {
  const q = query(framesCol(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserFrame));
}

/** Load a single frame by ID. */
export async function loadUserFrame(uid: string, frameId: string): Promise<UserFrame | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'frames', frameId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserFrame;
}

/** Create a new frame. Returns the new doc ID. */
export async function createUserFrame(
  uid: string,
  data: { config: FrameConfig; name: string; categoryId: string },
): Promise<string> {
  const ref = await addDoc(framesCol(uid), {
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
  data: { config: FrameConfig; name: string; categoryId: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'frames', frameId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a frame. */
export async function deleteUserFrame(uid: string, frameId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'frames', frameId));
}
