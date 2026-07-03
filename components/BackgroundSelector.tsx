'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { removeBg } from '@/lib/remove-bg';
import { Frame } from '@/lib/frames';

export interface EditorSyncData {
  activeTab: Tab;
  adjustments: ImageAdjustments;
  selectedPreset: string;
  selectedBg: BackgroundOption;
  isRemovingBg?: boolean;
}

interface Props {
  photos: string[];
  frame: Frame;
  onComplete: (compositedPhotos: string[]) => void;
  syncData?: EditorSyncData;
  onSync?: (data: EditorSyncData) => void;
}

export type BgType = 'original' | 'green' | 'gradient' | 'folder' | 'upload';
export type Tab = 'presets' | 'adjustments' | 'background';

export interface BackgroundOption {
  type: BgType;
  id: string;
  name: string;
  src?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  emoji: string;
  adjustments: ImageAdjustments;
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

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
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

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', name: 'None', emoji: '📷', adjustments: { ...DEFAULT_ADJUSTMENTS } },
  { id: 'vintage', name: 'Vintage', emoji: '🎞', adjustments: { ...DEFAULT_ADJUSTMENTS, sepia: 40, contrast: 110, saturation: 80, brightness: 95 } },
  { id: 'noir', name: 'Noir', emoji: '🖤', adjustments: { ...DEFAULT_ADJUSTMENTS, grayscale: 100, contrast: 130, brightness: 95 } },
  { id: 'warm', name: 'Warm', emoji: '☀️', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: 40, saturation: 115, brightness: 105 } },
  { id: 'cool', name: 'Cool', emoji: '❄️', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: -40, saturation: 90, brightness: 100 } },
  { id: 'vivid', name: 'Vivid', emoji: '🌈', adjustments: { ...DEFAULT_ADJUSTMENTS, saturation: 150, contrast: 115, brightness: 105 } },
  { id: 'fade', name: 'Fade', emoji: '🌫', adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 80, saturation: 70, brightness: 110 } },
  { id: 'dramatic', name: 'Dramatic', emoji: '🎭', adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 140, saturation: 110, brightness: 90 } },
  { id: 'golden', name: 'Golden', emoji: '✨', adjustments: { ...DEFAULT_ADJUSTMENTS, sepia: 25, temperature: 30, contrast: 105, saturation: 110 } },
  { id: 'moonlight', name: 'Moonlight', emoji: '🌙', adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: -20, brightness: 110, contrast: 90, saturation: 60 } },
];

const GRADIENT_BGS: BackgroundOption[] = [
  { type: 'gradient', id: 'grad1', name: 'Sunset', src: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
  { type: 'gradient', id: 'grad2', name: 'Ocean', src: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)' },
  { type: 'gradient', id: 'grad3', name: 'Holo', src: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
  { type: 'gradient', id: 'grad4', name: 'Midnight', src: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
];

const FOLDER_BGS: BackgroundOption[] = [
  { type: 'folder', id: 'bg1', name: 'Abstract', src: '/backgrounds/bg1.jpg' },
  { type: 'folder', id: 'bg2', name: 'Neon', src: '/backgrounds/bg2.jpg' },
  { type: 'folder', id: 'bg3', name: 'Nature', src: '/backgrounds/bg3.jpg' },
];

function buildCssFilter(adj: ImageAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness}%)`);
  if (adj.contrast !== 100) parts.push(`contrast(${adj.contrast}%)`);
  if (adj.saturation !== 100) parts.push(`saturate(${adj.saturation}%)`);
  if (adj.hue !== 0) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.blur > 0) parts.push(`blur(${adj.blur}px)`);
  if (adj.sepia > 0) parts.push(`sepia(${adj.sepia}%)`);
  if (adj.grayscale > 0) parts.push(`grayscale(${adj.grayscale}%)`);
  if (adj.invert > 0) parts.push(`invert(${adj.invert}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export default function BackgroundSelector({ photos, frame, syncData, onSync, onComplete }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Background state
  const [transparentPhotos, setTransparentPhotos] = useState<string[]>(photos);
  const [backgroundsRemoved, setBackgroundsRemoved] = useState(false);
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>({ type: 'original', id: 'orig', name: 'Original' });
  const [uploadedBg, setUploadedBg] = useState<BackgroundOption | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [selectedPreset, setSelectedPreset] = useState<string>('none');

  const isApplyingSync = useRef(false);

  useEffect(() => {
    if (!syncData) return;
    isApplyingSync.current = true;

    if (syncData.activeTab) setActiveTab(syncData.activeTab);
    if (syncData.selectedPreset) setSelectedPreset(syncData.selectedPreset);
    if (syncData.selectedBg) setSelectedBg(syncData.selectedBg);
    if (syncData.adjustments) setAdjustments(syncData.adjustments);
    
    // We only trigger remove backgrounds if we aren't already removing/removed.
    if (syncData.isRemovingBg && !backgroundsRemoved && !isRemovingBg) {
      handleRemoveBackgrounds();
    }

    // Short timeout to let react state settle before we enable broadcasting again
    const t = setTimeout(() => { isApplyingSync.current = false; }, 50);
    return () => clearTimeout(t);
  }, [syncData, backgroundsRemoved, isRemovingBg]);

  useEffect(() => {
    if (isApplyingSync.current || !onSync) return;
    onSync({
      activeTab,
      selectedPreset,
      selectedBg,
      adjustments,
      isRemovingBg
    });
  }, [activeTab, selectedPreset, selectedBg, adjustments, isRemovingBg]);

  const handleRemoveBackgrounds = async () => {
    if (backgroundsRemoved) return;
    setIsRemovingBg(true);
    setProcessing(true);
    try {
      setProgress(5);
      const results: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        try {
          setProgress(5 + Math.round((i / photos.length) * 90));
          const result = await removeBg(photos[i]);
          results.push(result);
        } catch (err: unknown) {
          console.error(`Error removing bg from photo ${i}:`, err);
          results.push(photos[i]);
        }
      }
      setProgress(100);
      setTransparentPhotos(results);
      setBackgroundsRemoved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove backgrounds');
      console.error('Background removal error:', err);
    } finally {
      setIsRemovingBg(false);
      setProcessing(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newBg: BackgroundOption = { type: 'upload', id: `upload-${Date.now()}`, name: 'Custom', src: url };
    setUploadedBg(newBg);
    setSelectedBg(newBg);
  };

  const handlePresetSelect = (preset: FilterPreset) => {
    setSelectedPreset(preset.id);
    setAdjustments({ ...preset.adjustments });
  };

  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
    setSelectedPreset('custom');
  };

  const handleResetFilters = () => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setSelectedPreset('none');
  };

  // Apply filters to an image using canvas
  const applyFiltersToImage = useCallback(async (src: string): Promise<string> => {
    const cssFilter = buildCssFilter(adjustments);
    const hasTemperature = adjustments.temperature !== 0;
    const hasVignette = adjustments.vignette > 0;
    const hasFilter = cssFilter !== 'none' || hasTemperature || hasVignette;

    if (!hasFilter) return src;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supportsFilter = 'filter' in (ctx as any);

        if (supportsFilter && cssFilter !== 'none') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).filter = cssFilter;
        }
        ctx.drawImage(img, 0, 0);
        if (supportsFilter) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).filter = 'none';
        }

        if (!supportsFilter && cssFilter !== 'none') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const brightness = adjustments.brightness / 100;
          const contrast = adjustments.contrast / 100;
          const saturation = adjustments.saturation / 100;
          const sepia = adjustments.sepia / 100;
          const grayscale = adjustments.grayscale / 100;

          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            r *= brightness;
            g *= brightness;
            b *= brightness;

            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

            if (grayscale > 0) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = r * (1 - grayscale) + gray * grayscale;
              g = g * (1 - grayscale) + gray * grayscale;
              b = b * (1 - grayscale) + gray * grayscale;
            }

            if (saturation !== 1) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = gray + (r - gray) * saturation;
              g = gray + (g - gray) * saturation;
              b = gray + (b - gray) * saturation;
            }

            if (sepia > 0) {
              const sr = r * 0.393 + g * 0.769 + b * 0.189;
              const sg = r * 0.349 + g * 0.686 + b * 0.168;
              const sb = r * 0.272 + g * 0.534 + b * 0.131;
              r = r * (1 - sepia) + sr * sepia;
              g = g * (1 - sepia) + sg * sepia;
              b = b * (1 - sepia) + sb * sepia;
            }

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
          }
          ctx.putImageData(imageData, 0, 0);
        }

        if (hasTemperature) {
          ctx.globalCompositeOperation = 'overlay';
          ctx.globalAlpha = Math.abs(adjustments.temperature) / 300;
          if (adjustments.temperature > 0) {
            ctx.fillStyle = '#ff8c00';
          } else {
            ctx.fillStyle = '#0066ff';
          }
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }

        if (hasVignette) {
          const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.7
          );
          gradient.addColorStop(0, 'rgba(0,0,0,0)');
          gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 100})`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => {
        resolve(src);
      };
      img.src = src;
    });
  }, [adjustments]);

  const compositeImage = async (fgSrc: string, originalSrc: string): Promise<string> => {
    if (selectedBg.type === 'original') return originalSrc;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));

      const fgImg = new Image();
      fgImg.crossOrigin = 'anonymous';
      fgImg.onload = () => {
        canvas.width = fgImg.width;
        canvas.height = fgImg.height;

        if (selectedBg.type === 'green') {
          ctx.fillStyle = '#00FF00';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(fgImg, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } else if (selectedBg.type === 'gradient' && selectedBg.src) {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          const matches = Array.from(selectedBg.src.matchAll(/(#[A-Fa-f0-9]+)\s+(\d+)%/g));
          if (matches.length > 0) {
            for (const match of matches) {
              grad.addColorStop(parseInt(match[2], 10) / 100, match[1]);
            }
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = '#FFFFFF';
          }
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(fgImg, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } else if (selectedBg.src) {
          const bgImg = new Image();
          bgImg.crossOrigin = 'anonymous';
          bgImg.onload = () => {
            const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
            const w = bgImg.width * scale;
            const h = bgImg.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(bgImg, x, y, w, h);
            ctx.drawImage(fgImg, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          bgImg.onerror = reject;
          bgImg.src = selectedBg.src;
        } else {
          resolve(originalSrc);
        }
      };
      fgImg.onerror = reject;
      fgImg.src = fgSrc;
    });
  };

  const handleApply = async () => {
    setProcessing(true);
    try {
      const composited = await Promise.all(
        transparentPhotos.map((fg, i) => compositeImage(fg, photos[i]))
      );
      const filtered = await Promise.all(
        composited.map(src => applyFiltersToImage(src))
      );
      onComplete(filtered);
    } catch (err) {
      console.error('Error processing images:', err);
      setError('Failed to apply edits');
      setProcessing(false);
    }
  };

  const previewFilter = buildCssFilter(adjustments);
  const previewTemperatureOverlay = adjustments.temperature !== 0;
  const previewVignette = adjustments.vignette > 0;

  if (error) {
    return (
      <div className="w-full text-center py-20 animate-fadeIn">
        <div className="p-8 rounded-xl border-2 border-dashed mx-auto max-w-md" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          <p className="font-display text-lg mb-3">⚠️ Error Processing</p>
          <p className="text-sm opacity-70 mb-4">{error}</p>
          <button onClick={() => onComplete(photos)} className="px-6 py-2 rounded-lg text-sm transition-opacity hover:opacity-80" style={{ background: 'var(--accent)', color: 'white' }}>
            Skip & Use Originals
          </button>
        </div>
      </div>
    );
  }

  const renderPreview = (fgSrc: string, origSrc: string, i: number, isHero: boolean) => {
    let currentAspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
    if (frame.config?.elements) {
      const p = frame.config.elements.filter(el => el.type === 'photo');
      const targetPhoto = p[i] || p[0];
      if (targetPhoto && targetPhoto.width && targetPhoto.height) {
        currentAspectRatio = targetPhoto.width / targetPhoto.height;
      }
    }

    let bgStyle: React.CSSProperties = {};
    let imgSrc = origSrc;

    if (selectedBg.type !== 'original' && backgroundsRemoved) {
      imgSrc = fgSrc;
      if (selectedBg.type === 'green') {
        bgStyle = { backgroundColor: '#00FF00' };
      } else if (selectedBg.type === 'gradient' && selectedBg.src) {
        bgStyle = { background: selectedBg.src };
      } else if (selectedBg.src) {
        bgStyle = { backgroundImage: `url(${selectedBg.src})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      }
    }

    return (
      <div
        key={i}
        className={`relative overflow-hidden shadow-md ${isHero ? 'rounded-xl' : 'w-full h-full'}`}
        style={isHero ? { aspectRatio: String(currentAspectRatio), maxHeight: '100%', maxWidth: '100%', margin: '0 auto' } : {}}
      >
        <div className="w-full h-full bg-surface-0/50" style={bgStyle}>
          <img
            src={imgSrc}
            alt={`Preview ${i}`}
            className="w-full h-full object-cover"
            style={{ filter: previewFilter !== 'none' ? previewFilter : undefined }}
          />
          {previewTemperatureOverlay && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: adjustments.temperature > 0 ? '#ff8c00' : '#0066ff',
              opacity: Math.abs(adjustments.temperature) / 300,
              mixBlendMode: 'overlay',
            }} />
          )}
          {previewVignette && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${adjustments.vignette / 100}) 100%)`,
            }} />
          )}
        </div>
      </div>
    );
  };

  const bgOptions: BackgroundOption[] = [
    { type: 'original', id: 'orig', name: 'Original' },
    { type: 'green', id: 'green', name: 'Green Screen', src: '#00FF00' },
    ...GRADIENT_BGS,
    ...FOLDER_BGS,
  ];
  if (uploadedBg) bgOptions.push(uploadedBg);

  const sliders: { key: keyof ImageAdjustments; label: string; min: number; max: number; default: number }[] = [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, default: 100 },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, default: 100 },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100 },
    { key: 'temperature', label: 'Temperature', min: -100, max: 100, default: 0 },
    { key: 'hue', label: 'Hue', min: 0, max: 360, default: 0 },
    { key: 'sepia', label: 'Sepia', min: 0, max: 100, default: 0 },
    { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, default: 0 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0 },
    { key: 'blur', label: 'Blur', min: 0, max: 10, default: 0 },
  ];

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-6">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Step 03</p>
        <h2 className="font-display text-4xl font-bold">Edit & Enhance</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 max-w-6xl mx-auto md:h-[75vh] md:min-h-[500px]">
        {/* Left Column: Hero Viewer & Carousel */}
        <div className="flex-1 flex flex-col gap-3 sm:gap-4 bg-[var(--surface-2)] rounded-2xl border border-border p-3 sm:p-4 shadow-sm overflow-hidden relative h-[55vh] min-h-[320px] md:h-auto">

          {/* Removing overlay */}
          {isRemovingBg && (
            <div className="absolute inset-0 z-10 bg-surface-2/80 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-16 h-16 border-4 border-t-transparent rounded-full mx-auto mb-6 animate-spin"
                style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
              <h3 className="font-display text-2xl font-bold mb-2">Extracting Magic...</h3>
              <p className="opacity-60 text-sm mb-4">Removing backgrounds ({progress}%)</p>
              <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: `${frame.borderColor}20` }}>
                <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: frame.accentColor }} />
              </div>
            </div>
          )}

          {/* Hero Viewer */}
          <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden bg-black/5 rounded-xl">
            {renderPreview(transparentPhotos[selectedPhotoIdx], photos[selectedPhotoIdx], selectedPhotoIdx, true)}
          </div>

          {/* Thumbnail Carousel */}
          <div className="flex gap-3 overflow-x-auto pb-2 justify-center shrink-0">
            {photos.map((_, i) => {
              let thumbAspect = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
              if (frame.config?.elements) {
                const p = frame.config.elements.filter(el => el.type === 'photo');
                const targetPhoto = p[i] || p[0];
                if (targetPhoto && targetPhoto.width && targetPhoto.height) {
                  thumbAspect = targetPhoto.width / targetPhoto.height;
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => setSelectedPhotoIdx(i)}
                  className={`relative rounded-lg overflow-hidden transition-all shrink-0 bg-surface-0 h-12 sm:h-16 ${i === selectedPhotoIdx ? 'shadow-md' : 'opacity-50 hover:opacity-100 ring-1 ring-border/50'}`}
                  style={{ aspectRatio: String(thumbAspect), boxShadow: i === selectedPhotoIdx ? `0 0 0 2px ${frame.borderColor}` : undefined }}
                >
                  {renderPreview(transparentPhotos[i], photos[i], i, false)}
                  <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1.5 py-[1px] rounded-full">
                    {i + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="w-full md:w-[400px] flex flex-col bg-[var(--surface-2)] rounded-2xl border border-border shadow-sm overflow-hidden max-h-[65vh] md:max-h-none md:h-full">

          {/* Tabs */}
          <div className="flex border-b border-border bg-surface-0/50">
            {(['presets', 'adjustments', 'background'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 px-2 text-xs font-semibold tracking-wide uppercase transition-colors ${activeTab === tab ? 'text-foreground border-b-2' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ borderBottomColor: activeTab === tab ? frame.borderColor : 'transparent' }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 relative">
            {activeTab === 'presets' && (
              <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                {FILTER_PRESETS.map(preset => {
                  const isActive = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`relative p-3 rounded-xl border text-left min-h-[56px] transition-all hover:scale-[1.02] active:scale-[0.98] touch-manipulation ${isActive ? 'bg-primary/5 shadow-sm' : 'border-border hover:bg-surface-0'}`}
                      style={{ borderColor: isActive ? frame.borderColor : undefined }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-xl shadow-inner from-gray-100 to-gray-200 border border-black/5">
                          {preset.emoji}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'adjustments' && (
              <div className="space-y-6 animate-fadeIn pb-4">
                <div className="flex justify-end">
                  <button onClick={handleResetFilters} className="text-xs font-medium opacity-60 hover:opacity-100 transition-opacity">
                    Reset All
                  </button>
                </div>
                {sliders.map(slider => (
                  <div key={slider.key}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium tracking-wide uppercase opacity-70">{slider.label}</label>
                      <span className="text-[10px] font-mono opacity-50 w-8 text-right bg-surface-0 px-1 py-0.5 rounded">
                        {adjustments[slider.key]}
                      </span>
                    </div>
                    <div className="py-2 flex items-center min-h-[44px]">
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={adjustments[slider.key]}
                        onChange={e => handleAdjustmentChange(slider.key, Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer touch-none"
                        style={{
                          background: `linear-gradient(to right, ${frame.accentColor} 0%, ${frame.accentColor} ${((adjustments[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, ${frame.borderColor}20 ${((adjustments[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, ${frame.borderColor}20 100%)`,
                          accentColor: frame.borderColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'background' && (
              <div className="space-y-6 animate-fadeIn pb-4">
                {/* Magic Remove Toggle */}
                {!backgroundsRemoved ? (
                  <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <h4 className="font-display font-semibold text-lg mb-2 relative z-10">Magic Extraction</h4>
                    <p className="text-xs opacity-70 mb-5 relative z-10">Automatically remove backgrounds from your photos using AI to apply custom backdrops.</p>
                    <button
                      onClick={handleRemoveBackgrounds}
                      className="relative z-10 w-full py-3 rounded-xl font-medium text-sm transition-transform hover:scale-[1.02] shadow-sm text-primary-foreground"
                      style={{ background: frame.borderColor }}
                    >
                      ✨ Remove Backgrounds
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-center flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Backgrounds successfully extracted</p>
                  </div>
                )}

                {/* Colors & Gradients */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Colors & Gradients</p>
                  <div className="grid grid-cols-3 gap-3">
                    {bgOptions.filter(b => b.type === 'original' || b.type === 'green' || b.type === 'gradient').map(bg => {
                      const isSelected = selectedBg.id === bg.id;
                      return (
                        <button
                          key={bg.id}
                          onClick={() => setSelectedBg(bg)}
                          className={`relative rounded-lg p-1.5 transition-all text-left ${isSelected ? 'bg-surface-0 shadow-sm ring-1 ring-border' : 'hover:bg-surface-0/50'}`}
                        >
                          <div
                            className="w-full aspect-square rounded mb-2 overflow-hidden border border-black/5"
                            style={bg.type === 'green' ? { background: '#00FF00' } : bg.type === 'gradient' ? { background: bg.src } : {}}
                          >
                            {bg.type === 'original' && <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xl opacity-60">📸</div>}
                          </div>
                          <p className="text-[10px] text-center font-medium truncate opacity-80">{bg.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scenes & Upload */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Scenes</p>
                  <div className="grid grid-cols-2 gap-3">
                    {bgOptions.filter(b => b.type === 'folder' || b.type === 'upload').map(bg => {
                      const isSelected = selectedBg.id === bg.id;
                      return (
                        <button
                          key={bg.id}
                          onClick={() => setSelectedBg(bg)}
                          className={`relative rounded-lg p-1.5 transition-all text-left ${isSelected ? 'bg-surface-0 shadow-sm ring-1 ring-border' : 'hover:bg-surface-0/50'}`}
                        >
                          <div className="w-full h-16 rounded mb-2 overflow-hidden border border-black/5 bg-gray-100">
                            {bg.src && <img src={bg.src} className="w-full h-full object-cover" alt={bg.name} />}
                          </div>
                          <p className="text-[10px] text-center font-medium truncate opacity-80">{bg.name}</p>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="relative rounded-lg p-1.5 transition-all text-left hover:bg-surface-0/50"
                    >
                      <div className="w-full h-16 rounded mb-2 flex items-center justify-center border-2 border-dashed border-border text-foreground/40">
                        <span className="text-xl">+</span>
                      </div>
                      <p className="text-[10px] text-center font-medium truncate opacity-80">Upload Custom</p>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-border bg-surface-0/50 backdrop-blur-md">
            <button
              onClick={handleApply}
              disabled={processing}
              className="w-full py-3.5 rounded-xl font-semibold tracking-wide transition-all text-sm hover:opacity-90 bg-primary text-primary-foreground shadow-md flex items-center justify-center gap-2"
              style={{ opacity: processing ? 0.7 : 1, background: frame.borderColor }}
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Applying Magic...
                </>
              ) : 'Apply & Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
