'use client';
import { useState, useRef } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Frame } from '@/lib/frames';

interface Props {
  photos: string[]; // Original base64 photos
  frame: Frame;
  onComplete: (compositedPhotos: string[]) => void;
}

type BgType = 'original' | 'green' | 'folder' | 'upload';

interface BackgroundOption {
  type: BgType;
  id: string;
  name: string;
  src?: string; // Image src or color code
}

const FOLDER_BGS: BackgroundOption[] = [
  { type: 'folder', id: 'bg1', name: 'Abstract', src: '/backgrounds/bg1.jpg' },
  { type: 'folder', id: 'bg2', name: 'Neon', src: '/backgrounds/bg2.jpg' },
  { type: 'folder', id: 'bg3', name: 'Nature', src: '/backgrounds/bg3.jpg' },
];

export default function BackgroundSelector({ photos, frame, onComplete }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Array of object URLs for the transparent foregrounds. Initially just the photos
  const [transparentPhotos, setTransparentPhotos] = useState<string[]>(photos);
  const [backgroundsRemoved, setBackgroundsRemoved] = useState(false);

  // The currently selected background
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>({ type: 'original', id: 'orig', name: 'Original' });
  const [uploadedBg, setUploadedBg] = useState<BackgroundOption | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveBackgrounds = async () => {
    if (backgroundsRemoved) return;
    setIsRemovingBg(true);
    setProcessing(true);
    try {
      const results: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        // Progress represents the number of processed photos
        setProgress(Math.round((i / photos.length) * 100));

        try {
          const blob = await removeBackground(photos[i]);
          results.push(URL.createObjectURL(blob));
        } catch (err: unknown) {
            console.error(`Error removing bg from photo ${i}:`, err);
            // Fallback to original if background removal fails for a specific image
            results.push(photos[i]);
        }
      }

      setProgress(100);
      setTransparentPhotos(results);
      setBackgroundsRemoved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove backgrounds');
    } finally {
      setIsRemovingBg(false);
      setProcessing(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newBg: BackgroundOption = {
      type: 'upload',
      id: `upload-${Date.now()}`,
      name: 'Custom',
      src: url
    };

    setUploadedBg(newBg);
    setSelectedBg(newBg);
  };

  const compositeImage = async (fgSrc: string, originalSrc: string): Promise<string> => {
    if (selectedBg.type === 'original') {
      return originalSrc;
    }

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
            // Draw background image scaled to cover the canvas
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
    setProcessing(true); // Re-use processing state for combining
    try {
      const composited = await Promise.all(
        transparentPhotos.map((fg, i) => compositeImage(fg, photos[i]))
      );
      onComplete(composited);
    } catch (err) {
      console.error('Error compositing images:', err);
      setError('Failed to apply background');
      setProcessing(false);
    }
  };

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
            <button
              onClick={() => onComplete(photos)}
              className="px-6 py-2 rounded-sm text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Skip & Use Originals
            </button>
         </div>
      </div>
    );
  }

  // Generate previews using a simple CSS approach since actual compositing is slow
  const renderPreview = (fgSrc: string, origSrc: string, i: number) => {
    let bgStyle: React.CSSProperties = {};
    let content = null;

    if (selectedBg.type === 'original') {
      content = <img src={origSrc} alt={`Preview ${i}`} className="w-full h-full object-cover" />;
    } else {
      if (selectedBg.type === 'green') {
        bgStyle = { backgroundColor: '#00FF00' };
      } else if (selectedBg.src) {
        bgStyle = { backgroundImage: `url(${selectedBg.src})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      }

      content = (
        <div className="w-full h-full" style={bgStyle}>
          <img src={fgSrc} alt={`Preview ${i}`} className="w-full h-full object-cover" />
        </div>
      );
    }

    return (
      <div key={i} className="aspect-[4/3] rounded overflow-hidden shadow-sm border border-black/10">
        {content}
      </div>
    );
  };

  const bgOptions: BackgroundOption[] = [
    { type: 'original', id: 'orig', name: 'Original' },
    { type: 'green', id: 'green', name: 'Green Screen', src: '#00FF00' },
    ...FOLDER_BGS
  ];

  if (uploadedBg) {
    bgOptions.push(uploadedBg);
  }

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Step 03</p>
        <h2 className="font-display text-4xl font-bold">Choose Background</h2>
        <p className="mt-2 opacity-60 text-sm">Pick a vibe for your photos</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto">
        {/* Preview Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-sm shadow-md" style={{ border: `1px solid ${frame.borderColor}20` }}>
            {transparentPhotos.map((fg, i) => renderPreview(fg, photos[i], i))}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          {!backgroundsRemoved && (
            <button
              onClick={handleRemoveBackgrounds}
              className="w-full py-3 rounded-sm font-medium tracking-wide transition-all text-sm border-2"
              style={{
                borderColor: frame.borderColor,
                color: frame.borderColor,
                background: 'transparent',
              }}
            >
              ✨ Remove All Backgrounds
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            {bgOptions.map((bg) => {
              const isSelected = selectedBg.id === bg.id;
              return (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBg(bg)}
                  className={`relative p-2 rounded-sm border-2 text-left transition-all ${isSelected ? 'shadow-md' : ''}`}
                  style={{
                    borderColor: isSelected ? frame.borderColor : `${frame.borderColor}20`,
                    background: isSelected ? `${frame.borderColor}05` : 'transparent'
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

            {/* Upload Button */}
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
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

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
