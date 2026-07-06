import { fsGetAllCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument } from './firestore';
import { isAdmin } from '@/hooks/useAdmin';
import type { FilterPreset } from '@/lib/edit-types';

export interface PublicFilter extends FilterPreset {
  ownerUid?: string;
  ownerName?: string;
  description?: string;
  sortOrder: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const COLLECTION = 'public_filters';

/** List all public filters. */
export async function listPublicFilters(): Promise<PublicFilter[]> {
  try {
    const docs = await fsGetAllCollection(COLLECTION);
    return docs.map((d) => {
      const data = d.data as Omit<PublicFilter, 'id'>;
      return { id: d.id, ...data } as PublicFilter;
    });
  } catch (err) {
    console.warn('Failed to load public filters', err);
    return [];
  }
}

/** Create a new public filter. Returns new doc ID. */
export async function createPublicFilter(
  adminEmail: string,
  data: Omit<FilterPreset, 'id'> & { description?: string; sortOrder?: number; active?: boolean },
): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  return fsAddDocument(COLLECTION, {
    ...data,
    sortOrder: data.sortOrder ?? 0,
    active: data.active ?? true,
  });
}

/** Update a public filter. */
export async function updatePublicFilter(
  adminEmail: string,
  filterId: string,
  data: Partial<Omit<FilterPreset, 'id'>> & { description?: string; sortOrder?: number; active?: boolean },
): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsUpdateDocument(`${COLLECTION}/${filterId}`, data);
}

/** Delete a public filter. */
export async function deletePublicFilter(adminEmail: string, filterId: string): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsDeleteDocument(`${COLLECTION}/${filterId}`);
}

/** Update any public filter (admin only). */
export async function updateAnyPublicFilter(
  adminEmail: string,
  filterId: string,
  data: Partial<Omit<PublicFilter, 'id'>>,
): Promise<void> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  await fsUpdateDocument(`${COLLECTION}/${filterId}`, data);
}

/** Delete a public filter (only if owner matches). Returns true if deleted. */
export async function deletePublicFilterAsOwner(
  filterId: string,
  ownerUid: string,
): Promise<boolean> {
  const filter = await loadPublicFilter(filterId);
  if (!filter) return false;
  if (filter.ownerUid !== ownerUid) return false;
  await fsDeleteDocument(`${COLLECTION}/${filterId}`);
  return true;
}

/** List public filters by owner. */
export async function listPublicFiltersByOwner(ownerUid: string): Promise<PublicFilter[]> {
  const all = await listPublicFilters();
  return all.filter(f => f.ownerUid === ownerUid);
}

/** Load a single public filter by ID. */
export async function loadPublicFilter(filterId: string): Promise<PublicFilter | null> {
  const doc = await fsGetDocument(`${COLLECTION}/${filterId}`);
  if (!doc) return null;
  const data = doc.data as Omit<PublicFilter, 'id'>;
  return { id: doc.id, ...data } as PublicFilter;
}

/** Publish a user filter to the community (public_filters collection). */
export async function publishUserFilter(
  adminEmail: string,
  user: { uid: string; displayName: string | null },
  filter: FilterPreset & { description?: string },
): Promise<string> {
  if (!isAdmin(adminEmail)) throw new Error('Unauthorized');
  const data = {
    ...filter,
    description: filter.description || `Custom filter: ${filter.name}`,
    ownerUid: user.uid,
    ownerName: user.displayName ?? 'Anonymous',
    sortOrder: 0,
    active: true,
  };
  
  // Omit the local ID so Firestore generates one
  const { id, ...dataToSave } = data;
  
  return fsAddDocument(COLLECTION, dataToSave as unknown as Record<string, unknown>);
}
