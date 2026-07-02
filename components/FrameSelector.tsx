'use client';
import { useState, useEffect } from 'react';
import { Frame, loadPublicFrames } from '@/lib/frames';
import FramePreview from '@/components/FramePreview';
import { useIsMobile } from '@/hooks/useIsMobile';

interface Props {
  selected: Frame | null;
  onSelect: (frame: Frame) => void;
  userFrames?: Frame[];
}

const LayoutPreview = ({ frame }: { frame: Frame }) => {
  const slots = Array.from({ length: frame.photoCount });
  const isGrid = frame.layout === 'grid-2x2';
  const gridClass = isGrid ? 'grid-2x2' : frame.layout;

  return (
    <div className={`frame-preview ${gridClass}`}>
      {slots.map((_, i) => (
        <div key={i} className="photo-slot" />
      ))}
    </div>
  );
};

const FrameCard = ({
  frame,
  isSelected,
  onClick,
  index = 0,
}: {
  frame: Frame;
  isSelected: boolean;
  onClick: () => void;
  index?: number;
  isUserFrame?: boolean;
}) => {
  const w = frame.config?.width ?? 400;
  const h = frame.config?.height ?? 600;

  // Bound the thumbnail to 140x210 (which is 400x600 * 0.35)
  const MAX_W = 140;
  const MAX_H = 210;
  const scale = Math.min(MAX_W / w, MAX_H / h);
  const hasConfig = !!frame.config;

  return (
    <button
      onClick={onClick}
      className="animate-fadeIn text-center group flex flex-col items-center gap-2 w-full"
      style={{ animationDelay: `${index * 0.08}s`, opacity: 0, outline: 'none' }}
    >
      <div
        style={{
          transform: isSelected ? 'translateY(-8px) rotate(-1.5deg)' : undefined,
          transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          filter: isSelected ? `drop-shadow(0 12px 24px ${frame.borderColor ?? frame.accentColor}40)` : undefined,
        }}
        className="group-hover:-translate-y-2 group-hover:rotate-[-1deg] transition-all duration-300"
      >
        <div style={{
          width: w * scale,
          height: h * scale,
          overflow: hasConfig && frame.config?.borderStyle === 'ticket' ? 'visible' : 'hidden',
          boxShadow: hasConfig && frame.config?.borderStyle === 'ticket' ? 'none' : (isSelected ? `0 0 0 3px ${frame.accentColor ?? 'var(--brand)'}` : '0 4px 12px rgba(0,0,0,0.05)'),
          transition: 'box-shadow 0.2s'
        }}>
          {hasConfig ? (
            <FramePreview config={frame.config!} scale={scale} />
          ) : (
            <LayoutPreview frame={frame} />
          )}
        </div>
      </div>

      <div className="mt-2">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{frame.emoji} {frame.name}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{frame.photoCount} photos · {frame.layout.replace('-', ' ')}</div>
      </div>

      {isSelected && (
        <div className="mt-1 px-1 w-8">
          <div
            className="h-1 rounded-full mx-auto"
            style={{ background: frame.accentColor ?? frame.borderColor }}
          />
        </div>
      )}
    </button>
  );
};

export default function FrameSelector({ selected, onSelect, userFrames = [] }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadPublicFrames()
      .then(setFrames)
      .catch(() => setFrames([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading && frames.length === 0) {
    return (
      <div className="w-full animate-fadeIn">
        <p style={{ color: 'var(--text-muted)' }}>Loading frames...</p>
      </div>
    );
  }

  const hasUserFrames = userFrames.length > 0;

  return (
    <div className="w-full animate-fadeIn">
      <div className="text-center mb-10">
        <p className={`tracking-[0.25em] uppercase opacity-50 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>Step 01</p>
        <h2 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`} style={{ color: 'var(--ink)' }}>
          Choose Your Frame
        </h2>
        <p className={`mt-2 opacity-60 ${isMobile ? 'text-xs' : 'text-sm'}`}>Select a layout to begin your session</p>
      </div>

      {hasUserFrames && (
        <>
          <div className="section-label mb-4">My Frames</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-10">
            {userFrames.map((frame, i) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                index={i}
                isSelected={selected?.id === frame.id}
                onClick={() => onSelect(frame)}
                isUserFrame
              />
            ))}
          </div>
          <div className="section-label mb-4">Community Frames</div>
        </>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
        {frames.map((frame, i) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            index={hasUserFrames ? userFrames.length + i : i}
            isSelected={selected?.id === frame.id}
            onClick={() => onSelect(frame)}
          />
        ))}
      </div>

      {selected && (
        <div className="text-center mt-10 animate-fadeIn">
          <p className="text-sm opacity-60">
            {selected.emoji} <strong>{selected.name}</strong> selected — {selected.photoCount} photos
          </p>
        </div>
      )}
    </div>
  );
}