import useSWR from 'swr';
import { listUserFilters, type UserFilter } from '@/lib/user-filters';
import { listPublicFiltersByOwner, type PublicFilter } from '@/lib/public-filters';

export function useUserFilters(uid: string | undefined) {
  const fetcher = async () => {
    if (!uid) return [];
    return listUserFilters(uid);
  };
  return useSWR<UserFilter[]>(uid ? `user-filters-${uid}` : null, fetcher);
}

export function useOwnerPublicFilters(uid: string | undefined) {
  const fetcher = async () => {
    if (!uid) return [];
    return listPublicFiltersByOwner(uid);
  };
  return useSWR<PublicFilter[]>(uid ? `owner-public-filters-${uid}` : null, fetcher);
}
