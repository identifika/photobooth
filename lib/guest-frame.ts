import type { FrameConfig } from './frame-types';
import type { Frame } from './frames';

export interface GuestFrameDraft {
  config: FrameConfig;
  name: string;
  emoji: string;
  categoryId?: string;
  updatedAt: number;
}

const GUEST_FRAME_KEY = 'photobooth_guest_frame_draft';

/**
 * Retrieve the guest custom frame draft from browser localStorage if available.
 */
export function getGuestFrameDraft(): GuestFrameDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_FRAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.config) {
      return parsed as GuestFrameDraft;
    }
    return null;
  } catch (e) {
    console.error('Failed to read guest frame draft from localStorage:', e);
    return null;
  }
}

/**
 * Save or update the guest custom frame draft in browser localStorage.
 */
export function saveGuestFrameDraft(
  draft: Omit<GuestFrameDraft, 'updatedAt'> & { updatedAt?: number }
): void {
  if (typeof window === 'undefined') return;
  try {
    const data: GuestFrameDraft = {
      config: draft.config,
      name: draft.name || '',
      emoji: draft.emoji || '✨',
      categoryId: draft.categoryId || '',
      updatedAt: draft.updatedAt || Date.now(),
    };
    localStorage.setItem(GUEST_FRAME_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save guest frame draft to localStorage:', e);
  }
}

/**
 * Clear the guest custom frame draft from browser localStorage.
 */
export function clearGuestFrameDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_FRAME_KEY);
  } catch (e) {
    console.error('Failed to remove guest frame draft from localStorage:', e);
  }
}

/**
 * Converts a guest frame draft into a playable Frame object for FrameSelector and photobooth sessions.
 */
export function guestDraftToFrame(draft: GuestFrameDraft): Frame {
  const photoCount = Math.max(
    1,
    draft.config.elements?.filter((e) => e.type === 'photo').length || 4
  );

  return {
    id: 'guest-draft',
    name: draft.name?.trim() ? `${draft.name} (Draft)` : 'Custom Frame (Draft)',
    description: 'Saved locally in your browser',
    photoCount,
    layout: photoCount <= 2 ? 'strip-2' : photoCount === 3 ? 'strip-3' : 'grid-2x2',
    aspectRatio: 4 / 3,
    color: draft.config.color || '#f5f0e8',
    borderColor: draft.config.borderColor || '#1a1410',
    accentColor: draft.config.accentColor || '#c9a84c',
    emoji: draft.emoji || '✨',
    config: draft.config,
    width: draft.config.width,
    height: draft.config.height,
  };
}
