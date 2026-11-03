'use client';
import { NormalizedKeypoint } from '@/lib/pose/types';

interface PoseSilhouetteProps {
  skeleton: NormalizedKeypoint[][];
  className?: string;
  fillColor?: string;
  opacity?: number;
  glow?: boolean;
}

export default function PoseSilhouette({
  skeleton,
  className = 'w-full h-full',
  fillColor = '#ffffff',
  opacity = 1,
  glow = false,
}: PoseSilhouetteProps) {
  if (!skeleton || skeleton.length === 0) return null;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{
        opacity,
        filter: glow ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.5))' : undefined,
      }}
    >
      <defs>
        {/* Soft gradient for shadow aesthetic */}
        <linearGradient id="silhouetteGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {skeleton.map((person, pIdx) => {
        const head = person[0] || { x: 0.5, y: 0.25 };
        const sL = person[11] || { x: 0.4, y: 0.4 };
        const sR = person[12] || { x: 0.6, y: 0.4 };
        const eL = person[13] || { x: 0.35, y: 0.55 };
        const eR = person[14] || { x: 0.65, y: 0.55 };
        const wL = person[15] || { x: 0.35, y: 0.7 };
        const wR = person[16] || { x: 0.65, y: 0.7 };
        const hL = person[23] || { x: 0.43, y: 0.85 };
        const hR = person[24] || { x: 0.57, y: 0.85 };

        // Convert 0..1 coordinates to 0..100 viewBox
        const px = (pt: { x: number; y: number }) => ({ x: pt.x * 100, y: pt.y * 100 });
        const h = px(head);
        const sl = px(sL);
        const sr = px(sR);
        const el = px(eL);
        const er = px(eR);
        const wl = px(wL);
        const wr = px(wR);
        const hl = px(hL);
        const hr = px(hR);

        const shoulderWidth = Math.hypot(sr.x - sl.x, sr.y - sl.y) || 20;
        const armWidth = Math.max(5, shoulderWidth * 0.28);
        const headRadius = Math.max(7, shoulderWidth * 0.34);

        return (
          <g key={pIdx}>
            {/* Torso polygon */}
            <polygon
              points={`${sl.x},${sl.y} ${sr.x},${sr.y} ${hr.x},${hr.y} ${hl.x},${hl.y}`}
              fill="url(#silhouetteGrad)"
            />

            {/* Left Arm: Shoulder -> Elbow -> Wrist */}
            <polyline
              points={`${sl.x},${sl.y} ${el.x},${el.y} ${wl.x},${wl.y}`}
              fill="none"
              stroke="url(#silhouetteGrad)"
              strokeWidth={armWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Right Arm: Shoulder -> Elbow -> Wrist */}
            <polyline
              points={`${sr.x},${sr.y} ${er.x},${er.y} ${wr.x},${wr.y}`}
              fill="none"
              stroke="url(#silhouetteGrad)"
              strokeWidth={armWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hands / Wrists round caps */}
            <circle cx={wl.x} cy={wl.y} r={armWidth * 0.6} fill="url(#silhouetteGrad)" />
            <circle cx={wr.x} cy={wr.y} r={armWidth * 0.6} fill="url(#silhouetteGrad)" />

            {/* Neck bridge */}
            <polygon
              points={`${(sl.x + sr.x) / 2 - 3},${(sl.y + sr.y) / 2} ${(sl.x + sr.x) / 2 + 3},${(sl.y + sr.y) / 2} ${h.x + 2.5},${h.y + headRadius * 0.7} ${h.x - 2.5},${h.y + headRadius * 0.7}`}
              fill="url(#silhouetteGrad)"
            />

            {/* Head circle / oval */}
            <circle cx={h.x} cy={h.y} r={headRadius} fill="url(#silhouetteGrad)" />
          </g>
        );
      })}
    </svg>
  );
}

