'use client';
import { useState, useRef, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Frame } from '@/lib/frames';

interface Props {
  photos: string[];
  frame: Frame;
  onComplete: (compositedPhotos: string[]) => void;
}

type BgType = 'original' | 'green' | 'folder' | 'upload';
type Tab = 'background' | 'filters';

interface BackgroundOption {
  type: BgType;
  id: string;
  name: string;
  src?: string;
}

interface FilterPreset {
  id: string;
  name: string;
  emoji: string;
  adjustments: ImageAdjustments;
}

interface ImageAdjustments {
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

export default function BackgroundSelector({ photos, frame, onComplete }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('filters');
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

  const handleRemoveBackgrounds = async () => {
    if (backgroundsRemoved) return;
    setIsRemovingBg(true);
    setProcessing(true);
    try {
      const results: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(Math.round((i / photos.length) * 100));
        try {
          const blob = await removeBackground(photos[i], {
            publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
            device: 'cpu',
            model: 'isnet_fp16',
            proxyToWorker: false,
            fetchArgs: {
              mode: 'cors',
              credentials: 'omit',
            },
          });
          results.push(URL.createObjectURL(blob));
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
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        // Check if ctx.filter is supported (Safari/WKWebView may not support it)
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

        // If ctx.filter is NOT supported, apply adjustments manually via pixel manipulation
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

            // Brightness
            r *= brightness;
            g *= brightness;
            b *= brightness;

            // Contrast
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

            // Grayscale
            if (grayscale > 0) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = r * (1 - grayscale) + gray * grayscale;
              g = g * (1 - grayscale) + gray * grayscale;
              b = b * (1 - grayscale) + gray * grayscale;
            }

            // Saturation
            if (saturation !== 1) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = gray + (r - gray) * saturation;
              g = gray + (g - gray) * saturation;
              b = gray + (b - gray) * saturation;
            }

            // Sepia
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

        // Apply temperature (warm = orange overlay, cool = blue overlay)
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

        // Apply vignette
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
        // If image fails to load, return original
        console.error('Filter: failed to load image, returning original');
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
      fgImg.onload = () => {
        canvas.width = fgImg.width;
        canvas.height = fgImg.height;

        if (selectedBg.type === 'green') {
          ctx.fillStyle = '#00FF00';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(fgImg, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } else if (selectedBg.src) {
          const bgImg = new Image();
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
      // First composite backgrounds
      const composited = await Promise.all(
        transparentPhotos.map((fg, i) => compositeImage(fg, photos[i]))
      );
      // Then apply filters
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

  // CSS filter string for live preview
  const previewFilter = buildCssFilter(adjustments);
  const previewTemperatureOverlay = adjustments.temperature !== 0;
  const previewVignette = adjustments.vignette > 0;

  if (isRemovingBg) {
    return (
      <div className="w-full text-center py-20 animate-fadeIn">
        <div className="w-16 h-16 border-4 border-t-transparent rounded-full mx-auto mb-6 animate-spin"
             style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
        <h2 className="font-display text-2xl font-bold mb-2">Extracting Magic...</h2>
        <p className="opacity-60 text-sm mb-4">Removing backgrounds ({progress}%)</p>
        <div className="max-w-xs mx-auto h-2 rounded-full overflow-hidden" style={{ background: `${frame.borderColor}20` }}>
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: frame.accentColor }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center py-20 animate-fadeIn">
        <div className="p-8 rounded-lg border-2 border-dashed mx-auto max-w-md" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          <p className="font-display text-lg mb-3">⚠️ Error Processing Images</p>
          <p className="text-sm opacity-70 mb-4">{error}</p>
          <button onClick={() => onComplete(photos)} className="px-6 py-2 rounded-sm text-sm" style={{ background: 'var(--accent)', color: 'white' }}>
            Skip & Use Originals
          </button>
        </div>
      </div>
    );
  }

  const renderPreview = (fgSrc: string, origSrc: string, i: number) => {
    let bgStyle: React.CSSProperties = {};
    let imgSrc = origSrc;

    if (selectedBg.type !== 'original' && backgroundsRemoved) {
      imgSrc = fgSrc;
      if (selectedBg.type === 'green') {
        bgStyle = { backgroundColor: '#00FF00' };
      } else if (selectedBg.src) {
        bgStyle = { backgroundImage: `url(${selectedBg.src})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      }
    }

    return (
      <div key={i} className="aspect-[4/3] rounded overflow-hidden shadow-sm border border-black/10 relative">
        <div className="w-full h-full" style={bgStyle}>
          <img
            src={imgSrc}
            alt={`Preview ${i}`}
            className="w-full h-full object-cover"
            style={{ filter: previewFilter !== 'none' ? previewFilter : undefined }}
          />
          {/* Temperature overlay */}
          {previewTemperatureOverlay && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: adjustments.temperature > 0 ? '#ff8c00' : '#0066ff',
              opacity: Math.abs(adjustments.temperature) / 300,
              mixBlendMode: 'overlay',
            }} />
          )}
          {/* Vignette overlay */}
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
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Step 03</p>
        <h2 className="font-display text-4xl font-bold">Edit & Enhance</h2>
        <p className="mt-2 opacity-60 text-sm">Filters, adjustments & background</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-1 mb-8 max-w-xs mx-auto p-1 rounded-lg" style={{ background: `${frame.borderColor}10` }}>
        {(['filters', 'background'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all capitalize"
            style={{
              background: activeTab === tab ? frame.borderColor : 'transparent',
              color: activeTab === tab ? frame.color : frame.borderColor,
            }}
          >
            {tab === 'filters' ? '🎨 Filters' : '🖼 Background'}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto">
        {/* Preview Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-sm shadow-md" style={{ border: `1px solid ${frame.borderColor}20` }}>
            {transparentPhotos.map((fg, i) => renderPreview(fg, photos[i], i))}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          {activeTab === 'filters' && (
            <>
              {/* Preset filters */}
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 mb-3">Presets</p>
                <div className="grid grid-cols-5 gap-2">
                  {FILTER_PRESETS.map(preset => {
                    const isActive = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all"
                        style={{
                          background: isActive ? `${frame.borderColor}15` : 'transparent',
                          border: `2px solid ${isActive ? frame.borderColor : `${frame.borderColor}15`}`,
                        }}
                      >
                        <span className="text-lg">{preset.emoji}</span>
                        <span className="text-[9px] font-medium leading-tight text-center">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual adjustments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest opacity-50">Adjustments</p>
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] px-2 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
                    style={{ border: `1px solid ${frame.borderColor}30`, color: frame.borderColor }}
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {sliders.map(slider => (
                    <div key={slider.key}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs opacity-70">{slider.label}</label>
                        <span className="text-[10px] font-mono opacity-50 w-8 text-right">
                          {adjustments[slider.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={adjustments[slider.key]}
                        onChange={e => handleAdjustmentChange(slider.key, Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${frame.accentColor} 0%, ${frame.accentColor} ${((adjustments[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, ${frame.borderColor}20 ${((adjustments[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, ${frame.borderColor}20 100%)`,
                          accentColor: frame.borderColor,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'background' && (
            <>
              {!backgroundsRemoved && (
                <button
                  onClick={handleRemoveBackgrounds}
                  className="w-full py-3 rounded-sm font-medium tracking-wide transition-all text-sm border-2"
                  style={{ borderColor: frame.borderColor, color: frame.borderColor, background: 'transparent' }}
                >
                  ✨ Remove All Backgrounds
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                {bgOptions.map(bg => {
                  const isSelected = selectedBg.id === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBg(bg)}
                      className={`relative p-2 rounded-sm border-2 text-left transition-all ${isSelected ? 'shadow-md' : ''}`}
                      style={{
                        borderColor: isSelected ? frame.borderColor : `${frame.borderColor}20`,
                        background: isSelected ? `${frame.borderColor}05` : 'transparent',
                      }}
                    >
                      <div className="w-full h-16 mb-2 rounded bg-gray-100 overflow-hidden border border-black/10">
                        {bg.type === 'original' && <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-xl">📸</div>}
                        {bg.type === 'green' && <div className="w-full h-full bg-[#00FF00]" />}
                        {(bg.type === 'folder' || bg.type === 'upload') && bg.src && (
                          <img src={bg.src} className="w-full h-full object-cover" alt={bg.name} />
                        )}
                      </div>
                      <p className="text-xs font-medium text-center truncate">{bg.name}</p>
                    </button>
                  );
                })}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative p-2 rounded-sm border-2 border-dashed text-left transition-all hover:bg-black/5"
                  style={{ borderColor: `${frame.borderColor}40` }}
                >
                  <div className="w-full h-16 mb-2 rounded flex flex-col items-center justify-center opacity-60">
                    <span className="text-xl mb-1">↑</span>
                  </div>
                  <p className="text-xs font-medium text-center">Upload</p>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
              </div>
            </>
          )}

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={processing}
            className="w-full py-4 rounded-sm font-medium tracking-wide transition-all text-sm mt-auto"
            style={{
              background: frame.borderColor,
              color: frame.color,
              opacity: processing ? 0.7 : 1,
            }}
          >
            {processing ? 'Applying...' : 'Apply & Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
