'use client';
import { useState } from 'react';
import { Frame } from '@/lib/frames';
import { removeBackground } from '@imgly/background-removal';

interface Props {
  photoUrl: string;
  photoIndex: number;
  totalPhotos: number;
  frame: Frame;
  onAccept: (url: string) => void;
  onRetry: () => void;
}

export default function PhotoReview({ photoUrl, photoIndex, totalPhotos, frame, onAccept, onRetry }: Props) {
  const [processing, setProcessing] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);
  const [transparentUrl, setTransparentUrl] = useState<string | null>(null);

  const aspectRatio = frame.layout === 'grid-2x2' ? 1 : 4/3;

  const handleToggleBg = async () => {
    if (removeBg) {
      setRemoveBg(false);
    } else {
      if (!transparentUrl) {
        setProcessing(true);
        try {
          const blob = await removeBackground(photoUrl);
          setTransparentUrl(URL.createObjectURL(blob));
          setRemoveBg(true);
        } catch (err) {
          console.error("Failed to remove background:", err);
          // Fallback to not removing bg
        } finally {
          setProcessing(false);
        }
      } else {
        setRemoveBg(true);
      }
    }
  };

  const finalUrl = removeBg && transparentUrl ? transparentUrl : photoUrl;

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Review</p>
        <h2 className="font-display text-4xl font-bold">
          How&apos;s this one?
        </h2>
        <p className="mt-2 opacity-60 text-sm">Photo {photoIndex + 1} of {totalPhotos}</p>
      </div>

      <div className="max-w-sm mx-auto">
        {/* Polaroid-style preview */}
        <div className="relative animate-slideUp" style={{
          background: 'white',
          padding: '12px 12px 48px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
          transform: 'rotate(-1deg)',
        }}>
          {/* Top tape strip effect */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 rounded-sm" style={{
            background: `${frame.accentColor}60`,
            backdropFilter: 'blur(2px)',
          }} />

          <div style={{
            aspectRatio: String(aspectRatio),
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
            <span style={{ fontSize: 10, color: frame.borderColor, opacity: 0.5, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {frame.name}
            </span>
          </div>
        </div>

        {/* Toggle Background Button */}
        <div className="mt-6 flex justify-center">
           <button
             onClick={handleToggleBg}
             disabled={processing}
             className="px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2"
             style={{
                background: removeBg ? frame.borderColor : 'transparent',
                color: removeBg ? frame.color : frame.borderColor,
                border: `1px solid ${frame.borderColor}`,
             }}
           >
             {removeBg ? '✓ Background Removed' : '✨ Remove Background'}
           </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 rounded-sm font-medium text-sm tracking-wide transition-all"
            style={{
              background: 'transparent',
              border: `2px solid ${frame.borderColor}`,
              color: frame.borderColor,
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = `${frame.borderColor}10`;
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            ↺ Retake
          </button>
          <button
            onClick={() => onAccept(finalUrl)}
            className="flex-1 py-3.5 rounded-sm font-medium text-sm tracking-wide transition-all"
            style={{
              background: frame.borderColor,
              color: frame.color,
              border: `2px solid ${frame.borderColor}`,
            }}
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
