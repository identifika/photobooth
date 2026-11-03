'use client';
import { NormalizedKeypoint } from '@/lib/pose/types';
import PoseSilhouette from '@/components/PoseSilhouette';

interface CameraPoseShadowProps {
  skeleton: NormalizedKeypoint[][] | null;
  isMatched?: boolean;
  opacity?: number;
}

export default function CameraPoseShadow({
  skeleton,
  isMatched = false,
  opacity = 0.3,
}: CameraPoseShadowProps) {
  if (!skeleton || skeleton.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden transition-all duration-300">
      <PoseSilhouette
        skeleton={skeleton}
        className="w-full h-full"
        fillColor={isMatched ? '#34d399' : '#ffffff'}
        opacity={isMatched ? Math.min(1, opacity + 0.15) : opacity}
        glow={isMatched}
      />
    </div>
  );
}

