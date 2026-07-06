export type BgType = 'original' | 'green' | 'gradient' | 'folder' | 'upload';

export interface BackgroundOption {
  type: BgType;
  id: string;
  name: string;
  src?: string;
  ownerUid?: string;
  ownerName?: string | null;
}

export interface ImageAdjustments {
  brightness: number;   // 0-200, default 100
  contrast: number;     // 0-200, default 100
  saturation: number;   // 0-200, default 100
  hue: number;          // 0-360, default 0
  blur: number;         // 0-10, default 0
  sepia: number;        // 0-100, default 0
  grayscale: number;    // 0-100, default 0
  invert: number;       // 0-100, default 0
  temperature: number;  // -100 to 100, default 0 (warm/cool)
  vignette: number;     // 0-100, default 0
}

export interface FilterPreset {
  id: string;
  name: string;
  emoji: string;
  adjustments: ImageAdjustments;
  css?: string; // used by FinalStrip.tsx to apply simple CSS filters
}

export interface EditSlider {
  key: keyof ImageAdjustments;
  label: string;
  min: number;
  max: number;
  default: number;
  enabled?: boolean;
}

export interface EditConfig {
  id: string;
  name: string;
  presets: FilterPreset[];
  backgrounds: BackgroundOption[];
  sliders: EditSlider[];
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
  temperature: 0,
  vignette: 0,
};

export const DEFAULT_EDIT_CONFIG: EditConfig = {
  id: 'default',
  name: 'Default Edit Suite',
  presets: [
    { id: 'none', name: 'None', emoji: '📷', adjustments: { ...DEFAULT_ADJUSTMENTS }, css: 'none' },
    { id: 'vintage', name: 'Vintage', emoji: '🎞', adjustments: { ...DEFAULT_ADJUSTMENTS, sepia: 40, contrast: 110, saturation: 80, brightness: 95 }, css: 'sepia(40%) contrast(110%) saturate(80%) brightness(95%)' },
    { id: 'noir', name: 'Noir', emoji: '🖤', adjustments: { ...DEFAULT_ADJUSTMENTS, grayscale: 100, contrast: 130, brightness: 95 }, css: 'grayscale(100%) contrast(130%) brightness(95%)' },
    { id: 'warm', name: 'Warm', emoji: '☀️', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: 40, saturation: 115, brightness: 105 }, css: 'saturate(115%) brightness(105%)' },
    { id: 'cool', name: 'Cool', emoji: '❄️', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: -40, saturation: 90, brightness: 100 }, css: 'saturate(90%)' },
    { id: 'vivid', name: 'Vivid', emoji: '🌈', adjustments: { ...DEFAULT_ADJUSTMENTS, saturation: 150, contrast: 115, brightness: 105 }, css: 'saturate(150%) contrast(115%) brightness(105%)' },
    { id: 'fade', name: 'Fade', emoji: '🌫', adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 80, saturation: 70, brightness: 110 }, css: 'contrast(80%) saturate(70%) brightness(110%)' },
    { id: 'dramatic', name: 'Dramatic', emoji: '🎭', adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 140, saturation: 110, brightness: 90 }, css: 'contrast(140%) saturate(110%) brightness(90%)' },
    { id: 'golden', name: 'Golden', emoji: '✨', adjustments: { ...DEFAULT_ADJUSTMENTS, sepia: 25, temperature: 30, contrast: 105, saturation: 110 }, css: 'sepia(25%) contrast(105%) saturate(110%)' },
    { id: 'moonlight', name: 'Moonlight', emoji: '🌙', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: -20, brightness: 110, contrast: 90, saturation: 60 }, css: 'brightness(110%) contrast(90%) saturate(60%)' },
  ],
  backgrounds: [
    { type: 'gradient', id: 'grad1', name: 'Sunset', src: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
    { type: 'gradient', id: 'grad2', name: 'Ocean', src: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)' },
    { type: 'gradient', id: 'grad3', name: 'Holo', src: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
    { type: 'gradient', id: 'grad4', name: 'Midnight', src: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
    { type: 'folder', id: 'bg1', name: 'Abstract', src: '/backgrounds/bg1.jpg' },
    { type: 'folder', id: 'bg2', name: 'Neon', src: '/backgrounds/bg2.jpg' },
    { type: 'folder', id: 'bg3', name: 'Nature', src: '/backgrounds/bg3.jpg' },
  ],
  sliders: [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, default: 100, enabled: true },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, default: 100, enabled: true },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100, enabled: true },
    { key: 'temperature', label: 'Temperature', min: -100, max: 100, default: 0, enabled: true },
    { key: 'hue', label: 'Hue', min: 0, max: 360, default: 0, enabled: true },
    { key: 'sepia', label: 'Sepia', min: 0, max: 100, default: 0, enabled: true },
    { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, default: 0, enabled: true },
    { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0, enabled: true },
    { key: 'blur', label: 'Blur', min: 0, max: 10, default: 0, enabled: true },
  ]
};

export function buildCssFilter(adj: ImageAdjustments, scale: number = 1): string {
  const parts: string[] = [];
  if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness}%)`);
  if (adj.contrast !== 100) parts.push(`contrast(${adj.contrast}%)`);
  if (adj.saturation !== 100) parts.push(`saturate(${adj.saturation}%)`);
  if (adj.hue !== 0) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.blur > 0) parts.push(`blur(${adj.blur * scale}px)`);
  if (adj.sepia > 0) parts.push(`sepia(${adj.sepia}%)`);
  if (adj.grayscale > 0) parts.push(`grayscale(${adj.grayscale}%)`);
  if (adj.invert > 0) parts.push(`invert(${adj.invert}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}
