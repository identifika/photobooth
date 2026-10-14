import type { FrameConfig } from './frame-types';
import type { Frame } from './frames';
import { applyCdnToFrameConfig } from './cdn';

export interface UserFrame {
  id: string;
  uid: string;
  config: FrameConfig;
  name: string;
  emoji?: string;
  categoryId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PublicFrame extends Frame {
  ownerUid?: string;
  ownerName?: string;
  config?: FrameConfig;
  sortOrder: number;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export type PrismaFrameLayout = 'strip_2' | 'strip_3' | 'strip_4' | 'grid_2x2';

export function toPrismaLayout(layout?: string): PrismaFrameLayout {
  if (layout === 'strip-2' || layout === 'strip_2') return 'strip_2';
  if (layout === 'strip-3' || layout === 'strip_3') return 'strip_3';
  if (layout === 'grid-2x2' || layout === 'grid_2x2') return 'grid_2x2';
  return 'strip_4';
}

export function fromPrismaLayout(layout: string): 'strip-2' | 'strip-3' | 'strip-4' | 'grid-2x2' {
  if (layout === 'strip_2' || layout === 'strip-2') return 'strip-2';
  if (layout === 'strip_3' || layout === 'strip-3') return 'strip-3';
  if (layout === 'grid_2x2' || layout === 'grid-2x2') return 'grid-2x2';
  return 'strip-4';
}

export function formatUserFrame(row: {
  id: string;
  uid: string;
  name: string;
  emoji: string | null;
  categoryId: string;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}): UserFrame {
  const cfg = row.config ? (applyCdnToFrameConfig(row.config as FrameConfig) || row.config) : ({} as FrameConfig);
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    emoji: row.emoji ?? undefined,
    categoryId: row.categoryId,
    config: cfg,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatPublicFrame(row: {
  id: string;
  name: string;
  description: string;
  photoCount: number;
  layout: string;
  aspectRatio: number;
  color: string;
  borderColor: string;
  accentColor: string;
  emoji: string;
  config: any;
  width: number | null;
  height: number | null;
  ownerUid: string | null;
  ownerName: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicFrame {
  const cfg = row.config ? (applyCdnToFrameConfig(row.config as FrameConfig) || row.config) : undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    photoCount: row.photoCount,
    layout: fromPrismaLayout(row.layout),
    aspectRatio: row.aspectRatio,
    color: row.color,
    borderColor: row.borderColor,
    accentColor: row.accentColor,
    emoji: row.emoji || '🎨',
    config: cfg,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    ownerUid: row.ownerUid ?? undefined,
    ownerName: row.ownerName ?? undefined,
    sortOrder: row.sortOrder,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function userFrameToFrame(f: UserFrame): Frame & { rawId: string; categoryId?: string; uid?: string; isCustom: boolean } {
  const photoCount = Math.max(1, f.config?.elements?.filter((e) => e.type === 'photo').length || 4);
  return {
    id: `user-${f.id}`,
    rawId: f.id,
    name: f.name || 'Custom Frame',
    description: f.config?.description || 'Custom user frame',
    photoCount,
    layout: photoCount <= 2 ? 'strip-2' : photoCount === 3 ? 'strip-3' : 'grid-2x2',
    aspectRatio: 4 / 3,
    color: f.config?.color || '#f5f0e8',
    borderColor: f.config?.borderColor || '#1a1410',
    accentColor: f.config?.accentColor || '#c9a84c',
    emoji: f.emoji || '✨',
    config: f.config,
    width: f.config?.width,
    height: f.config?.height,
    categoryId: f.categoryId,
    uid: f.uid,
    isCustom: true,
  };
}
