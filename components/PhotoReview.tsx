'use client';
import { useState, useEffect } from 'react';
import { Frame } from '@/lib/frames';
import { removeBg } from '@/lib/remove-bg';
import { useIsMobile } from '@/hooks/useIsMobile';

interface Props {
  photoUrl: string;
  photoIndex: number;
  totalPhotos: number;
  frame: Frame;
  onAccept: (url: string, bgRemoved: boolean) => void;
  onRetry: () => void;
  autoRemoveBg?: boolean;
}

export default function PhotoReview({ photoUrl, photoIndex, totalPhotos, frame, onAccept, onRetry, autoRemoveBg }: Props) {
  const [processing, setProcessing] = useState(false);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(false);
  const [transparentUrl, setTransparentUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();

  let currentAspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
  if (frame.config?.elements) {
    const photos = frame.config.elements.filter(el => el.type === 'photo');
    const targetPhoto = photos[photoIndex] || photos[0];
    if (targetPhoto && targetPhoto.width && targetPhoto.height) {
      currentAspectRatio = targetPhoto.width / targetPhoto.height;
    }
  }

  // Auto-apply background removal for retakes
  useEffect(() => {
    if (autoRemoveBg && !removeBgEnabled && !processing && !transparentUrl) {
      handleToggleBg();
    }
  }, [autoRemoveBg]);

  const handleToggleBg = async () => {
    if (removeBgEnabled) {
      setRemoveBgEnabled(false);
    } else {
      if (!transparentUrl) {
        setProcessing(true);
        try {
          const result = await removeBg(photoUrl);
          setTransparentUrl(result);
          setRemoveBgEnabled(true);
        } catch (err) {
          console.error("Failed to remove background:", err);
          // Fallback to not removing bg
        } finally {
          setProcessing(false);
        }
      } else {
        setRemoveBgEnabled(true);
      }
    }
  };

  const finalUrl = removeBgEnabled && transparentUrl ? transparentUrl : photoUrl;

  const previewMaxWidth = isMobile ? '100%' : `min(24rem, 45vh * ${currentAspectRatio})`;

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-6">
        <p className={`tracking-[0.25em] uppercase opacity-50 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>Review</p>
        <h2 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
          How&apos;s this one?
        </h2>
        <p className={`mt-2 opacity-60 ${isMobile ? 'text-xs' : 'text-sm'}`}>Photo {photoIndex + 1} of {totalPhotos}</p>
      </div>

      <div className={`w-full flex flex-col items-center justify-center ${isMobile ? 'px-4' : ''}`}>
        {/* Polaroid-style preview */}
        <div className="relative animate-slideUp transition-all duration-300" style={{
          width: '100%',
          maxWidth: previewMaxWidth,
          background: 'white',
          padding: isMobile ? '8px 8px 36px' : '12px 12px 48px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
          transform: 'rotate(-1deg)',
        }}>
          {/* Top tape strip effect */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 rounded-sm" style={{
            background: `${frame.accentColor}60`,
            backdropFilter: 'blur(2px)',
          }} />

          <div style={{
            aspectRatio: String(currentAspectRatio),
            overflow: 'hidden',
            background: '#eee',
            position: 'relative'
          }}>
            {processing && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
               </div>
            )}
            <img
              src={finalUrl}
              alt="Captured photo"
              className="w-full h-full object-cover"
              style={{ filter: 'sepia(10%) contrast(1.05) brightness(0.98)' }}
            />
          </div>

          {/* Polaroid label area */}
          <div className="mt-3 flex items-center justify-between">
            <span className="font-display text-xs italic opacity-40">
              {photoIndex + 1}/{totalPhotos}
            </span>
            <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground opacity-70">
              {frame.name}
            </span>
          </div>
        </div>

        {/* Toggle Background Button */}
        <div className={`flex justify-center w-full ${isMobile ? 'mt-4' : 'mt-6'}`}>
           <button
             onClick={handleToggleBg}
             disabled={processing}
             className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${removeBgEnabled ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border border-input hover:bg-surface-0'}`}
           >
             {removeBgEnabled ? '✓ Background Removed' : '✨ Remove Background'}
           </button>
        </div>

        {/* Action buttons */}
        <div className={`flex gap-3 w-full ${isMobile ? 'mt-5 px-4' : 'mt-8 max-w-sm'}`}>
          <button
            onClick={onRetry}
            className="flex-1 py-3 rounded-sm font-medium text-sm tracking-wide transition-all border-2 border-input text-foreground bg-transparent hover:bg-surface-0"
          >
            ↺ Retake
          </button>
          <button
            onClick={() => onAccept(finalUrl, removeBgEnabled)}
            className="flex-1 py-3 rounded-sm font-medium text-sm tracking-wide transition-all bg-primary text-primary-foreground hover:opacity-90"
          >
            {photoIndex + 1 === totalPhotos ? '✓ Done' : 'Use This →'}
          </button>
        </div>

        {/* Remaining photos hint */}
        {photoIndex + 1 < totalPhotos && (
          <p className="text-center text-xs opacity-40 mt-4">
            {totalPhotos - photoIndex - 1} more photo{totalPhotos - photoIndex - 1 > 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  );
}
