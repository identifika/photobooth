export interface FrameCandidate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  layout: string;
  config: FrameConfig;
}

export interface FrameConfig {
  width: number;
  height: number;
  color: string;
  bgType: 'solid' | 'gradient';
  bgGradientFrom?: string;
  bgGradientTo?: string;
  bgGradientAngle?: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'ticket' | 'none';
  ticketHoleSize?: number;
  accentColor: string;
  accentSize: number;
  elements: FrameElement[];
}

export type FrameElement =
  | {
      id: string;
      type: 'photo';
      x: number;
      y: number;
      width: number;
      height: number;
      borderRadius: number;
      borderWidth?: number;
      borderColor?: string;
      borderStyle?: string;
      ticketHoleSize?: number;
    }
  | {
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
  | {
      id: string;
      type: 'sticker';
      x: number;
      y: number;
      width: number;
      height: number;
      emoji: string;
      rotation: number;
    }
  | {
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
    }
  | {
      id: string;
      type: 'emoji';
      x: number;
      y: number;
      width: number;
      height: number;
      emoji: string;
      spacing: number;
    };

export interface GeneratedFrames {
  message: string;
  candidates: FrameCandidate[];
  providerUsed: string;
}

export const SYSTEM_PROMPT = `You are an elite Photobooth Frame Designer.
Generate photobooth frame configurations (FrameConfig) from the user request.

CANVAS: width 400, height 600 unless the user asks for square 500x500 or landscape 600x400.
Colors should feel cohesive and finished.

ELEMENT TYPES:
1. photo — camera slot. Fields: id, type "photo", x, y, width, height, borderRadius, borderWidth, borderColor, borderStyle (solid|dashed|dotted|ticket|none).
2. title — caption. Fields: id, type "title", x, y, width, height, text, font, color, fontSize, align (left|center|right).
   Fonts: "Playfair Display", "Cinzel", "Great Vibes", "Cormorant Garamond", "DM Sans", "Inter", "Poppins", "Pacifico", "Dancing Script", "Courier New".
3. sticker — emoji. Fields: id, type "sticker", x, y, width, height (28-44), emoji, rotation (-30 to 30).
4. date — stamp. Fields: id, type "date", x, y, width, height, format, font, color, fontSize, align.
5. emoji — repeating row. Fields: id, type "emoji", x, y, width, height, emoji, spacing.

FRAME: width, height, color, bgType (solid|gradient), bgGradientFrom, bgGradientTo, bgGradientAngle, borderColor, borderWidth, borderStyle, ticketHoleSize, accentColor, accentSize, elements.
Photo slots must stay inside the canvas and must not heavily overlap.

Return strictly valid JSON:
{
  "message": "Short explanation of the design",
  "candidates": [
    {
      "id": "cand-1",
      "name": "Design Name",
      "emoji": "✨",
      "description": "One sentence",
      "layout": "strip-3",
      "config": { "width": 400, "height": 600, "color": "#fdfbf7", "bgType": "solid", "borderColor": "#292524", "borderWidth": 2, "borderStyle": "solid", "accentColor": "#eab308", "accentSize": 4, "elements": [] }
    }
  ]
}`;

function elementId(): string {
  return `el_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function sanitizeCandidate(raw: unknown, index: number): FrameCandidate {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const configIn = record.config && typeof record.config === 'object' ? (record.config as Record<string, unknown>) : {};
  const width = Number(configIn.width) || 400;
  const height = Number(configIn.height) || 600;
  const elementsIn = Array.isArray(configIn.elements) ? configIn.elements : [];
  const elements: FrameElement[] = [];

  for (let i = 0; i < elementsIn.length; i += 1) {
    const el = elementsIn[i];
    if (!el || typeof el !== 'object') continue;
    const item = el as Record<string, unknown>;
    const type = String(item.type || '');
    const id = String(item.id || `el_${index}_${i}`);
    const x = clamp(Number(item.x) || 20, 0, width - 20);
    const y = clamp(Number(item.y) || 20, 0, height - 20);
    const elWidth = clamp(Number(item.width) || 100, 10, width);
    const elHeight = clamp(Number(item.height) || 60, 10, height);
    const align = item.align === 'left' || item.align === 'right' ? item.align : 'center';

    if (type === 'photo') {
      elements.push({
        id,
        type: 'photo',
        x,
        y,
        width: elWidth,
        height: elHeight,
        borderRadius: Number(item.borderRadius) || 6,
        borderWidth: item.borderWidth !== undefined ? Number(item.borderWidth) : 2,
        borderColor: String(item.borderColor || '#1a1410'),
        borderStyle: String(item.borderStyle || 'solid'),
        ticketHoleSize: item.ticketHoleSize ? Number(item.ticketHoleSize) : undefined,
      });
    } else if (type === 'title') {
      elements.push({
        id,
        type: 'title',
        x,
        y,
        width: elWidth,
        height: Math.max(20, elHeight),
        text: String(item.text || 'PHOTOBOOTH').slice(0, 80),
        font: String(item.font || 'Inter'),
        color: String(item.color || '#1a1410'),
        fontSize: Number(item.fontSize) || 16,
        align,
      });
    } else if (type === 'sticker') {
      elements.push({
        id,
        type: 'sticker',
        x,
        y,
        width: Math.min(60, elWidth),
        height: Math.min(60, elHeight),
        emoji: String(item.emoji || '✨').slice(0, 8),
        rotation: Number(item.rotation) || 0,
      });
    } else if (type === 'date') {
      elements.push({
        id,
        type: 'date',
        x,
        y,
        width: elWidth,
        height: Math.max(16, elHeight),
        format: String(item.format || 'YYYY.MM.DD'),
        font: String(item.font || 'Inter'),
        color: String(item.color || '#666666'),
        fontSize: Number(item.fontSize) || 12,
        align,
      });
    } else if (type === 'emoji') {
      elements.push({
        id,
        type: 'emoji',
        x,
        y,
        width: elWidth,
        height: elHeight,
        emoji: String(item.emoji || '✨').slice(0, 8),
        spacing: Number(item.spacing) || 4,
      });
    }
  }

  if (!elements.some((el) => el.type === 'photo')) {
    elements.push({
      id: elementId(),
      type: 'photo',
      x: 24,
      y: 80,
      width: width - 48,
      height: Math.round((width - 48) * 0.75),
      borderRadius: 6,
      borderWidth: 2,
      borderColor: String(configIn.borderColor || '#1a1410'),
      borderStyle: 'solid',
    });
  }

  const borderStyle = ['solid', 'dashed', 'dotted', 'ticket', 'none'].includes(String(configIn.borderStyle))
    ? (configIn.borderStyle as FrameConfig['borderStyle'])
    : 'solid';

  return {
    id: String(record.id || `cand-${index + 1}-${Date.now().toString(36)}`),
    name: String(record.name || `Custom Frame ${index + 1}`).slice(0, 80),
    emoji: String(record.emoji || '✨').slice(0, 8),
    description: String(record.description || 'Custom generated photobooth frame').slice(0, 180),
    layout: String(record.layout || 'strip-custom'),
    config: {
      width,
      height,
      color: String(configIn.color || '#fdfbf7'),
      bgType: configIn.bgType === 'gradient' ? 'gradient' : 'solid',
      bgGradientFrom: configIn.bgGradientFrom ? String(configIn.bgGradientFrom) : undefined,
      bgGradientTo: configIn.bgGradientTo ? String(configIn.bgGradientTo) : undefined,
      bgGradientAngle: Number(configIn.bgGradientAngle) || 135,
      borderColor: String(configIn.borderColor || '#1a1410'),
      borderWidth: Number(configIn.borderWidth) || 3,
      borderStyle,
      ticketHoleSize: borderStyle === 'ticket' ? Number(configIn.ticketHoleSize) || 14 : undefined,
      accentColor: String(configIn.accentColor || '#c9a84c'),
      accentSize: Number(configIn.accentSize) || 4,
      elements,
    },
  };
}

interface Theme {
  name: string;
  emoji: string;
  description: string;
  bgType: 'solid' | 'gradient';
  color: string;
  from?: string;
  to?: string;
  border: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'ticket';
  accent: string;
  font: string;
  title: string;
  stickers: [string, string];
}

const THEMES: Array<{ test: (prompt: string) => boolean; themes: Theme[] }> = [
  {
    test: (p) => /vintage|retro|cinema|90s|ticket|film|sepia|analog/.test(p),
    themes: [
      { name: 'Cinema Ticket Vintage', emoji: '🎞️', description: 'Perforated ticket edges with typewriter type', bgType: 'solid', color: '#f6f1e8', border: '#3c2f2f', borderStyle: 'ticket', accent: '#c49748', font: 'Courier New', title: 'STUDIO PHOTOBOOTH', stickers: ['🎞️', '🎬'] },
      { name: 'Retro 90s Analog', emoji: '📼', description: 'Warm sepia with dashed film borders', bgType: 'gradient', color: '#efe7db', from: '#f9f6f0', to: '#e8dcce', border: '#4a3b32', borderStyle: 'dashed', accent: '#d97736', font: 'Cinzel', title: 'MEMORIES ARCHIVE', stickers: ['✨', '📷'] },
      { name: 'Monochrome Film Noir', emoji: '🖤', description: 'Sharp monochrome strip', bgType: 'solid', color: '#e5e5e5', border: '#171717', borderStyle: 'solid', accent: '#525252', font: 'Playfair Display', title: 'PHOTO STRIP', stickers: ['🖤', '🌙'] },
    ],
  },
  {
    test: (p) => /pastel|cute|pink|kawaii|y2k|soft|floral|flower|heart|princess/.test(p),
    themes: [
      { name: 'Sweet Pastel Cloud', emoji: '🌸', description: 'Rounded pastel cards and floral stickers', bgType: 'gradient', color: '#fff0f5', from: '#ffe4ec', to: '#f3e8ff', border: '#f472b6', borderStyle: 'solid', accent: '#c084fc', font: 'Dancing Script', title: 'sweet moments', stickers: ['🌸', '🎀'] },
      { name: 'Y2K Cyber Angel', emoji: '🪩', description: 'Lilac and baby blue dotted border', bgType: 'gradient', color: '#faf5ff', from: '#f5f3ff', to: '#e0f2fe', border: '#8b5cf6', borderStyle: 'dotted', accent: '#38bdf8', font: 'Poppins', title: 'BESTIES FOREVER', stickers: ['✨', '🦋'] },
      { name: 'Matcha & Vanilla', emoji: '🍵', description: 'Sage and cream ticket edges', bgType: 'gradient', color: '#f0fdf4', from: '#fefce8', to: '#ecfdf5', border: '#15803d', borderStyle: 'ticket', accent: '#84cc16', font: 'Pacifico', title: 'today was good', stickers: ['🍃', '☕'] },
    ],
  },
  {
    test: (p) => /dark|noir|black|moody|night|gothic/.test(p),
    themes: [
      { name: 'Midnight Velvet', emoji: '🌌', description: 'Midnight canvas with gold stars', bgType: 'gradient', color: '#0f172a', from: '#090d16', to: '#1e1b4b', border: '#e2e8f0', borderStyle: 'solid', accent: '#fbbf24', font: 'Cinzel', title: 'MIDNIGHT SPECIAL', stickers: ['🌙', '⭐'] },
      { name: 'Obsidian Noir', emoji: '🖤', description: 'Minimal dark canvas with silver borders', bgType: 'solid', color: '#121212', border: '#e5e5e5', borderStyle: 'solid', accent: '#737373', font: 'Inter', title: 'PHOTOBOOTH SESSION', stickers: ['🖤', '⚡'] },
      { name: 'Gothic Romance', emoji: '🥀', description: 'Wine and black with a serif title', bgType: 'gradient', color: '#1c1917', from: '#2a0808', to: '#0c0a09', border: '#f43f5e', borderStyle: 'dashed', accent: '#e11d48', font: 'Playfair Display', title: 'Forever & Always', stickers: ['🥀', '🖤'] },
    ],
  },
  {
    test: (p) => /wedding|love|couple|bride|groom|romance|elegant|gold/.test(p),
    themes: [
      { name: 'Golden Romance', emoji: '💍', description: 'Ivory linen and polished gold', bgType: 'solid', color: '#fdfbf7', border: '#c9a84c', borderStyle: 'solid', accent: '#e6ca65', font: 'Great Vibes', title: 'Happily Ever After', stickers: ['💍', '✨'] },
      { name: 'Eucalyptus Elegance', emoji: '🌿', description: 'Sage botanical ticket border', bgType: 'gradient', color: '#f4f7f4', from: '#ffffff', to: '#eef3ee', border: '#2d6a4f', borderStyle: 'ticket', accent: '#52b788', font: 'Cormorant Garamond', title: 'THE CELEBRATION', stickers: ['🌿', '🤍'] },
      { name: 'Champagne Gala', emoji: '🥂', description: 'Warm champagne gradient', bgType: 'gradient', color: '#fffbf5', from: '#fffbeb', to: '#fef3c7', border: '#b45309', borderStyle: 'solid', accent: '#d97706', font: 'Cinzel', title: 'LOVE & MEMORIES', stickers: ['🥂', '💕'] },
    ],
  },
  {
    test: (p) => /cyber|neon|future|tech|glow|vapor/.test(p),
    themes: [
      { name: 'Neon Cyberpunk', emoji: '⚡', description: 'Cyan and magenta on a dark field', bgType: 'gradient', color: '#090d16', from: '#090d16', to: '#2e1065', border: '#06b6d4', borderStyle: 'solid', accent: '#ec4899', font: 'Inter', title: 'CYBER//PHOTOBOOTH', stickers: ['⚡', '🔮'] },
      { name: 'Vaporwave Sunset', emoji: '🌇', description: 'Neon purple into warm orange', bgType: 'gradient', color: '#1e1b4b', from: '#4c1d95', to: '#c2410c', border: '#f43f5e', borderStyle: 'ticket', accent: '#fbbf24', font: 'Poppins', title: 'RETROWAVE', stickers: ['🌴', '🌅'] },
      { name: 'Matrix Acid Green', emoji: '🟩', description: 'Terminal green on black', bgType: 'solid', color: '#050b07', border: '#22c55e', borderStyle: 'dashed', accent: '#4ade80', font: 'Courier New', title: '[ SYSTEM_READY ]', stickers: ['⚡', '👾'] },
    ],
  },
];

const DEFAULT_THEMES: Theme[] = [
  { name: 'Modern Studio Strip', emoji: '📷', description: 'Editorial beige canvas with dark borders', bgType: 'solid', color: '#f5f0e8', border: '#1a1410', borderStyle: 'solid', accent: '#c9a84c', font: 'DM Sans', title: 'STUDIO SNAPSHOTS', stickers: ['✨', '📷'] },
  { name: 'Sunset Glow Ticket', emoji: '🌅', description: 'Peach-to-honey ticket border', bgType: 'gradient', color: '#fff3e0', from: '#fff7ed', to: '#ffedd5', border: '#ea580c', borderStyle: 'ticket', accent: '#f97316', font: 'Playfair Display', title: 'Golden Hour Moments', stickers: ['🌅', '💛'] },
  { name: 'Minimalist Luxe', emoji: '💎', description: 'Off-white with quiet typography', bgType: 'solid', color: '#fafafa', border: '#27272a', borderStyle: 'solid', accent: '#a1a1aa', font: 'Inter', title: 'PHOTO ARCHIVE', stickers: ['⭐', '✨'] },
];

function photoCountFor(prompt: string): number {
  if (/1 photo|single|1 slot|1 picture/.test(prompt)) return 1;
  if (/2 photo|duo|double|2 slot|2 picture|\bpair\b/.test(prompt)) return 2;
  if (/4 photo|quad|4 slot|4 picture|2x2|\bgrid\b/.test(prompt)) return 4;
  return 3;
}

function isDarkColor(color: string): boolean {
  return color.startsWith('#0') || color.startsWith('#1') || color === '#050b07';
}

export function generateAlgorithmicFrames(prompt: string, count: number): FrameCandidate[] {
  const normalized = prompt.toLowerCase();
  const slots = photoCountFor(normalized);
  const group = THEMES.find((entry) => entry.test(normalized));
  const themes = (group?.themes || DEFAULT_THEMES).slice(0, Math.max(1, Math.min(count, 3)));
  const width = 400;
  const height = 600;

  return themes.map((theme, index) => {
    const elements: FrameElement[] = [];
    const pad = 24;
    const gap = 10;
    const headerY = pad + 6;
    const ink = isDarkColor(theme.color) ? '#f8fafc' : theme.border;
    elements.push({
      id: elementId(),
      type: 'title',
      x: pad,
      y: headerY,
      width: width - pad * 2,
      height: 34,
      text: theme.title,
      font: theme.font,
      color: ink,
      fontSize: 16,
      align: 'center',
    });
    elements.push({ id: elementId(), type: 'sticker', x: pad + 4, y: headerY - 2, width: 26, height: 26, emoji: theme.stickers[0], rotation: -12 });
    elements.push({ id: elementId(), type: 'sticker', x: width - pad - 30, y: headerY - 2, width: 26, height: 26, emoji: theme.stickers[1], rotation: 12 });

    const photosTop = headerY + 46;
    const availH = height - photosTop - 52;
    const grid = slots === 4 && /grid|2x2/.test(normalized);
    if (grid) {
      const slotW = Math.round((width - pad * 2 - gap) / 2);
      for (let i = 0; i < 4; i += 1) {
        elements.push({
          id: elementId(),
          type: 'photo',
          x: pad + (i % 2) * (slotW + gap),
          y: photosTop + 14 + Math.floor(i / 2) * (slotW + gap),
          width: slotW,
          height: slotW,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: theme.border,
          borderStyle: 'solid',
        });
      }
    } else {
      const slotH = Math.round((availH - (slots - 1) * gap) / slots);
      for (let i = 0; i < slots; i += 1) {
        elements.push({
          id: elementId(),
          type: 'photo',
          x: pad,
          y: photosTop + i * (slotH + gap),
          width: width - pad * 2,
          height: slotH,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: theme.border,
          borderStyle: 'solid',
        });
      }
    }

    elements.push({
      id: elementId(),
      type: 'date',
      x: pad,
      y: height - pad - 18,
      width: width - pad * 2,
      height: 20,
      format: 'YYYY.MM.DD',
      font: theme.font,
      color: isDarkColor(theme.color) ? '#94a3b8' : theme.border,
      fontSize: 11,
      align: 'center',
    });

    return {
      id: `cand-${index + 1}-${Date.now().toString(36)}`,
      name: theme.name,
      emoji: theme.emoji,
      description: theme.description,
      layout: `strip-${slots}`,
      config: {
        width,
        height,
        color: theme.color,
        bgType: theme.bgType,
        bgGradientFrom: theme.from,
        bgGradientTo: theme.to,
        bgGradientAngle: 135,
        borderColor: theme.border,
        borderWidth: 3,
        borderStyle: theme.borderStyle,
        ticketHoleSize: theme.borderStyle === 'ticket' ? 14 : undefined,
        accentColor: theme.accent,
        accentSize: 4,
        elements,
      },
    };
  });
}

export function buildUserInstruction(input: {
  prompt: string;
  count: number;
  chatHistory?: Array<{ role: string; content: string }>;
  currentFrame?: unknown;
}): string {
  const history = (input.chatHistory || [])
    .slice(-6)
    .map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${String(turn.content || '').slice(0, 500)}`)
    .join('\n');
  let current = '';
  if (input.currentFrame && typeof input.currentFrame === 'object') {
    current = `\nCurrent canvas (refine this, do not ignore it):\n${JSON.stringify(input.currentFrame).slice(0, 2000)}`;
  }
  const prior = history ? `\nRecent conversation:\n${history}\n` : '';
  return `Generate ${input.count} distinct photobooth frame variations for this request:\n\n"${input.prompt}"${prior}${current}\n\nReturn strictly JSON with "message" and a "candidates" array of exactly ${input.count} frames.`;
}
