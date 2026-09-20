import type { FrameConfig, FrameElement, FrameTitleElement, FrameDateElement, FrameEmojiElement, FrameStickerElement, FramePhotoElement, FrameImageElement } from './frame-types';
import { formatDate } from './frame-types';

/**
 * Sanitizes and normalizes raw SVG string so that it can be safely and reliably
 * rendered inside <img> tags, canvas contexts, and CSS backgrounds.
 */
export function sanitizeSvg(raw: string): string {
  let svg = raw.trim();

  // If the user pasted markdown code fences (e.g. ```xml or ```svg ... ```), strip them
  svg = svg.replace(/^```(?:xml|svg)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Find opening <svg ...> tag
  const svgOpenMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!svgOpenMatch) {
    throw new Error('Invalid SVG: No <svg> root element found');
  }

  let attributes = svgOpenMatch[1];

  // Ensure xmlns="http://www.w3.org/2000/svg" exists
  if (!/xmlns\s*=\s*["'][^"']+["']/i.test(attributes)) {
    attributes += ' xmlns="http://www.w3.org/2000/svg"';
  }

  // Ensure xmlns:xlink exists if xlink is referenced
  if (/xlink:href/i.test(svg) && !/xmlns:xlink/i.test(attributes)) {
    attributes += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
  }

  // If width or height are missing, extract from viewBox or default to 400x600
  const hasWidth = /\bwidth\s*=\s*["'][^"']+["']/i.test(attributes);
  const hasHeight = /\bheight\s*=\s*["'][^"']+["']/i.test(attributes);
  const viewBoxMatch = attributes.match(/\bviewBox\s*=\s*["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);

  if (!hasWidth || !hasHeight) {
    if (viewBoxMatch) {
      const vbW = Math.round(parseFloat(viewBoxMatch[3]));
      const vbH = Math.round(parseFloat(viewBoxMatch[4]));
      if (!hasWidth && vbW > 0) attributes += ` width="${vbW}"`;
      if (!hasHeight && vbH > 0) attributes += ` height="${vbH}"`;
    } else {
      if (!hasWidth) attributes += ' width="400"';
      if (!hasHeight) attributes += ' height="600"';
      attributes += ' viewBox="0 0 400 600"';
    }
  }

  // Remove any dangerous <script> tags
  svg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Reassemble
  return svg.replace(/<svg\b[^>]*>/i, `<svg ${attributes.trim()}>`);
}

/**
 * Converts a sanitized SVG string into a valid Data URL.
 */
export function svgToDataUrl(svgString: string): string {
  const sanitized = sanitizeSvg(svgString);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
}

/**
 * Reads any File (SVG, PNG, JPG, WebP) into a Data URL with SVG auto-sanitization.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

  if (isSvg) {
    const text = await file.text();
    return svgToDataUrl(text);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Preset built-in SVG frame backgrounds for quick selection in the Frame Editor.
 */
export interface SvgPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  category: 'aesthetic' | 'minimal' | 'vintage' | 'playful';
}

export const SVG_PRESETS: SvgPreset[] = [
  {
    id: 'studio-cream',
    name: 'Studio Cream',
    description: 'Warm cream vintage paper card with gold accents',
    url: '/frames/studio-cream.svg',
    category: 'aesthetic',
  },
  {
    id: 'studio-noir',
    name: 'Studio Noir',
    description: 'Sleek dark minimalist film card with silver accents',
    url: '/frames/studio-noir.svg',
    category: 'minimal',
  },
  {
    id: 'retro-film',
    name: 'Retro Film Strip',
    description: 'Classic analogue photobooth film card with border grain',
    url: '/frames/retro-film.svg',
    category: 'vintage',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    description: 'Soft gradient aesthetic with delicate stars & arches',
    url: '/frames/pastel-dream.svg',
    category: 'playful',
  },
  {
    id: 'w-beku-ocean',
    name: 'Ocean Waves',
    description: 'Deep emerald & ocean waves with polaroid frames',
    url: '/frames/w-beku-frame.svg',
    category: 'aesthetic',
  },
];

/**
 * Generates an editable, standalone SVG file from any FrameConfig.
 */
export function exportFrameConfigToSvg(config: FrameConfig, frameName: string = 'photobooth-frame'): string {
  const w = config.width ?? 400;
  const h = config.height ?? 600;
  const elements = config.elements ?? [];

  let bgMarkup = '';
  if (config.bgType === 'gradient') {
    const from = config.bgGradientFrom ?? '#f5f0e8';
    const to = config.bgGradientTo ?? '#e8dfd0';
    const angle = config.bgGradientAngle ?? 135;
    bgMarkup = `
    <defs>
      <linearGradient id="frameGrad" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${from}" />
        <stop offset="100%" stop-color="${to}" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#frameGrad)" />`;
  } else if (config.bgType === 'image' && config.bgImage) {
    bgMarkup = `<image href="${config.bgImage}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" />`;
  } else {
    bgMarkup = `<rect width="${w}" height="${h}" fill="${config.color ?? '#f5f0e8'}" />`;
  }

  // Border & Accent
  let borderMarkup = '';
  if (config.borderStyle && config.borderStyle !== 'none' && (config.borderWidth ?? 0) > 0) {
    const bw = config.borderWidth ?? 3;
    const strokeDash = config.borderStyle === 'dashed' ? 'stroke-dasharray="15 10"' : config.borderStyle === 'dotted' ? 'stroke-dasharray="4 8"' : '';
    borderMarkup = `<rect x="${bw / 2}" y="${bw / 2}" width="${w - bw}" height="${h - bw}" fill="none" stroke="${config.borderColor ?? '#1a1410'}" stroke-width="${bw}" ${strokeDash} />`;
  }

  let accentMarkup = '';
  const accentSz = config.accentSize ?? 4;
  if (accentSz > 0) {
    accentMarkup = `
    <rect x="0" y="0" width="${w}" height="${accentSz}" fill="${config.accentColor ?? '#c9a84c'}" />
    <rect x="0" y="${h - accentSz}" width="${w}" height="${accentSz}" fill="${config.accentColor ?? '#c9a84c'}" />`;
  }

  // Elements
  const elementsMarkup = elements.map((el) => {
    if (el.type === 'photo') {
      const p = el as FramePhotoElement;
      const r = p.borderRadius ?? 6;
      return `
      <g id="${p.id}">
        <rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${r}" fill="#000000" fill-opacity="0.08" stroke="${p.borderColor || '#000000'}" stroke-width="${p.borderWidth || 0}" />
        <text x="${p.x + p.width / 2}" y="${p.y + p.height / 2 + 5}" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="14" fill="#666666">📷 PHOTO SLOT</text>
      </g>`;
    }
    if (el.type === 'title') {
      const t = el as FrameTitleElement;
      const textAnchor = t.align === 'left' ? 'start' : t.align === 'right' ? 'end' : 'middle';
      const textX = t.align === 'left' ? t.x : t.align === 'right' ? t.x + t.width : t.x + t.width / 2;
      return `
      <text id="${t.id}" x="${textX}" y="${t.y + t.fontSize}" text-anchor="${textAnchor}" font-family="${t.font}, serif" font-size="${t.fontSize}" font-weight="700" fill="${t.color}">${t.text || ''}</text>`;
    }
    if (el.type === 'date') {
      const d = el as FrameDateElement;
      const textAnchor = d.align === 'left' ? 'start' : d.align === 'right' ? 'end' : 'middle';
      const textX = d.align === 'left' ? d.x : d.align === 'right' ? d.x + d.width : d.x + d.width / 2;
      const textStr = formatDate(new Date(), d.format || 'MMM DD, YYYY');
      return `
      <text id="${d.id}" x="${textX}" y="${d.y + d.fontSize}" text-anchor="${textAnchor}" font-family="${d.font}, serif" font-size="${d.fontSize}" font-weight="500" fill="${d.color}">${textStr}</text>`;
    }
    if (el.type === 'image' && el.src) {
      return `
      <image id="${el.id}" href="${el.src}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="${el.objectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" />`;
    }
    if (el.type === 'emoji') {
      const em = el as FrameEmojiElement;
      const count = Math.floor(em.width / Math.max(1, em.spacing));
      const emojis = Array.from({ length: count }, () => em.emoji).join(' ');
      return `
      <text id="${em.id}" x="${em.x + em.width / 2}" y="${em.y + em.height * 0.8}" text-anchor="middle" font-size="18">${emojis}</text>`;
    }
    if (el.type === 'sticker') {
      const st = el as FrameStickerElement;
      const size = Math.min(st.width, st.height) * 0.8;
      return `
      <text id="${st.id}" x="${st.x + st.width / 2}" y="${st.y + st.height / 2 + size * 0.35}" text-anchor="middle" font-size="${size}">${st.emoji}</text>`;
    }
    return '';
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <!-- Frame Background -->
  ${bgMarkup}

  <!-- Accent Lines -->
  ${accentMarkup}

  <!-- Elements -->
  ${elementsMarkup}

  <!-- Border -->
  ${borderMarkup}
</svg>`;
}
