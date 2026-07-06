import { fsGetCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument } from './firestore';
import type { FilterPreset } from '@/lib/edit-types';

export interface UserFilter extends FilterPreset {
  uid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const COLLECTION = 'user_filters';

/** List all filters for a user. */
export async function listUserFilters(uid: string): Promise<UserFilter[]> {
  try {
    const docs = await fsGetCollection(COLLECTION, uid);
    return docs.map((d) => {
      const data = d.data as Omit<UserFilter, 'id'>;
      return { id: d.id, ...data } as UserFilter;
    });
  } catch (err) {
    console.error('Failed to list user filters', err);
    return [];
  }
}

/** Create a new user filter. */
export async function createUserFilter(
  uid: string,
  filter: FilterPreset,
): Promise<string> {
  // Strip the temporary local ID if any, let Firestore generate one
  const { id, ...data } = filter;
  return fsAddDocument(COLLECTION, {
    ...data,
    uid,
  });
}

/** Update an existing user filter. */
export async function updateUserFilter(
  uid: string,
  filterId: string,
  data: Partial<Omit<UserFilter, 'id' | 'uid'>>,
): Promise<void> {
  const existing = await loadUserFilter(filterId);
  if (!existing || existing.uid !== uid) throw new Error('Unauthorized');
  await fsUpdateDocument(`${COLLECTION}/${filterId}`, data);
}

/** Delete a user filter. */
export async function deleteUserFilter(uid: string, filterId: string): Promise<void> {
  const existing = await loadUserFilter(filterId);
  if (!existing || existing.uid !== uid) throw new Error('Unauthorized');
  await fsDeleteDocument(`${COLLECTION}/${filterId}`);
}

/** Load a single user filter by ID. */
export async function loadUserFilter(filterId: string): Promise<UserFilter | null> {
  const doc = await fsGetDocument(`${COLLECTION}/${filterId}`);
  if (!doc) return null;
  const data = doc.data as Omit<UserFilter, 'id'>;
  return { id: doc.id, ...data } as UserFilter;
}
