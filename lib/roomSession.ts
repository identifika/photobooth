// Assigns "host" to whoever creates the room, "guest" to whoever opens the
// invite link. Persisted in sessionStorage per roomId so a refresh doesn't
// flip your role or peerId mid-date.

import type { Frame } from './frames';

export type Role = "host" | "guest";

export interface RoomSession {
  roomId: string;
  role: Role;
  peerId: string;
  frame?: Frame;
  captureMode?: "merged" | "alternating";
}

function key(roomId: string) {
  return `date-session:${roomId}`;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Call when creating a brand new room (host flow). */
export function createRoomSession(frame: Frame, captureMode: "merged" | "alternating"): RoomSession {
  const roomId = uuidv4();
  const session: RoomSession = {
    roomId,
    role: "host",
    peerId: `host-${randomSuffix()}`,
    frame,
    captureMode,
  };
  sessionStorage.setItem(key(roomId), JSON.stringify(session));
  return session;
}

/**
 * Call when landing on /date/[roomId]. Restores an existing session for
 * this room (e.g. on refresh), or assigns "guest" if this is a fresh visit
 * via someone else's invite link.
 */
export function getOrJoinRoomSession(roomId: string): RoomSession {
  const existing = sessionStorage.getItem(key(roomId));
  if (existing) return JSON.parse(existing) as RoomSession;

  const session: RoomSession = {
    roomId,
    role: "guest",
    peerId: `guest-${randomSuffix()}`,
  };
  sessionStorage.setItem(key(roomId), JSON.stringify(session));
  return session;
}

export function inviteLinkFor(roomId: string): string {
  if (typeof window === "undefined") return "";
  const IS_NATIVE = 'Capacitor' in window || '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  // On native: origin is tauri://localhost or http://localhost — use the public web URL
  // On web: use whatever domain the user is currently on
  const base = IS_NATIVE ? 'https://pika.identifika.my.id' : window.location.origin;
  return `${base}/date?room=${roomId}`;
}
