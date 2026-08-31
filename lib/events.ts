import { fsGetCollection, fsGetDocument, fsAddDocument, fsUpdateDocument, fsDeleteDocument, fsGetAllCollection } from './firestore';

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
export async function listUserEvents(uid: string): Promise<BoothEvent[]> {
  const docs = await fsGetCollection('events', uid, 'hostUid');
  const events = docs.map((d) => ({ id: d.id, ...d.data } as BoothEvent));

  events.sort((a, b) => {
    const aTime = (a.updatedAt as any)?.toMillis?.() || (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0);
    const bTime = (b.updatedAt as any)?.toMillis?.() || (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0);
    return bTime - aTime;
  });

  return events;
}

/** Load a single event by Document ID */
export async function getEventById(id: string): Promise<BoothEvent | null> {
  const doc = await fsGetDocument(`events/${id}`);
  if (!doc) return null;
  return { id: doc.id, ...doc.data } as BoothEvent;
}

/** Load an event by its unique public slug */
export async function getEventBySlug(slug: string): Promise<BoothEvent | null> {
  const normalizedSlug = slug.toLowerCase().trim();
  const docs = await fsGetCollection('events', normalizedSlug, 'slug');
  if (docs.length > 0) {
    return { id: docs[0].id, ...docs[0].data } as BoothEvent;
  }
  // Fallback: check all if query was not indexed
  const all = await fsGetAllCollection('events');
  const match = all.find((d) => (d.data.slug as string)?.toLowerCase() === normalizedSlug);
  if (!match) return null;
  return { id: match.id, ...match.data } as BoothEvent;
}

/** Create a new event */
export async function createEvent(
  uid: string,
  hostEmail: string,
  data: Omit<BoothEvent, 'id' | 'hostUid' | 'hostEmail' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const baseSlug = slugify(data.name || 'event');
  let finalSlug = baseSlug;
  
  // Ensure unique slug
  const existing = await getEventBySlug(finalSlug);
  if (existing) {
    finalSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const payload: Record<string, unknown> = {
    ...data,
    slug: finalSlug,
    hostUid: uid,
    hostEmail,
    active: data.active ?? true,
    allowFrameSelection: data.allowFrameSelection ?? true,
    enableLiveGallery: data.enableLiveGallery ?? true,
    mode: data.mode || 'hybrid',
    primaryFrameId: data.primaryFrameId || '',
    frameIds: data.frameIds || [],
    themeColor: data.themeColor || '#e11d48',
  };

  return fsAddDocument('events', payload);
}

/** Update an existing event */
export async function updateEvent(
  uid: string,
  eventId: string,
  data: Partial<BoothEvent>
): Promise<void> {
  const existing = await getEventById(eventId);
  if (!existing || existing.hostUid !== uid) {
    throw new Error('Unauthorized or event not found');
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugCheck = await getEventBySlug(data.slug);
    if (slugCheck && slugCheck.id !== eventId) {
      throw new Error('This event URL slug is already taken. Please choose another.');
    }
  }

  await fsUpdateDocument(`events/${eventId}`, data as Record<string, unknown>);
}

/** Delete an event */
export async function deleteEvent(uid: string, eventId: string): Promise<void> {
  const existing = await getEventById(eventId);
  if (!existing || existing.hostUid !== uid) {
    throw new Error('Unauthorized or event not found');
  }

  await fsDeleteDocument(`events/${eventId}`);
}
