export interface Frame {
  id: string;
  name: string;
  description: string;
  photoCount: number;
  layout: 'strip-2' | 'strip-3' | 'strip-4' | 'grid-2x2';
  aspectRatio: number; // width/height for each photo slot
  color: string;
  borderColor: string;
  accentColor: string;
  emoji: string;
}

export const FRAMES: Frame[] = [
  {
    id: 'classic-strip',
    name: 'Classic Strip',
    description: '4 photos, vertical film strip',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#f5f0e8',
    borderColor: '#1a1410',
    accentColor: '#c9a84c',
    emoji: '🎞',
  },
  {
    id: 'double-take',
    name: 'Double Take',
    description: '2 photos side by side',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#fce4ec',
    borderColor: '#880e4f',
    accentColor: '#f48fb1',
    emoji: '💕',
  },
  {
    id: 'triple-shot',
    name: 'Triple Shot',
    description: '3 photos in a row',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#e8f5e9',
    borderColor: '#1b5e20',
    accentColor: '#81c784',
    emoji: '🌿',
  },
  {
    id: 'quad-grid',
    name: 'Quad Grid',
    description: '4 photos in 2×2 grid',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#e3f2fd',
    borderColor: '#0d47a1',
    accentColor: '#64b5f6',
    emoji: '🌊',
  },
];
