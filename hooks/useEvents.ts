import useSWR from 'swr';
import { listUserEvents, getEventById, getEventBySlug, type BoothEvent } from '@/lib/events';

export function useUserEvents(uid?: string | null) {
  return useSWR<BoothEvent[]>(
    uid ? ['user-events', uid] : null,
    ([, id]: [string, string]) => listUserEvents(id)
  );
}

export function useEvent(id?: string | null) {
  return useSWR<BoothEvent | null>(
    id ? ['event-by-id', id] : null,
    ([, eventId]: [string, string]) => getEventById(eventId)
  );
}

export function useEventBySlug(slug?: string | null) {
  return useSWR<BoothEvent | null>(
    slug ? ['event-by-slug', slug] : null,
    ([, eventSlug]: [string, string]) => getEventBySlug(eventSlug)
  );
}
