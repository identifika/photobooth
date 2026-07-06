'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { removeBg } from '@/lib/remove-bg';
import { Frame } from '@/lib/frames';
import { 
  type BgType, 
  type BackgroundOption, 
  type FilterPreset, 
  type ImageAdjustments, 
  type EditConfig,
  DEFAULT_EDIT_CONFIG,
  DEFAULT_ADJUSTMENTS
} from '@/lib/edit-types';
import { useBackgrounds } from '@/hooks/useBackgrounds';
import { listUserBackgrounds, createUserBackground, deleteUserBackground, type UserBackground } from '@/lib/user-backgrounds';
import { requestBackgroundPublish } from '@/lib/publish-requests';
import { Trash2, Globe, Upload, Loader2 } from 'lucide-react';
import { getClientAuthToken } from '@/lib/auth-client';

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
  config?: EditConfig;
}

export type Tab = 'presets' | 'adjustments' | 'background';








function buildCssFilter(adj: ImageAdjustments, scale: number = 1): string {
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

export default function BackgroundSelector({ photos, frame, syncData, onSync, onComplete, config = DEFAULT_EDIT_CONFIG }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const { backgrounds: dynamicBackgrounds } = useBackgrounds();

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

  // User backgrounds (persisted to Firestore + S3)
  const [userBackgrounds, setUserBackgrounds] = useState<UserBackground[]>([]);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [requestingPublic, setRequestingPublic] = useState<string | null>(null);
  const [requestedBgIds, setRequestedBgIds] = useState<Set<string>>(new Set());

  // Gradient Creator state
  const [creatingGradient, setCreatingGradient] = useState(false);
  const [gradName, setGradName] = useState('My Gradient');
  const [gradColor1, setGradColor1] = useState('#ff7e5f');
  const [gradColor2, setGradColor2] = useState('#feb47b');
  const [gradAngle, setGradAngle] = useState(135);

  // Load user backgrounds from Firestore
  useEffect(() => {
    if (!user) return;
    listUserBackgrounds(user.uid).then(setUserBackgrounds).catch(console.error);
  }, [user?.uid]);

  // Filter state
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [selectedPreset, setSelectedPreset] = useState<string>('none');

  const [builtinPresets, setBuiltinPresets] = useState<FilterPreset[]>(config.presets);
  const [userPresets, setUserPresets] = useState<FilterPreset[]>([]);
  const [communityPresets, setCommunityPresets] = useState<FilterPreset[]>([]);

  // Keep a flat merged list for lookup only (applyFilters etc.)
  const mergedPresets = [...builtinPresets, ...userPresets, ...communityPresets];
  
  useEffect(() => {
    Promise.all([
      import('@/lib/public-filters').then(m => m.listPublicFilters()),
      import('@/lib/user-filters').then(m => user ? m.listUserFilters(user.uid) : Promise.resolve([]))
    ]).then(([publicFilters, userFiltersRaw]) => {
      const activeFilters = publicFilters.filter(f => f.active);
      setBuiltinPresets(config.presets);
      setUserPresets(userFiltersRaw);
      // Community = active public filters that don't belong to the current user
      setCommunityPresets(activeFilters.filter(f => (f as any).ownerUid !== user?.uid));
    }).catch(console.error);
  }, [config.presets, user?.uid]);


  const isApplyingSync = useRef(false);

  const lastSyncData = useRef<EditorSyncData | undefined>(syncData);

  useEffect(() => {
    if (syncData && syncData !== lastSyncData.current) {
      lastSyncData.current = syncData;
      isApplyingSync.current = true;

      if (syncData.activeTab) setActiveTab(syncData.activeTab);
      if (syncData.selectedPreset) setSelectedPreset(syncData.selectedPreset);
      if (syncData.selectedBg) setSelectedBg(syncData.selectedBg);
      if (syncData.adjustments) setAdjustments(syncData.adjustments);
      
      // We only trigger remove backgrounds if we aren't already removing/removed.
      if (syncData.isRemovingBg && !backgroundsRemoved && !isRemovingBg) {
        handleRemoveBackgrounds();
      }
    }
  }, [syncData, backgroundsRemoved, isRemovingBg]);

  useEffect(() => {
    if (isApplyingSync.current) {
      isApplyingSync.current = false;
      return;
    }
    if (!onSync) return;
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

  const handleUploadBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Immediately show a local preview while uploading
    const localUrl = URL.createObjectURL(file);
    const tempId = `temp-${Date.now()}`;
    const tempBg: BackgroundOption = { type: 'upload', id: tempId, name: file.name.replace(/\.[^/.]+$/, ''), src: localUrl };
    setSelectedBg(tempBg);

    if (!user) {
      // Not logged in — just use local blob, no persistence
      setUploadedBg(tempBg);
      return;
    }

    setUploadingBg(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) { setUploadingBg(false); return; }
      try {
        const token = await getClientAuthToken();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ image: dataUrl, prefix: `backgrounds/${user.uid}` }),
        });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json();

        const bgData: Omit<UserBackground, 'id'> = {
          type: 'upload',
          name: file.name.replace(/\.[^/.]+$/, ''),
          src: url,
          ownerUid: user.uid,
          ownerName: user.displayName,
        };
        const newId = await createUserBackground(bgData);
        const savedBg: UserBackground = { id: newId, ...bgData };

        setUserBackgrounds(prev => [savedBg, ...prev]);
        setSelectedBg(savedBg);
        URL.revokeObjectURL(localUrl);
      } catch (err) {
        console.error('Background upload failed:', err);
        // Keep the local blob as fallback
        setUploadedBg(tempBg);
      } finally {
        setUploadingBg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGradient = async () => {
    if (!user) return;
    setUploadingBg(true);
    try {
      const src = `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`;
      const bgData: Omit<UserBackground, 'id'> = {
        type: 'gradient',
        name: gradName || 'Custom Gradient',
        src,
        ownerUid: user.uid,
        ownerName: user.displayName,
      };
      const newId = await createUserBackground(bgData);
      const savedBg: UserBackground = { id: newId, ...bgData };
      setUserBackgrounds(prev => [savedBg, ...prev]);
      setSelectedBg(savedBg);
      setCreatingGradient(false);
    } catch (err) {
      console.error('Failed to save gradient:', err);
    } finally {
      setUploadingBg(false);
    }
  };

  const handleDeleteUserBg = async (bg: UserBackground) => {
    if (!user) return;
    try {
      await deleteUserBackground(user?.uid || '', bg.id);
      setUserBackgrounds(prev => prev.filter(b => b.id !== bg.id));
      if (selectedBg.id === bg.id) {
        setSelectedBg({ type: 'original', id: 'orig', name: 'Original' });
      }
    } catch (err) {
      console.error('Failed to delete background:', err);
    }
  };

  const handleRequestPublicBg = async (bg: UserBackground) => {
    if (!user) return;
    setRequestingPublic(bg.id);
    try {
      await requestBackgroundPublish(bg.id, { uid: user.uid, displayName: user.displayName }, {
        id: bg.id,
        type: bg.type,
        name: bg.name,
        src: bg.src,
      });
      setRequestedBgIds(prev => new Set([...prev, bg.id]));
    } catch (err) {
      console.error('Failed to request publish:', err);
    } finally {
      setRequestingPublic(null);
    }
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
    const cssFilterCheck = buildCssFilter(adjustments);
    const hasTemperature = adjustments.temperature !== 0;
    const hasVignette = adjustments.vignette > 0;
    const hasFilter = cssFilterCheck !== 'none' || hasTemperature || hasVignette;

    if (!hasFilter) return src;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        // Scale the CSS filter based on the image size vs standard preview size (approx 400px wide)
        const blurScale = img.width / 400;
        const cssFilterScaled = buildCssFilter(adjustments, blurScale);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supportsFilter = 'filter' in (ctx as any);

        if (supportsFilter && cssFilterScaled !== 'none') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).filter = cssFilterScaled;
        }
        ctx.drawImage(img, 0, 0);
        if (supportsFilter) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).filter = 'none';
        }

        if (!supportsFilter && cssFilterScaled !== 'none') {
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

  /**
   * Fetch an external URL as a local data URL so canvas can draw it
   * without CORS taint issues. Falls back to the original src on failure.
   */
  const fetchAsDataUrl = async (src: string): Promise<string> => {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src;
    try {
      const res = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: src })
      });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return src; // fall back to original, crossOrigin canvas will attempt anyway
    }
  };

  const compositeImage = async (fgSrc: string, originalSrc: string): Promise<string> => {
    if (selectedBg.type === 'original') return originalSrc;

    // Pre-fetch remote background as data URL to avoid canvas CORS taint
    const bgSrc = selectedBg.src && selectedBg.type !== 'green' && selectedBg.type !== 'gradient'
      ? await fetchAsDataUrl(selectedBg.src)
      : selectedBg.src;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(originalSrc); return; }

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
        } else if (selectedBg.type === 'gradient' && bgSrc) {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          const matches = Array.from(bgSrc.matchAll(/(#[A-Fa-f0-9]+)\s+(\d+)%/g));
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
        } else if (bgSrc) {
          const bgImg = new Image();
          // No crossOrigin needed since we're using data URL
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
          bgImg.onerror = () => {
            // Background failed to load — just composite fg over a white bg
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(fgImg, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
          bgImg.src = bgSrc;
        } else {
          resolve(originalSrc);
        }
      };
      fgImg.onerror = () => resolve(originalSrc);
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
    ...config.backgrounds.filter(b => b.type === 'gradient'), // only keep gradients from defaults
    ...dynamicBackgrounds, // load uploaded custom backgrounds
  ];
  if (uploadedBg) bgOptions.push(uploadedBg);

  const sliders = config.sliders.filter(s => s.enabled !== false);

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
              <div className="space-y-5 animate-fadeIn">

                {/* — Built-in Presets — */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Presets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {builtinPresets.map(preset => {
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
                </div>

                {/* — My Presets — */}
                {userPresets.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>My Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {userPresets.map(preset => {
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
                                {preset.emoji || '✨'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* — Community Presets — */}
                {communityPresets.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Community</p>
                    <div className="grid grid-cols-2 gap-2">
                      {communityPresets.map(preset => {
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
                                {preset.emoji || '🌐'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                                {(preset as any).ownerName && (
                                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>by {(preset as any).ownerName}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Colors & Gradients</p>
                  </div>
                  
                  {creatingGradient ? (
                    <div className="p-4 rounded-xl border border-border bg-surface-1 mb-4 animate-fadeIn">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold uppercase">New Gradient</h4>
                        <button onClick={() => setCreatingGradient(false)} className="text-xs opacity-60 hover:opacity-100">Cancel</button>
                      </div>
                      
                      <div className="w-full h-16 rounded-lg mb-3 shadow-inner" style={{ background: `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)` }} />
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold opacity-70 block mb-1">Name</label>
                          <input type="text" value={gradName} onChange={e => setGradName(e.target.value)} className="w-full text-xs bg-surface-0 border border-border rounded px-2 py-1.5" placeholder="Gradient Name" />
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] font-semibold opacity-70 block mb-1">Color 1</label>
                            <input type="color" value={gradColor1} onChange={e => setGradColor1(e.target.value)} className="w-full h-8 rounded cursor-pointer border border-border bg-surface-0" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-semibold opacity-70 block mb-1">Color 2</label>
                            <input type="color" value={gradColor2} onChange={e => setGradColor2(e.target.value)} className="w-full h-8 rounded cursor-pointer border border-border bg-surface-0" />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-[10px] font-semibold opacity-70 block">Angle</label>
                            <span className="text-[10px] font-mono opacity-50">{gradAngle}°</span>
                          </div>
                          <input type="range" min="0" max="360" value={gradAngle} onChange={e => setGradAngle(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ background: 'var(--border)', accentColor: frame.borderColor }} />
                        </div>
                        
                        <button 
                          onClick={handleSaveGradient}
                          disabled={uploadingBg || !user}
                          className="w-full py-2 bg-primary text-primary-foreground rounded font-medium text-xs mt-2 disabled:opacity-50"
                        >
                          {uploadingBg ? 'Saving...' : user ? 'Save Gradient' : 'Login to Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
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
                      
                      <button
                        onClick={() => setCreatingGradient(true)}
                        className="relative rounded-lg p-1.5 transition-all text-left hover:bg-surface-0/50 flex flex-col items-center justify-center border-2 border-dashed border-border"
                      >
                        <span className="text-lg opacity-40 mb-1">+</span>
                        <p className="text-[10px] text-center font-medium opacity-60">New Gradient</p>
                      </button>
                    </div>
                  )}
                </div>

                {/* Scenes */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Scenes</p>
                  <div className="grid grid-cols-2 gap-3">
                    {bgOptions.filter(b => b.type === 'folder' || b.type === 'upload').map(bg => {
                      // Skip user background if it's already rendered in My Backgrounds to avoid duplicates
                      if (userBackgrounds.find(ub => ub.id === bg.id)) return null;
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
                  </div>
                </div>

                {/* My Backgrounds & Upload */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">My Backgrounds</p>
                  <div className="grid grid-cols-2 gap-3">
                    {userBackgrounds.map(bg => {
                      const isSelected = selectedBg.id === bg.id;
                      const requested = requestedBgIds.has(bg.id);
                      return (
                        <div
                          key={bg.id}
                          className={`relative group rounded-lg p-1.5 transition-all text-left ${isSelected ? 'bg-surface-0 shadow-sm ring-1 ring-border' : 'hover:bg-surface-0/50'}`}
                        >
                          <button onClick={() => setSelectedBg(bg)} className="w-full block">
                            <div 
                              className="w-full h-16 rounded mb-2 overflow-hidden border border-black/5 bg-gray-100"
                              style={bg.type === 'gradient' ? { background: bg.src } : {}}
                            >
                              {bg.src && bg.type !== 'gradient' && <img src={bg.src} className="w-full h-full object-cover" alt={bg.name} />}
                            </div>
                            <p className="text-[10px] text-center font-medium truncate opacity-80">{bg.name}</p>
                          </button>
                          
                          {/* Hover Actions */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!requested && (
                              <button
                                onClick={() => handleRequestPublicBg(bg)}
                                disabled={requestingPublic === bg.id}
                                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded backdrop-blur-md transition-colors"
                                title="Publish to community"
                              >
                                {requestingPublic === bg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUserBg(bg)}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded backdrop-blur-md transition-colors"
                              title="Delete background"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {requested && (
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500/90 text-white text-[8px] font-bold uppercase rounded shadow-sm">
                              Pending Review
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {uploadedBg && !userBackgrounds.find(b => b.id === uploadedBg.id) && (
                      <button
                        onClick={() => setSelectedBg(uploadedBg)}
                        className={`relative rounded-lg p-1.5 transition-all text-left ${selectedBg.id === uploadedBg.id ? 'bg-surface-0 shadow-sm ring-1 ring-border' : 'hover:bg-surface-0/50'}`}
                      >
                        <div 
                          className="w-full h-16 rounded mb-2 overflow-hidden border border-black/5 bg-gray-100"
                          style={uploadedBg.type === 'gradient' ? { background: uploadedBg.src } : {}}
                        >
                          {uploadedBg.src && uploadedBg.type !== 'gradient' && <img src={uploadedBg.src} className="w-full h-full object-cover" alt={uploadedBg.name} />}
                        </div>
                        <p className="text-[10px] text-center font-medium truncate opacity-80">{uploadedBg.name}</p>
                      </button>
                    )}

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingBg}
                      className="relative rounded-lg p-1.5 transition-all text-left hover:bg-surface-0/50 disabled:opacity-50"
                    >
                      <div className="w-full h-16 rounded mb-2 flex items-center justify-center border-2 border-dashed border-border text-foreground/40 bg-surface-0">
                        {uploadingBg ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <p className="text-[10px] text-center font-medium truncate opacity-80">
                        {uploadingBg ? 'Uploading...' : 'Upload Custom'}
                      </p>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUploadBackground} accept="image/*" className="hidden" />
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
