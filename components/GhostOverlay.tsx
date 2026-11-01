'use client';
import { useEffect, useRef } from 'react';
import { NormalizedKeypoint } from '@/lib/pose/types';
import { UPPER_BODY_BONES } from '@/lib/pose/vector';

interface GhostOverlayProps {
  skeleton: NormalizedKeypoint[][] | null;
  width?: number;
  height?: number;
  isMatched?: boolean;
  matchScore?: number;
  poseName?: string;
}

export default function GhostOverlay({
  skeleton,
  isMatched = false,
  matchScore = 0,
  poseName,
}: GhostOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (!skeleton || skeleton.length === 0) return;

    // Glowing style
    const strokeColor = isMatched ? '#22c55e' : 'rgba(255, 255, 255, 0.75)';
    const jointColor = isMatched ? '#4ade80' : 'rgba(255, 255, 255, 0.9)';
    const glowColor = isMatched ? 'rgba(34, 197, 94, 0.6)' : 'rgba(255, 255, 255, 0.3)';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isMatched ? 16 : 8;

    for (const person of skeleton) {
      // 1. Draw dashed bones
      ctx.beginPath();
      ctx.lineWidth = isMatched ? 4 : 3;
      ctx.strokeStyle = strokeColor;
      ctx.setLineDash([8, 8]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [startIdx, endIdx] of UPPER_BODY_BONES) {
        const p1 = person[startIdx];
        const p2 = person[endIdx];
        if (!p1 || !p2) continue;
        if ((p1.v ?? 1) < 0.2 || (p2.v ?? 1) < 0.2) continue;

        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
      }
      ctx.stroke();

      // 2. Draw head halo / indicator
      const head = person[0];
      const shoulderL = person[11];
      const shoulderR = person[12];
      if (head && shoulderL && shoulderR) {
        const shoulderW = Math.hypot((shoulderR.x - shoulderL.x) * w, (shoulderR.y - shoulderL.y) * h);
        const headRadius = Math.max(16, shoulderW * 0.24);

        ctx.beginPath();
        ctx.arc(head.x * w, head.y * h, headRadius, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
      }

      // 3. Draw joint dots
      ctx.setLineDash([]);
      ctx.fillStyle = jointColor;

      for (let i = 0; i < person.length; i++) {
        // Only draw key joints (head, shoulders, elbows, wrists, hips)
        if (![0, 11, 12, 13, 14, 15, 16, 23, 24].includes(i)) continue;
        const pt = person[i];
        if (!pt || (pt.v ?? 1) < 0.2) continue;

        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isMatched ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }, [skeleton, isMatched]);

  if (!skeleton || skeleton.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
      {/* Canvas for the ghost lines */}
      <canvas ref={canvasRef} className="w-full h-full absolute inset-0 pointer-events-none" />

      {/* Floating Match status badge */}
      <div className="relative p-3 flex justify-between items-start pointer-events-auto">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold tracking-wide transition-all duration-300 shadow-lg ${
            isMatched
              ? 'bg-green-500/90 text-white shadow-green-500/40 ring-2 ring-green-300 scale-105'
              : 'bg-black/60 text-white/90 border border-white/20'
          }`}
        >
          <span className="text-sm">{isMatched ? '✨' : '🎯'}</span>
          <span>
            {isMatched ? 'Pose Cocok!' : poseName ? `Ikuti: ${poseName}` : 'Posisikan Badan'}
          </span>
          {matchScore > 0 && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                isMatched ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              {matchScore}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

