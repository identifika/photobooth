import type { FilterPreset, ImageAdjustments } from './edit-types';

export interface UserFilter extends FilterPreset {
  uid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicFilter extends FilterPreset {
  ownerUid?: string;
  ownerName?: string;
  description?: string;
  sortOrder: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function formatUserFilter(row: {
  id: string;
  uid: string;
  name: string;
  emoji: string;
  adjustments: any;
  css: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserFilter {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    emoji: row.emoji || '📷',
    adjustments: (row.adjustments as ImageAdjustments) || {},
    css: row.css ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatPublicFilter(row: {
  id: string;
  name: string;
  emoji: string;
  adjustments: any;
  css: string | null;
  description: string;
  ownerUid: string | null;
  ownerName: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicFilter {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '📷',
    adjustments: (row.adjustments as ImageAdjustments) || {},
    css: row.css ?? undefined,
    description: row.description || '',
    ownerUid: row.ownerUid ?? undefined,
    ownerName: row.ownerName ?? undefined,
    sortOrder: row.sortOrder,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
