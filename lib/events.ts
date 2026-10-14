import { apiFetch } from './api-client';

export interface BoothEvent {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  brideName?: string;
  groomName?: string;
  hostUid: string;
  hostEmail?: string;
  eventDate: string;
  venue?: string;
  primaryFrameId: string;
  frameIds: string[];
  allowFrameSelection: boolean;
  mode: 'kiosk' | 'guest_mobile' | 'hybrid';
  enableLiveGallery: boolean;
  requirePasscode?: string;
  customLogoUrl?: string;
  themeColor?: string;
  customMessage?: string;
  hashtag?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface EventCapture {
  id: string;
  eventId: string;
  eventSlug: string;
  sessionId: string;
  stripUrl: string;
  gifUrl?: string;
  photoUrls?: string[];
  liveClipUrls?: string[];
  createdAt: unknown;
}

/** Generate a clean URL-friendly slug */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** List all events created by a host */
export async function listUserEvents(_uid: string): Promise<BoothEvent[]> {
  try {
    const res = await apiFetch<{ success: boolean; events: BoothEvent[] }>('/api/events');
    return res.events || [];
  } catch (err) {
    console.error('Failed to list user events:', err);
    return [];
  }
}

/** Load a single event by Document ID */
export async function getEventById(id: string): Promise<BoothEvent | null> {
  try {
    const res = await apiFetch<{ success: boolean; event: BoothEvent }>(`/api/events?id=${encodeURIComponent(id)}`);
    return res.event || null;
  } catch (err) {
    return null;
  }
}

/** Load an event by its unique public slug */
export async function getEventBySlug(slug: string): Promise<BoothEvent | null> {
  try {
    const res = await apiFetch<{ success: boolean; event: BoothEvent }>(`/api/events/${encodeURIComponent(slug)}`);
    return res.event || null;
  } catch (err) {
    return null;
  }
}

/** Create or update an event by slug (upsert) */
export async function createEvent(
  _uid: string,
  _hostEmail: string,
  data: Omit<BoothEvent, 'id' | 'hostUid' | 'hostEmail' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const res = await apiFetch<{ success: boolean; event: BoothEvent }>('/api/events', {
    method: 'POST',
    json: data,
  });
  return res.event.id;
}

/** Update an existing event */
export async function updateEvent(
  _uid: string,
  eventId: string,
  data: Partial<BoothEvent>
): Promise<void> {
  await apiFetch(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    json: data,
  });
}

/** Delete an event */
export async function deleteEvent(_uid: string, eventId: string): Promise<void> {
  await apiFetch(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}

/** Record a new photobooth capture for an event */
export async function createEventCapture(
  eventIdOrSlug: string,
  capture: Omit<EventCapture, 'id' | 'createdAt'>
): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>(`/api/events/${encodeURIComponent(eventIdOrSlug)}/captures`, {
    method: 'POST',
    json: capture,
  });
  return res.id;
}

/** Get all captures for an event */
export async function getEventCaptures(eventIdOrSlug: string): Promise<EventCapture[]> {
  try {
    const res = await apiFetch<{ success: boolean; captures: EventCapture[] }>(`/api/events/${encodeURIComponent(eventIdOrSlug)}/captures`);
    return res.captures || [];
  } catch (err) {
    console.warn('Failed to load event captures from API:', err);
    return [];
  }
}

/** Subscribe to realtime updates for an event's live gallery via lightweight polling */
export function subscribeToEventCaptures(
  eventIdOrSlug: string,
  onUpdate: (captures: EventCapture[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let active = true;
  let timer: any;

  const poll = async () => {
    try {
      const captures = await getEventCaptures(eventIdOrSlug);
      if (active) onUpdate(captures);
    } catch (err) {
      if (active) onError?.(err);
    }
  };

  poll();
  timer = setInterval(poll, 3500);

  return () => {
    active = false;
    if (timer) clearInterval(timer);
  };
}
