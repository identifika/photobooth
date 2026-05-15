'use client';
import { FRAMES, Frame } from '@/lib/frames';

interface Props {
  selected: Frame | null;
  onSelect: (frame: Frame) => void;
}

const LayoutPreview = ({ frame }: { frame: Frame }) => {
  const slots = Array.from({ length: frame.photoCount });
  const isGrid = frame.layout === 'grid-2x2';
  const isStrip2 = frame.layout === 'strip-2';

  return (
    <div
      className="relative p-2 rounded-sm"
      style={{ background: frame.color, border: `3px solid ${frame.borderColor}` }}
    >
      {/* Film holes for strip layouts */}
      {!isGrid && (
        <div className="flex justify-between px-0.5 mb-1.5">
          {[...Array(frame.photoCount + 1)].map((_, i) => (
            <div key={i} style={{
              width: 7, height: 10, borderRadius: 2,
              background: frame.borderColor, opacity: 0.4,
            }} />
          ))}
        </div>
      )}

      {/* Photo slots */}
      <div className={`${isGrid ? 'grid grid-cols-2 gap-1' : isStrip2 ? 'grid grid-cols-2 gap-1' : 'flex flex-col gap-1'}`}>
        {slots.map((_, i) => (
          <div key={i} style={{
            background: `${frame.borderColor}18`,
            border: `1.5px dashed ${frame.borderColor}60`,
            borderRadius: 2,
            aspectRatio: isGrid ? '1' : (isStrip2 ? '4/3' : '4/3'),
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: frame.borderColor, opacity: 0.4 }}>{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Bottom holes */}
      {!isGrid && (
        <div className="flex justify-between px-0.5 mt-1.5">
          {[...Array(frame.photoCount + 1)].map((_, i) => (
            <div key={i} style={{
              width: 7, height: 10, borderRadius: 2,
              background: frame.borderColor, opacity: 0.4,
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FrameSelector({ selected, onSelect }: Props) {
  return (
    <div className="w-full animate-fadeIn">
      <div className="text-center mb-10">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Step 01</p>
        <h2 className="font-display text-4xl font-bold" style={{ color: 'var(--ink)' }}>
          Choose Your Frame
        </h2>
        <p className="mt-2 opacity-60 text-sm">Select a layout to begin your session</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
        {FRAMES.map((frame, i) => {
          const isSelected = selected?.id === frame.id;
          return (
            <button
              key={frame.id}
              onClick={() => onSelect(frame)}
              className="animate-fadeIn text-left group"
              style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
            >
              <div style={{
                transform: isSelected ? 'translateY(-8px) rotate(-1.5deg)' : undefined,
                transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                filter: isSelected ? `drop-shadow(0 12px 24px ${frame.borderColor}40)` : undefined,
              }}
              className="group-hover:-translate-y-2 group-hover:rotate-[-1deg] transition-all duration-300"
              >
                <LayoutPreview frame={frame} />
              </div>

              <div className="mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <span>{frame.emoji}</span>
                  <span className="font-medium text-sm">{frame.name}</span>
                </div>
                <p className="text-xs opacity-50 mt-0.5">{frame.description}</p>
              </div>

              {isSelected && (
                <div className="mt-2 px-1">
                  <div className="h-0.5 rounded-full" style={{ background: frame.accentColor }} />
                </div>
              )}
            </button>
          );
        })}
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
