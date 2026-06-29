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
}

export type FrameElement =
  | FramePhotoElement
  | FrameTitleElement
  | FrameImageElement
  | FrameEmojiElement
  | FrameStickerElement;

export interface FrameConfig {
  width?: number;
  height?: number;
  color?: string;
  borderColor?: string;
  accentColor?: string;
  accentSize?: number;
  description?: string;
  elements?: FrameElement[];
  /** legacy fields kept for compat */
  slots?: unknown[];
  background?: unknown;
  overlay?: unknown;
  watermark?: unknown;
}
