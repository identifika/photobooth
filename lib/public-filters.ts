import { apiFetch } from './api-client';
import type { FilterPreset } from '@/lib/edit-types';
import type { PublicFilter } from './filter-converters';

export type { PublicFilter };

/** List all public filters. */
export async function listPublicFilters(): Promise<PublicFilter[]> {
  try {
    const res = await apiFetch<{ success: boolean; filters: PublicFilter[] }>('/api/filters/public?all=true');
    return res.filters || [];
  } catch (err) {
    console.warn('Failed to load public filters', err);
    return [];
  }
}

/** Create a new public filter. Returns new doc ID. */
export async function createPublicFilter(
  _adminEmail: string,
  data: Omit<FilterPreset, 'id'> & { description?: string; sortOrder?: number; active?: boolean },
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string; filter: PublicFilter }>('/api/filters/public', {
    method: 'POST',
    json: {
      ...data,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
    },
  });
  return res.id;
}

/** Update a public filter. */
export async function updatePublicFilter(
  _adminEmail: string,
  filterId: string,
  data: Partial<Omit<FilterPreset, 'id'>> & { description?: string; sortOrder?: number; active?: boolean },
): Promise<void> {
  await apiFetch(`/api/filters/public/${encodeURIComponent(filterId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete a public filter. */
export async function deletePublicFilter(_adminEmail: string, filterId: string): Promise<void> {
  await apiFetch(`/api/filters/public/${encodeURIComponent(filterId)}`, {
    method: 'DELETE',
  });
}

/** Update any public filter (admin only). */
export async function updateAnyPublicFilter(
  _adminEmail: string,
  filterId: string,
  data: Partial<Omit<PublicFilter, 'id'>>,
): Promise<void> {
  await apiFetch(`/api/filters/public/${encodeURIComponent(filterId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete a public filter (only if owner matches). Returns true if deleted. */
export async function deletePublicFilterAsOwner(
  filterId: string,
  _ownerUid: string,
): Promise<boolean> {
  try {
    await apiFetch(`/api/filters/public/${encodeURIComponent(filterId)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/** List public filters by owner. */
export async function listPublicFiltersByOwner(ownerUid: string): Promise<PublicFilter[]> {
  try {
    const res = await apiFetch<{ success: boolean; filters: PublicFilter[] }>(`/api/filters/public?ownerUid=${encodeURIComponent(ownerUid)}`);
    return res.filters || [];
  } catch (err) {
    return [];
  }
}

/** Load a single public filter by ID. */
export async function loadPublicFilter(filterId: string): Promise<PublicFilter | null> {
  try {
    const res = await apiFetch<{ success: boolean; filter: PublicFilter }>(`/api/filters/public/${encodeURIComponent(filterId)}`);
    return res.filter || null;
  } catch (err) {
    return null;
  }
}

/** Publish a user filter to the community (public_filters collection). */
export async function publishUserFilter(
  _adminEmail: string,
  user: { uid: string; displayName: string | null },
  filter: FilterPreset & { description?: string },
): Promise<string> {
  const { id, ...dataToSave } = filter;
  const res = await apiFetch<{ success: boolean; id: string }>('/api/filters/public', {
    method: 'POST',
    json: {
      ...dataToSave,
      description: filter.description || `Custom filter: ${filter.name}`,
      ownerUid: user.uid,
      ownerName: user.displayName ?? 'Anonymous',
      sortOrder: 0,
      active: true,
    },
  });
  return res.id;
}
