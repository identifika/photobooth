import { NextResponse } from 'next/server';
import type { FrameConfig, FrameElement, FramePhotoElement, FrameTitleElement, FrameStickerElement, FrameDateElement } from '@/lib/frame-types';
import type { AiFrameCandidate } from '@/lib/ai-agent';
import { verifyIdToken, checkIsAdmin } from '@/lib/auth-server';

import { prisma } from '@/lib/db';

const DAILY_LIMIT = 3;

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// In-memory fallback tracking in case DB is temporarily unreachable
const memoryUsageMap = new Map<string, number>();

async function getUserUsageToday(uid: string): Promise<number> {
  const today = getTodayKey();
  try {
    const row = await prisma.aiDailyUsage.findUnique({
      where: { uid_usageDate: { uid, usageDate: today } },
    });
    return row?.count || 0;
  } catch (err) {
    console.warn('Failed to read ai_daily_usage from Postgres, using memory fallback:', err);
    return memoryUsageMap.get(`${uid}_${today}`) || 0;
  }
}

async function incrementUserUsageToday(
  uid: string,
  email: string,
  prompt: string,
  currentCount: number
): Promise<number> {
  const today = getTodayKey();
  const memKey = `${uid}_${today}`;
  const newCount = currentCount + 1;
  memoryUsageMap.set(memKey, newCount);

  try {
    const row = await prisma.aiDailyUsage.upsert({
      where: { uid_usageDate: { uid, usageDate: today } },
      create: {
        uid,
        email: email || '',
        usageDate: today,
        count: 1,
        lastPrompt: prompt.slice(0, 200),
      },
      update: {
        count: { increment: 1 },
        email: email || undefined,
        lastPrompt: prompt.slice(0, 200),
      },
    });
    return row.count;
  } catch (err) {
    console.warn('Failed to persist ai_daily_usage in Postgres:', err);
    return newCount;
  }
}

// Helper to generate unique IDs
function uid(): string {
  return 'el_' + Math.random().toString(36).substring(2, 9);
}

// System prompt explaining the FrameConfig schema and photobooth design rules
const SYSTEM_PROMPT = `You are an elite Photobooth Frame Designer and Creative AI Agent.
Your job is to generate photobooth frame configurations (FrameConfig) based on user requests.

CANVAS SPECIFICATIONS:
- Standard photobooth size: width = 400, height = 600 (or square 500x500, or landscape 600x400 if user asks).
- Color schemes should feel premium, trendy, cohesive, and modern (e.g., pastel aesthetic, retro cinema, moody noir, elegant wedding gold, cyberpunk neon, minimalist).

ELEMENT TYPES SUPPORTED:
1. "photo": The photo cutout slots where user's camera photos appear!
   - id: string
   - type: "photo"
   - x: number, y: number, width: number, height: number
   - borderRadius: number (e.g., 0 to 16)
   - borderWidth?: number (0, 1, 2, or 4)
   - borderColor?: string
   - borderStyle?: "solid" | "dashed" | "dotted" | "ticket" | "none"
   - ticketHoleSize?: number

2. "title": Text banner/captions (e.g. event name, cute phrase, hashtag)
   - id: string
   - type: "title"
   - x: number, y: number, width: number, height: number
   - text: string
   - font: string (Choose from: "Playfair Display", "Cinzel", "Great Vibes", "Cormorant Garamond", "DM Sans", "Inter", "Poppins", "Lato", "Roboto", "Georgia", "Pacifico", "Dancing Script", "Courier New")
   - color: string
   - fontSize: number (e.g., 14 to 32)
   - align: "left" | "center" | "right"

3. "sticker": Decorative emoji sticker
   - id: string
   - type: "sticker"
   - x: number, y: number, width: number, height: number (typically 28 to 44)
   - emoji: string (e.g. "✨", "🌸", "💕", "🎞️", "🖤", "💍", "🦋")
   - rotation: number (-30 to 30)

4. "date": Date stamp
   - id: string
   - type: "date"
   - x: number, y: number, width: number, height: number
   - format: string (e.g., "YYYY.MM.DD", "DD MMM YYYY")
   - font: string
   - color: string
   - fontSize: number (e.g., 10 to 14)
   - align: "left" | "center" | "right"

5. "emoji": Repeating emoji row
   - id: string
   - type: "emoji"
   - x: number, y: number, width: number, height: number
   - emoji: string
   - spacing: number

FRAME TOP-LEVEL CONFIG:
- width: number (typically 400)
- height: number (typically 600)
- color: string (e.g. background hex)
- bgType: "solid" | "gradient"
- bgGradientFrom?: string
- bgGradientTo?: string
- bgGradientAngle?: number (e.g., 135)
- borderColor: string
- borderWidth: number (e.g., 2 to 6)
- borderStyle: "solid" | "dashed" | "dotted" | "ticket" | "none"
- ticketHoleSize?: number (e.g., 12 to 18 if borderStyle is ticket)
- accentColor: string
- accentSize: number (0 to 6)
- elements: Array of elements above. Photo slots must NOT heavily overlap each other, and must stay within canvas bounds!

OUTPUT FORMAT:
You MUST output strictly valid JSON matching this schema:
{
  "message": "Friendly response explaining the design choices...",
  "candidates": [
    {
      "id": "cand-1",
      "name": "Design Name",
      "emoji": "✨",
      "description": "Short 1-sentence description",
      "layout": "strip-3",
      "config": {
        "width": 400,
        "height": 600,
        "color": "#fdfbf7",
        "bgType": "solid",
        "borderColor": "#292524",
        "borderWidth": 2,
        "borderStyle": "solid",
        "accentColor": "#eab308",
        "accentSize": 4,
        "elements": [...]
      }
    }
  ]
}
`;

// Fallback intelligent algorithmic generator
function generateAlgorithmicFrames(prompt: string, count: number = 3): AiFrameCandidate[] {
  const p = prompt.toLowerCase();
  
  // Detect desired photo count
  let photoCount = 3; // default
  if (p.includes('1 photo') || p.includes('single') || p.includes('1 slot') || p.includes('1 picture')) photoCount = 1;
  else if (p.includes('2 photo') || p.includes('duo') || p.includes('double') || p.includes('2 slot') || p.includes('2 picture') || p.includes('pair')) photoCount = 2;
  else if (p.includes('4 photo') || p.includes('quad') || p.includes('4 slot') || p.includes('4 picture') || p.includes('grid') || p.includes('2x2')) photoCount = 4;
  else if (p.includes('3 photo') || p.includes('triple') || p.includes('trio') || p.includes('3 slot') || p.includes('3 picture')) photoCount = 3;

  // Aesthetic detection
  const isVintage = p.includes('vintage') || p.includes('retro') || p.includes('cinema') || p.includes('90s') || p.includes('ticket') || p.includes('film') || p.includes('sepia') || p.includes('analog');
  const isPastel = p.includes('pastel') || p.includes('cute') || p.includes('pink') || p.includes('kawaii') || p.includes('y2k') || p.includes('soft') || p.includes('floral') || p.includes('flower');
  const isDark = p.includes('dark') || p.includes('noir') || p.includes('black') || p.includes('moody') || p.includes('night') || p.includes('gothic');
  const isWedding = p.includes('wedding') || p.includes('love') || p.includes('couple') || p.includes('bride') || p.includes('groom') || p.includes('romance') || p.includes('elegant') || p.includes('gold');
  const isCyber = p.includes('cyber') || p.includes('neon') || p.includes('future') || p.includes('tech') || p.includes('purple') || p.includes('glow');

  const W = 400;
  const H = 600;

  const variations: Array<{
    name: string;
    emoji: string;
    desc: string;
    bgType: 'solid' | 'gradient';
    color: string;
    bgFrom?: string;
    bgTo?: string;
    border: string;
    borderStyle: 'solid' | 'dashed' | 'dotted' | 'ticket';
    accent: string;
    font: string;
    titleText: string;
    stickers: string[];
    photoSlots: number;
    isGrid?: boolean;
  }> = [];

  if (isVintage) {
    variations.push({
      name: 'Cinema Ticket Vintage',
      emoji: '🎞️',
      desc: 'Nostalgic cinema ticket with perforated edges and typewriter typography',
      bgType: 'solid',
      color: '#f6f1e8',
      border: '#3c2f2f',
      borderStyle: 'ticket',
      accent: '#c49748',
      font: 'Courier New',
      titleText: 'STUDIO PHOTOBOOTH',
      stickers: ['🎞️', '⭐', '🎬'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Retro 90s Analog',
      emoji: '📼',
      desc: 'Warm sepia tones with dashed film reel borders and classic stamp',
      bgType: 'gradient',
      color: '#efe7db',
      bgFrom: '#f9f6f0',
      bgTo: '#e8dcce',
      border: '#4a3b32',
      borderStyle: 'dashed',
      accent: '#d97736',
      font: 'Cinzel',
      titleText: 'MEMORIES ARCHIVE',
      stickers: ['✨', '📷', '☕'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Monochrome Film Noir',
      emoji: '🖤',
      desc: 'Dramatic vintage monochrome with sharp solid border lines',
      bgType: 'solid',
      color: '#e5e5e5',
      border: '#171717',
      borderStyle: 'solid',
      accent: '#525252',
      font: 'Playfair Display',
      titleText: 'PHOTO STRIP • 1994',
      stickers: ['🖤', '⚡', '🌙'],
      photoSlots: photoCount,
    });
  } else if (isPastel || isCute(p)) {
    variations.push({
      name: 'Sweet Pastel Cloud',
      emoji: '🌸',
      desc: 'Soft gradient glow with rounded photo cards and lovely floral stickers',
      bgType: 'gradient',
      color: '#fff0f5',
      bgFrom: '#ffe4ec',
      bgTo: '#f3e8ff',
      border: '#f472b6',
      borderStyle: 'solid',
      accent: '#c084fc',
      font: 'Dancing Script',
      titleText: 'sweet moments ♡',
      stickers: ['🌸', '✨', '🎀'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Y2K Cyber Angel',
      emoji: '🪩',
      desc: 'Lilac and baby blue aesthetic with playful dotted borders',
      bgType: 'gradient',
      color: '#faf5ff',
      bgFrom: '#f5f3ff',
      bgTo: '#e0f2fe',
      border: '#8b5cf6',
      borderStyle: 'dotted',
      accent: '#38bdf8',
      font: 'Poppins',
      titleText: 'BESTIES FOREVER',
      stickers: ['✨', '💖', '🦋'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Matcha & Vanilla',
      emoji: '🍵',
      desc: 'Cozy pastel sage and cream tones with gentle ticket edges',
      bgType: 'gradient',
      color: '#f0fdf4',
      bgFrom: '#fefce8',
      bgTo: '#ecfdf5',
      border: '#15803d',
      borderStyle: 'ticket',
      accent: '#84cc16',
      font: 'Pacifico',
      titleText: 'today was good',
      stickers: ['🍃', '🍀', '☕'],
      photoSlots: photoCount,
    });
  } else if (isDark) {
    variations.push({
      name: 'Midnight Velvet',
      emoji: '🌌',
      desc: 'Deep midnight aesthetic with celestial gold stars and clean borders',
      bgType: 'gradient',
      color: '#0f172a',
      bgFrom: '#090d16',
      bgTo: '#1e1b4b',
      border: '#e2e8f0',
      borderStyle: 'solid',
      accent: '#fbbf24',
      font: 'Cinzel',
      titleText: 'MIDNIGHT SPECIAL',
      stickers: ['🌙', '✨', '⭐'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Obsidian Noir',
      emoji: '🖤',
      desc: 'Ultra minimalist pure dark with contrasting silver borders',
      bgType: 'solid',
      color: '#121212',
      border: '#e5e5e5',
      borderStyle: 'solid',
      accent: '#737373',
      font: 'Inter',
      titleText: 'PHOTOBOOTH SESSION',
      stickers: ['🖤', '⚡', '👁️'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Gothic Romance',
      emoji: '🥀',
      desc: 'Dramatic wine red and black palette with ornate serif lettering',
      bgType: 'gradient',
      color: '#1c1917',
      bgFrom: '#2a0808',
      bgTo: '#0c0a09',
      border: '#f43f5e',
      borderStyle: 'dashed',
      accent: '#e11d48',
      font: 'Playfair Display',
      titleText: 'Forever & Always',
      stickers: ['🥀', '🖤', '🍷'],
      photoSlots: photoCount,
    });
  } else if (isWedding) {
    variations.push({
      name: 'Golden Romance',
      emoji: '💍',
      desc: 'Ivory linen with polished gold borders and romantic calligraphy',
      bgType: 'solid',
      color: '#fdfbf7',
      border: '#c9a84c',
      borderStyle: 'solid',
      accent: '#e6ca65',
      font: 'Great Vibes',
      titleText: 'Happily Ever After',
      stickers: ['💍', '🕊️', '✨'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Eucalyptus Elegance',
      emoji: '🌿',
      desc: 'Subtle sage botanical hues with delicate ticket border perforations',
      bgType: 'gradient',
      color: '#f4f7f4',
      bgFrom: '#ffffff',
      bgTo: '#eef3ee',
      border: '#2d6a4f',
      borderStyle: 'ticket',
      accent: '#52b788',
      font: 'Cormorant Garamond',
      titleText: 'THE CELEBRATION',
      stickers: ['🌿', '🤍', '🍃'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Champagne Gala',
      emoji: '🥂',
      desc: 'Warm champagne gradient with refined serif title and date stamp',
      bgType: 'gradient',
      color: '#fffbf5',
      bgFrom: '#fffbeb',
      bgTo: '#fef3c7',
      border: '#b45309',
      borderStyle: 'solid',
      accent: '#d97706',
      font: 'Cinzel',
      titleText: 'LOVE & MEMORIES',
      stickers: ['🥂', '💕', '⭐'],
      photoSlots: photoCount,
    });
  } else if (isCyber) {
    variations.push({
      name: 'Neon Cyberpunk',
      emoji: '⚡',
      desc: 'Dark electric cyan and magenta aesthetic with high-tech badge',
      bgType: 'gradient',
      color: '#090d16',
      bgFrom: '#090d16',
      bgTo: '#2e1065',
      border: '#06b6d4',
      borderStyle: 'solid',
      accent: '#ec4899',
      font: 'Inter',
      titleText: 'CYBER//PHOTOBOOTH',
      stickers: ['⚡', '🔮', '🛸'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Vaporwave Sunset',
      emoji: '🌇',
      desc: 'Sunset gradient between neon purple and warm orange',
      bgType: 'gradient',
      color: '#1e1b4b',
      bgFrom: '#4c1d95',
      bgTo: '#c2410c',
      border: '#f43f5e',
      borderStyle: 'ticket',
      accent: '#fbbf24',
      font: 'Poppins',
      titleText: 'RETROWAVE 1988',
      stickers: ['🌴', '💫', '🌅'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Matrix Acid Green',
      emoji: '🟩',
      desc: 'Terminal green and deep black palette with typewriter text',
      bgType: 'solid',
      color: '#050b07',
      border: '#22c55e',
      borderStyle: 'dashed',
      accent: '#4ade80',
      font: 'Courier New',
      titleText: '[ SYSTEM_READY ]',
      stickers: ['⚡', '🤖', '👾'],
      photoSlots: photoCount,
    });
  } else {
    // Default balanced trendy designs
    variations.push({
      name: 'Modern Studio Strip',
      emoji: '📷',
      desc: 'Clean editorial beige canvas with balanced dark borders',
      bgType: 'solid',
      color: '#f5f0e8',
      border: '#1a1410',
      borderStyle: 'solid',
      accent: '#c9a84c',
      font: 'DM Sans',
      titleText: 'STUDIO SNAPSHOTS',
      stickers: ['✨', '📷', '💫'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Sunset Glow Ticket',
      emoji: '🌅',
      desc: 'Warm peach-to-honey gradient with classic ticket notch borders',
      bgType: 'gradient',
      color: '#fff3e0',
      bgFrom: '#fff7ed',
      bgTo: '#ffedd5',
      border: '#ea580c',
      borderStyle: 'ticket',
      accent: '#f97316',
      font: 'Playfair Display',
      titleText: 'Golden Hour Moments',
      stickers: ['🌅', '✨', '💛'],
      photoSlots: photoCount,
    });
    variations.push({
      name: 'Minimalist Luxe Grid',
      emoji: '💎',
      desc: 'Understated off-white with delicate accents and clean typography',
      bgType: 'solid',
      color: '#fafafa',
      border: '#27272a',
      borderStyle: 'solid',
      accent: '#a1a1aa',
      font: 'Inter',
      titleText: 'PHOTO ARCHIVE',
      stickers: ['⭐', '🖤', '✨'],
      photoSlots: photoCount === 1 ? 1 : 4,
      isGrid: true,
    });
  }

  const selectedVariations = variations.slice(0, Math.max(1, Math.min(count, 3)));

  return selectedVariations.map((v, idx) => {
    const elements: FrameElement[] = [];
    const pad = 24;
    const gap = 10;
    const titleH = 34;
    const headerY = pad + 6;

    // Header title
    const titleEl: FrameTitleElement = {
      id: uid(),
      type: 'title',
      x: pad,
      y: headerY,
      width: W - pad * 2,
      height: titleH,
      text: v.titleText,
      font: v.font,
      color: v.border === '#e2e8f0' || v.color.startsWith('#0') || v.color.startsWith('#1') ? '#f8fafc' : v.border,
      fontSize: 16,
      align: 'center',
    };
    elements.push(titleEl);

    // Decorative stickers
    if (v.stickers.length >= 2) {
      elements.push({
        id: uid(),
        type: 'sticker',
        x: pad + 4,
        y: headerY - 2,
        width: 26,
        height: 26,
        emoji: v.stickers[0],
        rotation: -12,
      });
      elements.push({
        id: uid(),
        type: 'sticker',
        x: W - pad - 30,
        y: headerY - 2,
        width: 26,
        height: 26,
        emoji: v.stickers[1],
        rotation: 12,
      });
    }

    // Photo slots
    const photosTop = headerY + titleH + 12;
    const bottomSpace = 52;
    const availH = H - photosTop - bottomSpace;

    if (v.isGrid || v.photoSlots === 4 && (p.includes('grid') || p.includes('2x2'))) {
      const slotW = Math.round((W - pad * 2 - gap) / 2);
      const slotH = slotW;
      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        elements.push({
          id: uid(),
          type: 'photo',
          x: pad + col * (slotW + gap),
          y: photosTop + 14 + row * (slotH + gap),
          width: slotW,
          height: slotH,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: v.border,
          borderStyle: 'solid',
        });
      }
    } else {
      const n = v.photoSlots;
      const slotW = W - pad * 2;
      const totalGaps = (n - 1) * gap;
      const slotH = Math.round((availH - totalGaps) / n);

      for (let i = 0; i < n; i++) {
        const slotEl: FramePhotoElement = {
          id: uid(),
          type: 'photo',
          x: pad,
          y: photosTop + i * (slotH + gap),
          width: slotW,
          height: slotH,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: v.border,
          borderStyle: 'solid',
        };
        elements.push(slotEl);
      }
    }

    // Footer date element
    const dateEl: FrameDateElement = {
      id: uid(),
      type: 'date',
      x: pad,
      y: H - pad - 18,
      width: W - pad * 2,
      height: 20,
      format: 'YYYY.MM.DD',
      font: v.font,
      color: v.border === '#e2e8f0' || v.color.startsWith('#0') || v.color.startsWith('#1') ? '#94a3b8' : v.border + 'bb',
      fontSize: 11,
      align: 'center',
    };
    elements.push(dateEl);

    // Build the FrameConfig
    const config: FrameConfig = {
      width: W,
      height: H,
      color: v.color,
      bgType: v.bgType,
      bgGradientFrom: v.bgFrom,
      bgGradientTo: v.bgTo,
      bgGradientAngle: 135,
      borderColor: v.border,
      borderWidth: 3,
      borderStyle: v.borderStyle,
      ticketHoleSize: v.borderStyle === 'ticket' ? 14 : undefined,
      accentColor: v.accent,
      accentSize: 4,
      elements,
    };

    return {
      id: `cand-${idx + 1}-${Date.now().toString(36)}`,
      name: v.name,
      emoji: v.emoji,
      description: v.desc,
      layout: `strip-${v.photoSlots}`,
      config,
    };
  });
}

function isCute(p: string): boolean {
  return p.includes('flower') || p.includes('heart') || p.includes('princess') || p.includes('anime') || p.includes('friend');
}

// Sanitize and validate LLM output candidate
function sanitizeCandidate(raw: any, index: number): AiFrameCandidate {
  const W = Number(raw?.config?.width) || 400;
  const H = Number(raw?.config?.height) || 600;

  const rawElements = Array.isArray(raw?.config?.elements) ? raw.config.elements : [];
  const sanitizedElements: FrameElement[] = [];

  for (let i = 0; i < rawElements.length; i++) {
    const el = rawElements[i];
    if (!el || typeof el !== 'object' || !el.type) continue;
    const baseId = el.id || `el_${index}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const x = Math.max(0, Math.min(W - 20, Number(el.x) || 20));
    const y = Math.max(0, Math.min(H - 20, Number(el.y) || 20));
    const width = Math.max(10, Math.min(W, Number(el.width) || 100));
    const height = Math.max(10, Math.min(H, Number(el.height) || 60));

    if (el.type === 'photo') {
      sanitizedElements.push({
        id: baseId,
        type: 'photo',
        x,
        y,
        width,
        height,
        borderRadius: Number(el.borderRadius) || 6,
        borderWidth: el.borderWidth !== undefined ? Number(el.borderWidth) : 2,
        borderColor: el.borderColor || '#1a1410',
        borderStyle: el.borderStyle || 'solid',
        ticketHoleSize: el.ticketHoleSize ? Number(el.ticketHoleSize) : undefined,
      });
    } else if (el.type === 'title') {
      sanitizedElements.push({
        id: baseId,
        type: 'title',
        x,
        y,
        width,
        height: Math.max(20, height),
        text: String(el.text || 'PHOTOBOOTH'),
        font: el.font || 'Inter',
        color: el.color || '#1a1410',
        fontSize: Number(el.fontSize) || 16,
        align: el.align === 'left' || el.align === 'right' ? el.align : 'center',
      });
    } else if (el.type === 'sticker') {
      sanitizedElements.push({
        id: baseId,
        type: 'sticker',
        x,
        y,
        width: Math.min(60, width),
        height: Math.min(60, height),
        emoji: String(el.emoji || '✨'),
        rotation: Number(el.rotation) || 0,
      });
    } else if (el.type === 'date') {
      sanitizedElements.push({
        id: baseId,
        type: 'date',
        x,
        y,
        width,
        height: Math.max(16, height),
        format: el.format || 'YYYY.MM.DD',
        font: el.font || 'Inter',
        color: el.color || '#666666',
        fontSize: Number(el.fontSize) || 12,
        align: el.align === 'left' || el.align === 'right' ? el.align : 'center',
      });
    } else if (el.type === 'emoji') {
      sanitizedElements.push({
        id: baseId,
        type: 'emoji',
        x,
        y,
        width,
        height,
        emoji: String(el.emoji || '✨'),
        spacing: Number(el.spacing) || 4,
      });
    }
  }

  // Ensure there's at least one photo slot
  const hasPhotos = sanitizedElements.some((e) => e.type === 'photo');
  if (!hasPhotos) {
    sanitizedElements.push({
      id: uid(),
      type: 'photo',
      x: 24,
      y: 80,
      width: W - 48,
      height: Math.round((W - 48) * 0.75),
      borderRadius: 6,
      borderWidth: 2,
      borderColor: raw?.config?.borderColor || '#1a1410',
      borderStyle: 'solid',
    });
  }

  const config: FrameConfig = {
    width: W,
    height: H,
    color: raw?.config?.color || '#fdfbf7',
    bgType: raw?.config?.bgType === 'gradient' ? 'gradient' : 'solid',
    bgGradientFrom: raw?.config?.bgGradientFrom,
    bgGradientTo: raw?.config?.bgGradientTo,
    bgGradientAngle: raw?.config?.bgGradientAngle || 135,
    borderColor: raw?.config?.borderColor || '#1a1410',
    borderWidth: Number(raw?.config?.borderWidth) ?? 3,
    borderStyle: raw?.config?.borderStyle || 'solid',
    ticketHoleSize: raw?.config?.ticketHoleSize ? Number(raw?.config?.ticketHoleSize) : undefined,
    accentColor: raw?.config?.accentColor || '#c9a84c',
    accentSize: Number(raw?.config?.accentSize) ?? 4,
    elements: sanitizedElements,
  };

  return {
    id: raw?.id || `cand-${index + 1}-${Date.now().toString(36)}`,
    name: raw?.name || `Custom Frame ${index + 1}`,
    emoji: raw?.emoji || '✨',
    description: raw?.description || 'Custom generated photobooth frame',
    layout: raw?.layout || 'strip-custom',
    config,
  };
}

// ── Multi-Provider Callers ──

async function callGoogleGemini(apiKey: string, prompt: string, count: number, modelName?: string): Promise<{ message: string; candidates: AiFrameCandidate[] }> {
  const model = modelName || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const userInstruction = `Generate ${count} distinct and creative photobooth frame design variations for the following user request:\n\n"${prompt}"\n\nReturn strictly JSON with "message" and "candidates" array (containing exactly ${count} candidate frames).`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userInstruction }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response received from Gemini');

  const parsed = JSON.parse(text);
  const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [parsed];
  const candidates = rawCandidates.slice(0, count).map(sanitizeCandidate);

  return {
    message: parsed.message || `Here are ${candidates.length} custom frame designs tailored to your request!`,
    candidates,
  };
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  count: number
): Promise<{ message: string; candidates: AiFrameCandidate[] }> {
  const userInstruction = `Generate ${count} distinct and creative photobooth frame design variations for the following user request:\n\n"${prompt}"\n\nReturn strictly valid JSON with "message" and "candidates" array (containing exactly ${count} candidate frames).`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInstruction },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response received from model');

  const parsed = JSON.parse(content);
  const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [parsed];
  const candidates = rawCandidates.slice(0, count).map(sanitizeCandidate);

  return {
    message: parsed.message || `Here are ${candidates.length} custom frame designs tailored to your request!`,
    candidates,
  };
}

// ── Main Route Handler ──

// ── GET: Check current user's daily prompt usage status ──
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const authUser = await verifyIdToken(authHeader);
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : null;

    if (!authUser) {
      return NextResponse.json({
        authenticated: false,
        isAdmin: false,
        usedToday: 0,
        maxDaily: DAILY_LIMIT,
        remainingToday: 0,
      });
    }

    const isAdmin = checkIsAdmin(authUser.email);
    const usedToday = await getUserUsageToday(authUser.uid);
    const remainingToday = isAdmin ? null : Math.max(0, DAILY_LIMIT - usedToday);

    return NextResponse.json({
      authenticated: true,
      isAdmin,
      usedToday,
      maxDaily: isAdmin ? null : DAILY_LIMIT,
      remainingToday,
    });
  } catch (err: any) {
    console.error('AI usage check error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Main Route Handler ──
export async function POST(request: Request) {
  try {
    // 1. Require Authenticated User
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const authUser = await verifyIdToken(authHeader);

    if (!authUser) {
      return NextResponse.json(
        {
          error: 'Authentication required. Please sign in to use the AI Frame Designer.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 2. Check Admin & Daily Prompt Limit (Max 3 prompts/day for non-admins)
    const isAdmin = checkIsAdmin(authUser.email);
    let currentUsage = 0;

    if (!isAdmin) {
      currentUsage = await getUserUsageToday(authUser.uid);
      if (currentUsage >= DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: `You have reached your daily limit of ${DAILY_LIMIT} AI frame prompts. Limit resets tomorrow!`,
            code: 'DAILY_LIMIT_EXCEEDED',
            usedToday: currentUsage,
            maxDaily: DAILY_LIMIT,
            remainingToday: 0,
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const prompt = (body.prompt || '').trim();
    const count = Math.max(1, Math.min(Number(body.count) || 3, 3));
    // General Unified Environment Configuration
    const envProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const envModel = (process.env.AI_MODEL || '').trim();
    const envApiKey = (process.env.AI_API_KEY || '').trim();
    const envBaseUrl = (process.env.AI_BASE_URL || '').trim();

    // Request overrides (if explicitly selected by user in UI settings)
    const provider = body.provider && body.provider !== 'auto' ? body.provider : envProvider;
    const clientKey = (body.apiKey || '').trim();
    const customModel = (body.model || '').trim();
    const customBaseUrl = (body.baseUrl || '').trim() || envBaseUrl;

    // Resolve unified API key (client key -> general AI_API_KEY -> provider-specific fallback)
    const generalKey = clientKey || envApiKey;
    const geminiKey = generalKey || process.env.GEMINI_API_KEY || '';
    const groqKey = generalKey || process.env.GROQ_API_KEY || '';
    const openaiKey = generalKey || process.env.OPENAI_API_KEY || '';

    // Resolve unified model name
    const activeModel = customModel || envModel;
    const geminiModel = activeModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const groqModel = activeModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const openaiModel = activeModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const customModelName = activeModel || 'llama3';

    let generatedResult: { message: string; candidates: AiFrameCandidate[]; providerUsed: string } | null = null;

    // Provider: Google Gemini
    if (provider === 'gemini' || (provider === 'auto' && geminiKey)) {
      if (geminiKey) {
        try {
          const res = await callGoogleGemini(geminiKey, prompt, count, geminiModel);
          generatedResult = {
            ...res,
            providerUsed: `Google Gemini (${geminiModel})`,
          };
        } catch (err: any) {
          console.warn('Gemini call failed, falling back to algorithmic engine:', err?.message);
          if (provider === 'gemini') throw err;
        }
      }
    }

    // Provider: Groq
    if (!generatedResult && (provider === 'groq' || (provider === 'auto' && groqKey))) {
      if (groqKey) {
        try {
          const res = await callOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            groqKey,
            groqModel,
            prompt,
            count
          );
          generatedResult = {
            ...res,
            providerUsed: `Groq (${groqModel})`,
          };
        } catch (err: any) {
          console.warn('Groq call failed:', err?.message);
          if (provider === 'groq') throw err;
        }
      }
    }

    // Provider: OpenAI
    if (!generatedResult && (provider === 'openai' || (provider === 'auto' && openaiKey))) {
      if (openaiKey) {
        const endpoint = customBaseUrl ? `${customBaseUrl.replace(/\/+$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
        try {
          const res = await callOpenAICompatible(
            endpoint,
            openaiKey,
            openaiModel,
            prompt,
            count
          );
          generatedResult = {
            ...res,
            providerUsed: `OpenAI (${openaiModel})`,
          };
        } catch (err: any) {
          console.warn('OpenAI call failed:', err?.message);
          if (provider === 'openai') throw err;
        }
      }
    }

    // Provider: Custom OpenAI-compatible endpoint (Ollama, OpenRouter, Local, etc.)
    if (!generatedResult && (provider === 'custom' || customBaseUrl)) {
      const endpoint = customBaseUrl ? `${customBaseUrl.replace(/\/+$/, '')}/chat/completions` : 'http://localhost:11434/v1/chat/completions';
      const key = generalKey || 'dummy';
      try {
        const res = await callOpenAICompatible(
          endpoint,
          key,
          customModelName,
          prompt,
          count
        );
        generatedResult = {
          ...res,
          providerUsed: `Custom (${customModelName})`,
        };
      } catch (err: any) {
        console.warn('Custom endpoint call failed:', err?.message);
        if (provider === 'custom') throw err;
      }
    }

    // Built-in intelligent algorithmic generator
    if (!generatedResult) {
      const candidates = generateAlgorithmicFrames(prompt, count);
      generatedResult = {
        message: `I've synthesized ${candidates.length} photobooth frame designs matching "${prompt}". Click any card below to apply it to your canvas!`,
        candidates,
        providerUsed: 'Smart Frame Engine',
      };
    }

    // 3. Increment daily usage for non-admin users
    let newUsage = currentUsage;
    if (!isAdmin) {
      newUsage = await incrementUserUsageToday(authUser.uid, authUser.email || '', prompt, currentUsage);
    }

    const remainingToday = isAdmin ? null : Math.max(0, DAILY_LIMIT - newUsage);

    return NextResponse.json({
      ...generatedResult,
      usage: {
        isAdmin,
        usedToday: newUsage,
        maxDaily: isAdmin ? null : DAILY_LIMIT,
        remainingToday,
      },
    });
  } catch (error: any) {
    console.error('Frame generation agent error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate frame designs' },
      { status: 500 }
    );
  }
}
