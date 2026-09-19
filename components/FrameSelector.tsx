'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, loadPublicFrames } from '@/lib/frames';
import FramePreview from '@/components/FramePreview';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDialog } from '@/components/ui/dialog-provider';
import { Plus, Sparkles, Pencil } from 'lucide-react';
import { getGuestFrameDraft, guestDraftToFrame } from '@/lib/guest-frame';

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
  const [guestDraftFrame, setGuestDraftFrame] = useState<Frame | null>(null);
  const isMobile = useIsMobile();
  const router = useRouter();
  const { alert } = useDialog();

  useEffect(() => {
    loadPublicFrames()
      .then(setFrames)
      .catch(() => setFrames([]))
      .finally(() => setLoading(false));

    // Check for cached guest draft
    const draft = getGuestFrameDraft();
    if (draft) {
      setGuestDraftFrame(guestDraftToFrame(draft));
    }
  }, []);

  const handleCreateCustomFrame = async () => {
    if (isMobile) {
      await alert('The Frame Editor is best experienced on a tablet or desktop. Please use a larger screen to create and edit frames.');
      return;
    }
    router.push('/editor');
  };

  if (loading && frames.length === 0) {
    return (
      <div className="w-full animate-fadeIn">
        <p style={{ color: 'var(--text-muted)' }}>Loading frames...</p>
      </div>
    );
  }

  const hasUserFrames = userFrames.length > 0;
  const showMyFramesSection = hasUserFrames || !!guestDraftFrame;

  return (
    <div className="w-full animate-fadeIn">
      <div className="text-center mb-8">
        <p className={`tracking-[0.25em] uppercase opacity-50 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>Step 01</p>
        <h2 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`} style={{ color: 'var(--ink)' }}>
          Choose Your Frame
        </h2>
        <p className={`mt-2 opacity-60 ${isMobile ? 'text-xs' : 'text-sm'}`}>Select a layout to begin your session</p>

        {/* CTA Button in Frame Public List */}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={handleCreateCustomFrame}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            style={{
              background: 'var(--brand)',
              color: '#ffffff',
            }}
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Create Custom Frame</span>
            <Sparkles className="w-3.5 h-3.5 opacity-80 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {showMyFramesSection && (
        <>
          <div className="section-label mb-4 flex items-center justify-between">
            <span>My Frames</span>
            {guestDraftFrame && !hasUserFrames && (
              <span className="text-[11px] font-normal text-muted-foreground font-mono">Cached in browser</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-10">
            {guestDraftFrame && (
              <div className="relative group w-full">
                <FrameCard
                  frame={guestDraftFrame}
                  index={0}
                  isSelected={selected?.id === guestDraftFrame.id}
                  onClick={() => onSelect(guestDraftFrame)}
                  isUserFrame
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateCustomFrame();
                  }}
                  className="absolute top-1 right-2 p-1.5 rounded-full bg-card/90 hover:bg-card border border-border shadow-sm text-foreground transition-all duration-200 cursor-pointer"
                  title="Edit Custom Frame"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            {userFrames.map((frame, i) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                index={guestDraftFrame ? i + 1 : i}
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
        {/* Custom Frame Creator Card */}
        <button
          type="button"
          onClick={handleCreateCustomFrame}
          className="animate-fadeIn text-center group flex flex-col items-center gap-2 w-full focus:outline-none cursor-pointer"
          style={{ animationDelay: '0s', opacity: 0 }}
        >
          <div className="w-[140px] h-[210px] rounded-lg border-2 border-dashed border-border/80 hover:border-brand/70 bg-card/40 hover:bg-brand/5 transition-all duration-300 flex flex-col items-center justify-center p-3 text-center group-hover:-translate-y-2 group-hover:rotate-[-1deg] shadow-sm">
            <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-brand group-hover:text-white transition-all duration-300">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Create Custom</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Design in editor</span>
          </div>
          <div className="mt-2">
            <div className="font-medium text-sm text-foreground">✨ Create Custom</div>
            <div className="text-xs mt-1 text-muted-foreground">Design your own</div>
          </div>
        </button>

        {frames.map((frame, i) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            index={showMyFramesSection ? (userFrames.length + (guestDraftFrame ? 1 : 0) + i + 1) : i + 1}
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