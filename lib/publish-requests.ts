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

function colRef() {
  return collection(db, COLLECTION);
}

/** Request to publish a frame (created by user). */
export async function requestFramePublish(
  frameId: string,
  user: { uid: string; displayName: string | null },
  frame: { config: FrameConfig; name: string; emoji?: string; categoryId?: string },
): Promise<string> {
  const data: Omit<PublishRequest, 'id'> = {
    frameId,
    user: {
      uid: user.uid,
      displayName: user.displayName || null,
    },
    frame,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(colRef(), data);
  return ref.id;
}

/** List all pending requests (admin only). */
export async function listPendingRequests(): Promise<PublishRequest[]> {
  const q = query(colRef(), where('status', '==', 'pending'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PublishRequest, 'id'>;
    if (data.frame?.config) {
      data.frame.config = applyCdnToFrameConfig(data.frame.config) as FrameConfig;
    }
    return { id: d.id, ...data } as PublishRequest;
  });
}

/** Approve a publish request (admin only). */
export async function approvePublishRequest(requestId: string): Promise<string> {
  const ref = doc(db, COLLECTION, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');

  const requestData = snap.data() as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  // Publish to public_frames
  const publicFrameId = await publishUserFrame(requestData.user, requestData.frame);

  // Mark as approved
  await updateDoc(ref, {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });

  return publicFrameId;
}

/** Reject a publish request (admin only). */
export async function rejectPublishRequest(requestId: string): Promise<void> {
  const ref = doc(db, COLLECTION, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');

  const requestData = snap.data() as PublishRequest;
  if (requestData.status !== 'pending') {
    throw new Error('Request is not pending');
  }

  // Mark as rejected
  await updateDoc(ref, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
}

/** List user's own publish requests (to show status). */
export async function listUserPublishRequests(uid: string): Promise<PublishRequest[]> {
  const q = query(colRef(), where('user.uid', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PublishRequest, 'id'>;
    return { id: d.id, ...data } as PublishRequest;
  });
}
