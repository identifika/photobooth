import { fsGetAllCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument } from '@/lib/firestore';
import { isAdmin } from '@/hooks/useAdmin';
import type { BackgroundOption } from '@/lib/edit-types';

const COLLECTION = 'public_backgrounds';

/** List all public backgrounds. */
export async function listPublicBackgrounds(): Promise<BackgroundOption[]> {
  const docs = await fsGetAllCollection(COLLECTION);
  return docs.map((d) => {
    const data = d.data as Omit<BackgroundOption, 'id'>;
    return { id: d.id, ...data } as BackgroundOption;
  });
}

/** List all public backgrounds by a specific owner. */
export async function listPublicBackgroundsByOwner(uid: string): Promise<BackgroundOption[]> {
  const all = await listPublicBackgrounds();
  return all.filter((b) => b.ownerUid === uid);
}

/** Create a new public background. Returns new doc ID. */
export async function createPublicBackground(
  adminEmail: string,
  data: Omit<BackgroundOption, 'id'>
): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  return fsAddDocument(COLLECTION, {
    ...data,
  });
}

/** Delete a public background. */
export async function deletePublicBackground(adminEmail: string, bgId: string): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsDeleteDocument(`${COLLECTION}/${bgId}`);
}

/** Delete a public background if owned by user. */
export async function deletePublicBackgroundAsOwner(bgId: string, uid: string): Promise<boolean> {
  const doc = await fsGetDocument(`${COLLECTION}/${bgId}`);
  if (!doc) return false;
  if ((doc.data as unknown as BackgroundOption).ownerUid === uid) {
    await fsDeleteDocument(`${COLLECTION}/${bgId}`);
    return true;
  }
  return false;
}
