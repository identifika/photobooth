import { listPublicFrames, type PublicFrame } from '@/lib/public-frames';
import type { FrameConfig, FrameElement } from '@/lib/frame-types';

export interface Frame {
  id: string;
  name: string;
  description: string;
  photoCount: number;
  layout: 'strip-2' | 'strip-3' | 'strip-4' | 'grid-2x2';
  aspectRatio: number;
  color: string;
  borderColor: string;
  accentColor: string;
  emoji: string;
  // Optional elements-based config (for custom frames / modern public frames)
  config?: FrameConfig;
  width?: number;
  height?: number;
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
  {
    id: 'noir-strip',
    name: 'Noir',
    description: '4 photos, dark moody strip',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#1a1a1a',
    borderColor: '#e0e0e0',
    accentColor: '#9e9e9e',
    emoji: '🖤',
  },
  {
    id: 'sunset-duo',
    name: 'Sunset Duo',
    description: '2 photos, warm tones',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#fff3e0',
    borderColor: '#e65100',
    accentColor: '#ffb74d',
    emoji: '🌅',
  },
  {
    id: 'lavender-trio',
    name: 'Lavender',
    description: '3 photos, soft purple',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#f3e5f5',
    borderColor: '#4a148c',
    accentColor: '#ce93d8',
    emoji: '💜',
  },
  {
    id: 'retro-grid',
    name: 'Retro Grid',
    description: '4 photos, vintage orange',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#fbe9e7',
    borderColor: '#bf360c',
    accentColor: '#ff8a65',
    emoji: '📺',
  },
  {
    id: 'midnight-strip',
    name: 'Midnight',
    description: '3 photos, deep blue',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#1a237e',
    borderColor: '#e8eaf6',
    accentColor: '#7986cb',
    emoji: '🌙',
  },
  {
    id: 'cherry-blossom',
    name: 'Sakura',
    description: '4 photos, cherry blossom pink',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#ffeef2',
    borderColor: '#c62828',
    accentColor: '#ef9a9a',
    emoji: '🌸',
  },
  {
    id: 'mint-duo',
    name: 'Mint Fresh',
    description: '2 photos, cool mint',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#e0f2f1',
    borderColor: '#004d40',
    accentColor: '#80cbc4',
    emoji: '🍃',
  },
  {
    id: 'golden-grid',
    name: 'Golden Hour',
    description: '4 photos, warm gold',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#fffde7',
    borderColor: '#f57f17',
    accentColor: '#ffd54f',
    emoji: '✨',
  },
  {
    id: 'polaroid-duo',
    name: 'Polaroid',
    description: '2 photos, instant camera feel',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#fffef5',
    borderColor: '#c8b99a',
    accentColor: '#e8d5b0',
    emoji: '📷',
  },
  {
    id: 'neon-grid',
    name: 'Neon Nights',
    description: '4 photos, electric neon vibes',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#0d0d1a',
    borderColor: '#ff00ff',
    accentColor: '#00ffff',
    emoji: '⚡',
  },
  {
    id: 'forest-trio',
    name: 'Deep Forest',
    description: '3 photos, earthy woodland tones',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#2d3b2d',
    borderColor: '#a8c5a0',
    accentColor: '#6b9e60',
    emoji: '🌲',
  },
  {
    id: 'bubblegum-strip',
    name: 'Bubblegum',
    description: '4 photos, sweet pastel pop',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#fff0f9',
    borderColor: '#e91e8c',
    accentColor: '#ff6ec7',
    emoji: '🩷',
  },
  {
    id: 'ocean-duo',
    name: 'Ocean Breeze',
    description: '2 photos, deep sea teal',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#e0f7fa',
    borderColor: '#006064',
    accentColor: '#26c6da',
    emoji: '🐚',
  },
  {
    id: 'rust-grid',
    name: 'Desert Rust',
    description: '4 photos, terracotta & sand',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#fdf0e6',
    borderColor: '#8b3a1e',
    accentColor: '#d4845a',
    emoji: '🏜️',
  },
  {
    id: 'slate-trio',
    name: 'Slate',
    description: '3 photos, cool industrial grey',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#eceff1',
    borderColor: '#263238',
    accentColor: '#607d8b',
    emoji: '🩶',
  },
  {
    id: 'aurora-strip',
    name: 'Aurora',
    description: '4 photos, northern lights gradient',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#0a1628',
    borderColor: '#00e5a0',
    accentColor: '#7b61ff',
    emoji: '🌌',
  },
  {
    id: 'lemon-duo',
    name: 'Lemon Drop',
    description: '2 photos, zesty citrus yellow',
    photoCount: 2,
    layout: 'strip-2',
    aspectRatio: 4/3,
    color: '#fffde0',
    borderColor: '#c6a800',
    accentColor: '#ffe033',
    emoji: '🍋',
  },
  {
    id: 'candy-grid',
    name: 'Candy Shop',
    description: '4 photos, pastel rainbow grid',
    photoCount: 4,
    layout: 'grid-2x2',
    aspectRatio: 1,
    color: '#fff5fb',
    borderColor: '#ad1457',
    accentColor: '#f48fb1',
    emoji: '🍬',
  },
  {
    id: 'charcoal-trio',
    name: 'Charcoal',
    description: '3 photos, bold monochrome',
    photoCount: 3,
    layout: 'strip-3',
    aspectRatio: 4/3,
    color: '#2b2b2b',
    borderColor: '#f5f5f5',
    accentColor: '#bdbdbd',
    emoji: '🖤',
  },
  {
    id: 'coral-strip',
    name: 'Coral Reef',
    description: '4 photos, tropical coral & aqua',
    photoCount: 4,
    layout: 'strip-4',
    aspectRatio: 4/3,
    color: '#fff4f0',
    borderColor: '#c0392b',
    accentColor: '#ff7f6e',
    emoji: '🪸',
  },
];

export function layoutToConfig(layout: Frame['layout'], photoCount: number, width = 400, height = 600): FrameConfig {
  const pad = 20;
  const gap = 8;
  const elements: FrameElement[] = [];

  if (layout === 'grid-2x2') {
    const w = (width - pad * 2 - gap) / 2;
    const h = w;
    elements.push({ id: 'p1', type: 'photo', x: pad, y: pad + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p2', type: 'photo', x: pad + w + gap, y: pad + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p3', type: 'photo', x: pad, y: pad + 60 + h + gap + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p4', type: 'photo', x: pad + w + gap, y: pad + 60 + h + gap + 60, width: w, height: h, borderRadius: 4 });
  } else if (layout === 'strip-2') {
    const w = (width - pad * 2 - gap) / 2;
    const h = Math.round(w * 3 / 4);
    elements.push({ id: 'p1', type: 'photo', x: pad, y: pad + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p2', type: 'photo', x: pad + w + gap, y: pad + 60, width: w, height: h, borderRadius: 4 });
  } else if (layout === 'strip-3') {
    const w = (width - pad * 2 - gap * 2) / 3;
    const h = Math.round(w * 3 / 4);
    elements.push({ id: 'p1', type: 'photo', x: pad, y: pad + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p2', type: 'photo', x: pad + w + gap, y: pad + 60, width: w, height: h, borderRadius: 4 });
    elements.push({ id: 'p3', type: 'photo', x: pad + (w + gap) * 2, y: pad + 60, width: w, height: h, borderRadius: 4 });
  } else {
    // strip-4 (default)
    const w = width - pad * 2;
    const h = Math.round((w * 3 / 4) * 0.4);
    for (let i = 0; i < 4; i++) {
      elements.push({ id: `p${i + 1}`, type: 'photo', x: pad, y: pad + 60 + i * (h + gap), width: w, height: h, borderRadius: 4 });
    }
  }

  return { width, height, elements, accentSize: 4 };
}

/** Load public frames from Firestore, falling back to static list. */
export async function loadPublicFrames(): Promise<Frame[]> {
  try {
    const remote: PublicFrame[] = await listPublicFrames();
    const active = remote.filter((f) => f.active !== false);
    
    if (active.length > 0) {
      // Convert PublicFrame (simple) to Frame with config
      return active.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        photoCount: f.photoCount,
        layout: f.layout,
        aspectRatio: f.aspectRatio,
        color: f.color,
        borderColor: f.borderColor,
        accentColor: f.accentColor,
        emoji: f.emoji,
        // Use stored config if available, otherwise generate from layout
        config: f.config ?? layoutToConfig(f.layout, f.photoCount),
        width: f.width,
        height: f.height,
      }));
    }
  } catch {
    // Firestore unavailable — use static fallback
  }

  // Convert static legacy frames to also have config
  return FRAMES.map((f) => ({
    ...f,
    config: layoutToConfig(f.layout, f.photoCount),
  }));
}