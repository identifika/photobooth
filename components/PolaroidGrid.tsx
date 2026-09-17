import React from 'react';

interface PolaroidGridProps {
  polaroidDataUrls: string[];
  onDownloadPhoto: (url: string, index: number) => void;
}

export default function PolaroidGrid({ polaroidDataUrls, onDownloadPhoto }: PolaroidGridProps) {
  if (polaroidDataUrls.length === 0) return null;

  return (
    <div className="mb-6 animate-slideUp" style={{ animationDelay: '0.1s' }}>
      <h3 className="text-sm font-medium mb-3 opacity-70">Download Polaroids</h3>
      <div className="flex gap-4 justify-center flex-wrap">
        {polaroidDataUrls.map((photoUrl, i) => (
          <div key={i} className="relative group shadow-lg" style={{ transform: i % 2 === 0 ? 'rotate(-2deg)' : 'rotate(2deg)' }}>
            <img src={photoUrl} alt={`Photo ${i + 1}`} className="h-40 rounded-sm bg-white" />
            <button
              onClick={() => onDownloadPhoto(photoUrl, i)}
              className="absolute inset-0 flex items-center justify-center bg-black/0 sm:group-hover:bg-black/40 transition-all rounded-sm cursor-pointer"
              title="Download photo"
              aria-label={`Download photo ${i + 1}`}
            >
              <span className="hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium tracking-wide bg-black/50 px-2.5 py-1 rounded-full">
                ↓ Save
              </span>
              <span className="sm:hidden absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[11px] font-medium px-2 py-0.5 rounded shadow">
                ↓ Save
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
