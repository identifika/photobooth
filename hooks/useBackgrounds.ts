import { useState, useEffect } from 'react';
import { BackgroundOption } from '@/lib/edit-types';
import { listPublicBackgrounds, listPublicBackgroundsByOwner } from '@/lib/public-backgrounds';
import { listUserBackgrounds } from '@/lib/user-backgrounds';
import useSWR from 'swr';

export function useBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBackgrounds = async () => {
    try {
      setLoading(true);
      const data = await listPublicBackgrounds();
      setBackgrounds(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load backgrounds:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  return { backgrounds, loading, error, refresh: fetchBackgrounds };
}

/**
 * Fetch user backgrounds with SWR.
 */
export function useUserBackgrounds(uid?: string | null) {
  return useSWR(
    uid ? ['user-backgrounds', uid] : null,
    ([, id]) => listUserBackgrounds(id)
  );
}

/**
 * Fetch public backgrounds owned by a specific user.
 */
export function useOwnerPublicBackgrounds(uid?: string | null) {
  return useSWR(
    uid ? ['owner-public-backgrounds', uid] : null,
    ([, id]) => listPublicBackgroundsByOwner(id)
  );
}
