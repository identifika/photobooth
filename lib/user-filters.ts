import { apiFetch } from './api-client';
import type { FilterPreset } from '@/lib/edit-types';
import type { UserFilter } from './filter-converters';

export type { UserFilter };

/** List all filters for a user. */
export async function listUserFilters(uid: string): Promise<UserFilter[]> {
  try {
    const res = await apiFetch<{ success: boolean; filters: UserFilter[] }>(`/api/filters?uid=${encodeURIComponent(uid)}`);
    return res.filters || [];
  } catch (err) {
    console.error('Failed to list user filters', err);
    return [];
  }
}

/** Create a new user filter. */
export async function createUserFilter(
  _uid: string,
  filter: FilterPreset,
): Promise<string> {
  const { id, ...data } = filter;
  const res = await apiFetch<{ success: boolean; id: string; filter: UserFilter }>('/api/filters', {
    method: 'POST',
    json: data,
  });
  return res.id;
}

/** Update an existing user filter. */
export async function updateUserFilter(
  _uid: string,
  filterId: string,
  data: Partial<Omit<UserFilter, 'id' | 'uid'>>,
): Promise<void> {
  await apiFetch(`/api/filters/${encodeURIComponent(filterId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete a user filter. */
export async function deleteUserFilter(_uid: string, filterId: string): Promise<void> {
  await apiFetch(`/api/filters/${encodeURIComponent(filterId)}`, {
    method: 'DELETE',
  });
}

/** Load a single user filter by ID. */
export async function loadUserFilter(filterId: string): Promise<UserFilter | null> {
  try {
    const res = await apiFetch<{ success: boolean; filter: UserFilter }>(`/api/filters/${encodeURIComponent(filterId)}`);
    return res.filter || null;
  } catch (err) {
    return null;
  }
}
