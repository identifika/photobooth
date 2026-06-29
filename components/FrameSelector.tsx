'use client';
import { useState, useEffect } from 'react';
import { Frame, loadPublicFrames } from '@/lib/frames';
import FramePreview from '@/components/FramePreview';

interface Props {
  selected: Frame | null;
  onSelect: (frame: Frame) => void;
  userFrames?: Frame[];
}

const LayoutPreview = ({ frame }: { frame: Frame }) => {
  const slots = Array.from({ length: frame.photoCount });
  const isGrid = frame.layout === 'grid-2x2';
  const isStrip2 = frame.layout === 'strip-2';

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
  isUserFrame,
}: {
  frame: Frame;
  isSelected: boolean;
  onClick: () => void;
  isUserFrame?: boolean;
}) => {
  const scale = 0.2;
  const w = frame.config?.width ?? 400;
  const h = frame.config?.height ?? 600;
  const hasConfig = !!frame.config;

  return (
    <button
      onClick={onClick}
      className={`frame-card ${isSelected ? 'selected' : ''} animate-fadeIn`}
    >
      <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden', borderRadius: 6 }}>
        {hasConfig ? (
          <div style={{ width: w * scale, height: h * scale, overflow: 'hidden' }}>
            <FramePreview config={frame.config!} scale={scale} />
          </div>
        ) : (
          <LayoutPreview frame={frame} />
        )}
      </div>

      <div className="frame-name">{frame.emoji} {frame.name}</div>
      <div className="frame-meta">{frame.photoCount} photos · {frame.layout.replace('-', ' ')}</div>
    </button>
  );
};

export default function FrameSelector({ selected, onSelect, userFrames = [] }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="w-full">
      {/* User custom frames section */}
      {hasUserFrames && (
        <div className="mb-8">
          <div className="section-label">My Frames</div>
          <div className="pb-frames-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {userFrames.map((frame) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                isSelected={selected?.id === frame.id}
                onClick={() => onSelect(frame)}
                isUserFrame
              />
            ))}
          </div>
        </div>
      )}

      {/* Public frames section */}
      <div className="section-label">
        {hasUserFrames ? 'Community Frames' : 'Choose a frame'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 32 }}>
        {frames.map((frame) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            isSelected={selected?.id === frame.id}
            onClick={() => onSelect(frame)}
          />
        ))}
      </div>
    </div>
  );
}