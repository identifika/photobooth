import { fsGetCollection, fsAddDocument, fsDeleteDocument, fsGetDocument } from './firestore';
import type { BackgroundOption } from '@/lib/edit-types';

const COLLECTION = 'user_backgrounds';

export interface UserBackground extends BackgroundOption {
  ownerUid: string;
  ownerName?: string | null;
  createdAt?: unknown;
}

export async function listUserBackgrounds(uid: string): Promise<UserBackground[]> {
  const docs = await fsGetCollection(COLLECTION, uid, 'ownerUid');
  return docs.map((d) => ({ id: d.id, ...(d.data as Omit<UserBackground, 'id'>) }));
}

/** Save an uploaded background for a user. Returns new doc ID. */
export async function createUserBackground(
  data: Omit<UserBackground, 'id'>
): Promise<string> {
  return fsAddDocument(COLLECTION, data as unknown as Record<string, unknown>);
}

/** Delete a user background. */
export async function deleteUserBackground(uid: string, bgId: string): Promise<void> {
  const doc = await fsGetDocument(`${COLLECTION}/${bgId}`);
  if (!doc || (doc.data as any).ownerUid !== uid) throw new Error('Unauthorized');
  await fsDeleteDocument(`${COLLECTION}/${bgId}`);
}
