import type { BoothEvent, EventCapture } from '@/lib/events';
import { applyCdnToUrl } from './cdn';

export function formatBoothEvent(row: {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  brideName: string | null;
  groomName: string | null;
  hostUid: string;
  hostEmail: string | null;
  eventDate: string;
  venue: string | null;
  primaryFrameId: string;
  frameIds: string[];
  allowFrameSelection: boolean;
  mode: string;
  enableLiveGallery: boolean;
  requirePasscode: string | null;
  customLogoUrl: string | null;
  themeColor: string;
  customMessage: string | null;
  hashtag: string | null;
  wifiSsid: string | null;
  wifiPassword: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BoothEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? undefined,
    brideName: row.brideName ?? undefined,
    groomName: row.groomName ?? undefined,
    hostUid: row.hostUid,
    hostEmail: row.hostEmail ?? undefined,
    eventDate: row.eventDate,
    venue: row.venue ?? undefined,
    primaryFrameId: row.primaryFrameId || '',
    frameIds: row.frameIds || [],
    allowFrameSelection: row.allowFrameSelection,
    mode: (row.mode as 'kiosk' | 'guest_mobile' | 'hybrid') || 'hybrid',
    enableLiveGallery: row.enableLiveGallery,
    requirePasscode: row.requirePasscode ?? undefined,
    customLogoUrl: row.customLogoUrl ? (applyCdnToUrl(row.customLogoUrl) || row.customLogoUrl) : undefined,
    themeColor: row.themeColor,
    customMessage: row.customMessage ?? undefined,
    hashtag: row.hashtag ?? undefined,
    wifiSsid: row.wifiSsid ?? undefined,
    wifiPassword: row.wifiPassword ?? undefined,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatEventCapture(row: {
  id: string;
  eventId: string;
  eventSlug: string;
  sessionId: string;
  stripUrl: string;
  gifUrl: string | null;
  photoUrls: string[];
  liveClipUrls: string[];
  createdAt: Date;
}): EventCapture {
  return {
    id: row.id,
    eventId: row.eventId,
    eventSlug: row.eventSlug,
    sessionId: row.sessionId,
    stripUrl: applyCdnToUrl(row.stripUrl) || row.stripUrl,
    gifUrl: row.gifUrl ? (applyCdnToUrl(row.gifUrl) || row.gifUrl) : undefined,
    photoUrls: (row.photoUrls || []).map((u) => applyCdnToUrl(u) || u),
    liveClipUrls: (row.liveClipUrls || []).map((u) => applyCdnToUrl(u) || u),
    createdAt: row.createdAt.toISOString(),
  };
}
