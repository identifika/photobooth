import useSWR from 'swr';
import { listUserFrames, type UserFrame } from '@/lib/user-frames';
import { listPublicFrames, listPublicFramesByOwner, type PublicFrame } from '@/lib/public-frames';
import { listUserPublishRequests, listPendingRequests, type PublishRequest } from '@/lib/publish-requests';

/**
 * Fetch user frames with SWR.
 * Returns undefined when uid is null (user not logged in).
 */
export function useUserFrames(uid?: string | null) {
  return useSWR(
    uid ? ['user-frames', uid] : null,
    ([, id]) => listUserFrames(id)
  );
}

/**
 * Fetch public frames with SWR.
 * Only fetches when isAdmin is true.
 */
export function usePublicFrames(isAdmin?: boolean) {
  return useSWR(
    isAdmin ? 'public-frames' : null,
    () => listPublicFrames()
  );
}

/**
 * Fetch user's publish requests with SWR.
 * Returns undefined when uid is null.
 */
export function useUserPublishRequests(uid?: string | null) {
  return useSWR(
    uid ? ['user-publish-requests', uid] : null,
    ([, id]) => listUserPublishRequests(id)
  );
}

/**
 * Fetch pending publish requests (admin only).
 * Only fetches when isAdmin is true.
 */
export function usePendingPublishRequests(isAdmin?: boolean) {
  return useSWR(
    isAdmin ? 'pending-publish-requests' : null,
    () => listPendingRequests()
  );
}

/**
 * Fetch public frames owned by a specific user.
 * Returns undefined when uid is null.
 */
export function useOwnerPublicFrames(uid?: string | null) {
  return useSWR(
    uid ? ['owner-public-frames', uid] : null,
    ([, id]) => listPublicFramesByOwner(id)
  );
}
