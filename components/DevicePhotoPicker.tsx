'use client';

import { useRef, useState } from 'react';
import { Frame } from '@/lib/frames';
import { cropFileToAspect, getPhotoSlotAspect } from '@/lib/crop-photo';
import { useIsMobile } from '@/hooks/useIsMobile';

interface Props {
  frame: Frame;
  photoIndex: number;
  totalPhotos: number;
  onPhotos: (dataUrls: string[]) => void;
  isRetake?: boolean;
  retakeIndex?: number;
}

export default function DevicePhotoPicker({ frame, photoIndex, totalPhotos, onPhotos, isRetake, retakeIndex }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const isMobile = useIsMobile();

  const activeIndex = isRetake && retakeIndex !== undefined ? retakeIndex : photoIndex;
  const slotsLeft = isRetake ? 1 : Math.max(1, totalPhotos - photoIndex);
  const aspectRatio = getPhotoSlotAspect(frame, activeIndex);

  const handleFiles = async (fileList: FileList | File[]) => {
    if (preparingRef.current) return;
    const files = Array.from(fileList).filter((file) => {
      if (!file.type) return true;
      return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
    });
    const picked = files.slice(0, slotsLeft);
    if (picked.length === 0) {
      setError('Choose a photo from this device.');
      return;
    }

    setError('');
    preparingRef.current = true;
    setPreparing(true);
    const dataUrls: string[] = [];
    const failures: string[] = [];

    try {
      for (let i = 0; i < picked.length; i++) {
        const slotIndex = isRetake && retakeIndex !== undefined ? retakeIndex : photoIndex + i;
        setProgress(picked.length > 1 ? `Preparing ${i + 1} of ${picked.length}` : 'Preparing photo');
        try {
          dataUrls.push(await cropFileToAspect(picked[i], getPhotoSlotAspect(frame, slotIndex)));
        } catch (err) {
          failures.push(err instanceof Error ? err.message : 'Could not read that photo.');
        }
      }
    } finally {
      preparingRef.current = false;
      setPreparing(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }

    if (dataUrls.length === 0) {
      setError(failures[0] || 'Could not read that photo. Try a JPEG or PNG.');
      return;
    }

    onPhotos(dataUrls);
  };

  return (
    <div className="w-full animate-fadeIn">
      <div className="text-center mb-8">
        <p className={`text-sm tracking-[0.25em] uppercase opacity-50 mb-2 ${isMobile ? 'text-xs' : ''}`}>
          {isRetake ? 'Replace' : 'Step 02'}
        </p>
        <h2 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
          {isRetake ? (
            <>Replace Photo <span className="opacity-40">#{retakeIndex! + 1}</span></>
          ) : (
            <>Photo {photoIndex + 1} <span className="opacity-40">of {totalPhotos}</span></>
          )}
        </h2>
        <p className="mt-2 opacity-60 text-sm">
          {frame.emoji} {frame.name} · choose {slotsLeft > 1 ? `up to ${slotsLeft} photos` : 'a photo'} already on this device
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-8">
        {Array.from({ length: totalPhotos }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === activeIndex ? 24 : 10,
              height: 10,
              borderRadius: 5,
              background: i < activeIndex ? frame.accentColor : i === activeIndex ? frame.borderColor : `${frame.borderColor}30`,
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      <div className="w-full flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={() => {
            if (!preparingRef.current) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
          }}
          className="relative overflow-hidden rounded-sm transition-all duration-300"
          style={{
            aspectRatio: String(aspectRatio),
            width: '100%',
            maxWidth: isMobile ? `min(100%, 60vh * ${aspectRatio})` : `min(32rem, 55vh * ${aspectRatio})`,
            border: `4px dashed ${dragOver ? frame.accentColor : frame.borderColor}`,
            background: dragOver ? `${frame.accentColor}18` : `${frame.color}`,
            boxShadow: `0 20px 60px ${frame.borderColor}30`,
            cursor: preparing ? 'wait' : 'pointer',
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" style={{ color: frame.borderColor }}>
            {preparing ? (
              <>
                <div
                  className="w-10 h-10 border-4 border-t-transparent rounded-full mx-auto mb-3 animate-spin"
                  style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }}
                />
                <p className="text-sm font-medium">{progress}</p>
              </>
            ) : (
              <>
                <p className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Choose photo</p>
                <p className="mt-2 text-sm opacity-70">
                  {isMobile ? 'Opens your photo library' : 'Click to browse, or drop a photo here'}
                </p>
                <p className="mt-3 text-[11px] tracking-[0.14em] uppercase opacity-50">Cropped to fit this frame</p>
              </>
            )}
          </div>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={slotsLeft > 1}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files);
          }}
        />

        {error && (
          <p className="mt-4 text-sm text-center max-w-md" style={{ color: 'var(--accent)' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
