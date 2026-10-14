import type { PublishRequest } from '@/lib/publish-requests';
import { applyCdnToFrameConfig } from './cdn';
import type { FrameConfig } from './frame-types';

export function formatPublishRequest(row: {
  id: string;
  type: string;
  status: string;
  frameId: string | null;
  filterId: string | null;
  backgroundId: string | null;
  userUid: string;
  userDisplayName: string | null;
  frame: any;
  filter: any;
  background: any;
  createdAt: Date;
  updatedAt: Date;
}): PublishRequest {
  let frameObj = row.frame;
  if (frameObj && typeof frameObj === 'object') {
    if (frameObj.config) {
      frameObj = {
        ...frameObj,
        config: applyCdnToFrameConfig(frameObj.config as FrameConfig) || frameObj.config,
      };
    }
  }

  return {
    id: row.id,
    type: row.type as any,
    status: row.status as any,
    frameId: row.frameId ?? undefined,
    filterId: row.filterId ?? undefined,
    backgroundId: row.backgroundId ?? undefined,
    user: {
      uid: row.userUid,
      displayName: row.userDisplayName,
    },
    frame: frameObj ?? undefined,
    filter: row.filter ?? undefined,
    background: row.background ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
