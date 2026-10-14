import type { BackgroundOption, BgType } from './edit-types';
import { applyCdnToUrl } from './cdn';

export interface UserBackground extends BackgroundOption {
  ownerUid: string;
  ownerName?: string | null;
  createdAt?: unknown;
}

export interface PublicBackground extends BackgroundOption {
  ownerUid?: string;
  ownerName?: string | null;
  createdAt?: unknown;
}

export function formatUserBackground(row: {
  id: string;
  ownerUid: string;
  ownerName: string | null;
  type: string;
  name: string;
  src: string | null;
  createdAt: Date;
}): UserBackground {
  return {
    id: row.id,
    type: row.type as BgType,
    name: row.name,
    src: row.src ? (applyCdnToUrl(row.src) || row.src) : undefined,
    ownerUid: row.ownerUid,
    ownerName: row.ownerName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatPublicBackground(row: {
  id: string;
  ownerUid: string | null;
  ownerName: string | null;
  type: string;
  name: string;
  src: string | null;
  createdAt: Date;
}): PublicBackground {
  return {
    id: row.id,
    type: row.type as BgType,
    name: row.name,
    src: row.src ? (applyCdnToUrl(row.src) || row.src) : undefined,
    ownerUid: row.ownerUid ?? undefined,
    ownerName: row.ownerName,
    createdAt: row.createdAt.toISOString(),
  };
}
