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
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'ticket';
  ticketHoleSize?: number;
  hidden?: boolean;
}

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
}

export type FrameElement =
  | FramePhotoElement
  | FrameTitleElement
  | FrameImageElement
  | FrameEmojiElement
  | FrameStickerElement
  | FrameDateElement;

export interface FrameConfig {
  width?: number;
  height?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'ticket';
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
