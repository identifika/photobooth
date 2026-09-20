/** Minimal types used by the frame editor & preview. */

export type LayoutType = 'single' | 'strip_2' | 'strip_3' | 'strip_4' | 'grid_2x2';

export interface FramePhotoElement {
  id: string;
  type: 'photo';
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  rotation?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'ticket' | 'none';
  ticketHoleSize?: number;
  hidden?: boolean;
}

export type FrameTitleDynamicSource = 
  | 'custom'
  | 'event_name'
  | 'bride_groom'
  | 'venue'
  | 'hashtag'
  | 'tagline';

export interface FrameTitleElement {
  id: string;
  type: 'title';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  font: string;
  color: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  hidden?: boolean;
  /** Dynamic source replacement */
  dynamicSource?: FrameTitleDynamicSource;
  brideName?: string;
  groomName?: string;
}

export interface FrameImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  objectFit: 'cover' | 'contain';
  hidden?: boolean;
}

export interface FrameEmojiElement {
  id: string;
  type: 'emoji';
  x: number;
  y: number;
  width: number;
  height: number;
  emoji: string;
  spacing: number;
  hidden?: boolean;
}

export interface FrameStickerElement {
  id: string;
  type: 'sticker';
  x: number;
  y: number;
  width: number;
  height: number;
  emoji: string;
  rotation: number;
  hidden?: boolean;
}

export interface FrameDateElement {
  id: string;
  type: 'date';
  x: number;
  y: number;
  width: number;
  height: number;
  format: string;
  font: string;
  color: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  hidden?: boolean;
  /** Dynamic event date support */
  useEventDate?: boolean;
  customDate?: string;
}

export type FrameQrType = 'dynamic_session_share' | 'event_gallery' | 'custom_url' | 'wifi';

export interface FrameQrElement {
  id: string;
  type: 'qr';
  x: number;
  y: number;
  width: number;
  height: number;
  qrType: FrameQrType;
  customUrl?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiEncryption?: 'WPA' | 'WEP' | 'nopass';
  color?: string;
  bgColor?: string;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  label?: string;
  labelFontSize?: number;
  labelColor?: string;
  labelFont?: string;
  hidden?: boolean;
}

export type FrameElement =
  | FramePhotoElement
  | FrameTitleElement
  | FrameImageElement
  | FrameEmojiElement
  | FrameStickerElement
  | FrameDateElement
  | FrameQrElement;

export interface FrameConfig {
  width?: number;
  height?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'ticket' | 'none';
  accentColor?: string;
  accentSize?: number;
  ticketHoleSize?: number;
  description?: string;
  elements?: FrameElement[];
  bgType?: 'solid' | 'gradient' | 'image';
  bgImage?: string;
  bgGradientFrom?: string;
  bgGradientTo?: string;
  bgGradientAngle?: number;
  /** legacy fields kept for compat */
  slots?: unknown[];
  background?: unknown;
  overlay?: unknown;
  watermark?: unknown;
}

export interface DynamicFrameContext {
  eventName?: string;
  eventDate?: string | Date;
  brideName?: string;
  groomName?: string;
  coupleNames?: string;
  venue?: string;
  hashtag?: string;
  tagline?: string;
  customMessage?: string;
  [key: string]: unknown;
}

/**
 * Formats a Date object using standard token formatting
 */
export function formatDate(date: Date, format: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();

  return (format || 'MMM DD, YYYY')
    .replace('MMMM', fullMonths[m])
    .replace('MMM', months[m])
    .replace('MM', String(m + 1).padStart(2, '0'))
    .replace('DD', String(d).padStart(2, '0'))
    .replace('D', String(d))
    .replace('YYYY', String(y))
    .replace('YY', String(y).slice(-2));
}

/**
 * Resolves a dynamic title with tokens like {{bride}}, {{groom}}, {{couple}}, {{eventName}}, {{venue}}, {{hashtag}}
 */
export function resolveDynamicTitle(
  el: FrameTitleElement,
  context?: DynamicFrameContext
): string {
  // 1. Dynamic Source overrides
  if (el.dynamicSource === 'event_name' && context?.eventName) {
    return context.eventName;
  }
  if (el.dynamicSource === 'bride_groom') {
    const bride = context?.brideName || el.brideName || '';
    const groom = context?.groomName || el.groomName || '';
    if (bride && groom) return `${bride} & ${groom}`;
    if (bride || groom) return bride || groom;
    if (context?.eventName) return context.eventName;
  }
  if (el.dynamicSource === 'venue' && context?.venue) {
    return context.venue;
  }
  if (el.dynamicSource === 'hashtag' && context?.hashtag) {
    return context.hashtag;
  }
  if (el.dynamicSource === 'tagline' && context?.tagline) {
    return context.tagline;
  }

  let text = el.text || '';

  // 2. Token / Variable replacement
  if (text.includes('{{') && text.includes('}}')) {
    const bride = context?.brideName || el.brideName || 'Sarah';
    const groom = context?.groomName || el.groomName || 'John';
    const couple = (context?.brideName && context?.groomName)
      ? `${context.brideName} & ${context.groomName}`
      : (el.brideName && el.groomName ? `${el.brideName} & ${el.groomName}` : (context?.eventName || `${bride} & ${groom}`));

    const formattedDate = context?.eventDate ? formatDate(new Date(context.eventDate), 'MMMM D, YYYY') : '';

    text = text
      .replace(/{{\s*bride\s*}}/gi, bride)
      .replace(/{{\s*groom\s*}}/gi, groom)
      .replace(/{{\s*couple\s*}}/gi, couple)
      .replace(/{{\s*eventName\s*}}/gi, context?.eventName || 'Wedding Celebration')
      .replace(/{{\s*venue\s*}}/gi, context?.venue || '')
      .replace(/{{\s*hashtag\s*}}/gi, context?.hashtag || '')
      .replace(/{{\s*tagline\s*}}/gi, context?.tagline || '')
      .replace(/{{\s*date\s*}}/gi, formattedDate);
  }

  return text;
}

/**
 * Safely parses string or Date into a Date object without timezone shift bugs on YYYY-MM-DD
 */
function parseDateSafe(val: string | Date | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string' && val.trim()) {
    const match = val.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const [, y, m, d] = match.map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Resolves the Date for a FrameDateElement
 */
export function resolveDynamicDate(
  el: FrameDateElement,
  context?: DynamicFrameContext
): Date {
  if (el.useEventDate && el.customDate) {
    const d = parseDateSafe(el.customDate);
    if (d) return d;
  }
  if (context?.eventDate) {
    const d = parseDateSafe(context.eventDate);
    if (d) return d;
  }
  if (el.customDate) {
    const d = parseDateSafe(el.customDate);
    if (d) return d;
  }
  return new Date();
}

