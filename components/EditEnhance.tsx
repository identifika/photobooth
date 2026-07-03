'use client';
import { Frame } from '@/lib/frames';
import { useIsMobile } from '@/hooks/useIsMobile';

export const ENHANCE_FILTERS = [
  { id: '', name: 'Normal', css: 'none' },
  { id: 'grayscale', name: 'B&W', css: 'grayscale(100%)' },
  { id: 'sepia', name: 'Sepia', css: 'sepia(80%)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(40%) contrast(120%) brightness(90%)' },
  { id: 'high-contrast', name: 'Contrast', css: 'contrast(130%) brightness(105%)' },
  { id: 'soft', name: 'Soft', css: 'brightness(110%) contrast(90%) saturate(80%)' },
];

interface Props {
  photos: string[];
  frame: Frame;
  selectedFilter: string;
  onSelectFilter: (filterId: string) => void;
  onConfirm: () => void;
}

export default function EditEnhance({ photos, frame, selectedFilter, onSelectFilter, onConfirm }: Props) {
  const isMobile = useIsMobile();
  const currentFilter = ENHANCE_FILTERS.find(f => f.id === selectedFilter) || ENHANCE_FILTERS[0];

  let currentAspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
  if (frame.config?.elements) {
    const photoSlots = frame.config.elements.filter(el => el.type === 'photo');
    if (photoSlots.length > 0) {
      const targetPhotoSlot = photoSlots[0];
      if (targetPhotoSlot.width && targetPhotoSlot.height) {
        currentAspectRatio = targetPhotoSlot.width / targetPhotoSlot.height;
      }
    }
  }

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-6">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Enhance</p>
        <h2 className="font-display text-3xl font-bold">Apply Filters</h2>
        <p className="mt-2 opacity-60 text-sm">Select a style for your final print</p>
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Preview section */}
        <div className="flex flex-wrap gap-4 justify-center">
          {photos.map((photo, idx) => (
            <div 
              key={idx}
              className="rounded-sm overflow-hidden shadow-lg transition-all"
              style={{
                width: isMobile ? 120 : 160,
                aspectRatio: String(currentAspectRatio),
                border: `3px solid ${frame.borderColor}`,
                background: frame.color,
              }}
            >
              <img 
                src={photo} 
                alt={`Preview ${idx + 1}`}
                className="w-full h-full object-cover transition-all duration-300"
                style={{ filter: currentFilter.css }}
              />
            </div>
          ))}
        </div>

        {/* Filter selection */}
        <div className="w-full max-w-2xl bg-surface-1 rounded-2xl p-4 border border-border">
          <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {ENHANCE_FILTERS.map(filter => {
              const isSelected = selectedFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => onSelectFilter(filter.id)}
                  className={`flex-shrink-0 snap-start flex flex-col items-center gap-2 transition-all ${isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                  style={{ width: 80 }}
                >
                  <div 
                    className="w-full aspect-square rounded-full overflow-hidden shadow-sm"
                    style={{
                      border: isSelected ? `3px solid var(--foreground)` : `1px solid var(--border)`,
                    }}
                  >
                    <img 
                      src={photos[0]} 
                      alt={filter.name}
                      className="w-full h-full object-cover"
                      style={{ filter: filter.css }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {filter.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-sm font-medium text-sm tracking-wide transition-all bg-primary text-primary-foreground hover:opacity-90 shadow-md"
          >
            ✓ Finish and Print
          </button>
        </div>
      </div>
    </div>
  );
}
