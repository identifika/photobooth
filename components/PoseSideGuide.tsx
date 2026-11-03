'use client';
import { PoseReference } from '@/lib/pose/types';
import { DEFAULT_POSES } from '@/lib/pose/defaultPoses';
import PoseSilhouette from '@/components/PoseSilhouette';
import { Sparkles, Users, Eye, EyeOff } from 'lucide-react';

interface PoseSideGuideProps {
  detectedPeople: number;
  currentPose: PoseReference | null;
  onSelectPose: (pose: PoseReference) => void;
  showShadowOnCamera: boolean;
  onToggleShadow: () => void;
  isMatched?: boolean;
  countdownActive?: boolean;
  isCapturing?: boolean;
}

export default function PoseSideGuide({
  detectedPeople,
  currentPose,
  onSelectPose,
  showShadowOnCamera,
  onToggleShadow,
  isMatched = false,
  countdownActive = false,
  isCapturing = false,
}: PoseSideGuideProps) {
  // If 3 or more people detected, do NOT show any suggestions!
  if (detectedPeople >= 3) {
    return null;
  }

  // Filter poses: strictly 1 person if detected 1, 2 people if detected 2
  const targetPeople = detectedPeople === 2 ? 2 : 1;
  const poses = DEFAULT_POSES.filter((p) => p.people === targetPeople);

  // During active shooting, gently fade so viewfinder is the star
  const isMuted = countdownActive || isCapturing;

  return (
    <div
      className={`transition-all duration-300 w-full lg:w-72 shrink-0 ${
        isMuted ? 'opacity-20 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div>
              <h3 className="font-semibold text-xs sm:text-sm text-white tracking-wide flex items-center gap-1.5">
                Ide Pose {targetPeople === 1 ? 'Solo' : 'Duo'}
              </h3>
              <p className="text-[10px] text-white/50">
                {targetPeople === 1 ? '1 Orang terdeteksi' : '2 Orang terdeteksi'}
              </p>
            </div>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> {targetPeople}P
          </span>
        </div>

        {/* Pose Cards List (Vertical on desktop, horizontal scroll on mobile) */}
        <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 scrollbar-none">
          {poses.map((pose) => {
            const isSelected = currentPose?.id === pose.id;

            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => onSelectPose(pose)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all shrink-0 w-44 lg:w-full ${
                  isSelected
                    ? isMatched
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-md ring-1 ring-emerald-400/40'
                      : 'bg-pink-500/15 border-pink-400/80 shadow-md ring-1 ring-pink-400/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {/* Silhouette Mini Preview */}
                <div
                  className={`w-12 h-14 rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden ${
                    isSelected
                      ? isMatched
                        ? 'bg-emerald-950/60 border border-emerald-400/50'
                        : 'bg-pink-950/50 border border-pink-400/50'
                      : 'bg-black/40 border border-white/10'
                  }`}
                >
                  <PoseSilhouette
                    skeleton={pose.skeleton}
                    fillColor={isSelected ? (isMatched ? '#34d399' : '#f472b6') : '#ffffff'}
                    opacity={isSelected ? 0.95 : 0.6}
                  />
                </div>

                {/* Pose Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{pose.emoji}</span>
                    <h4 className="font-semibold text-xs text-white truncate">{pose.name}</h4>
                  </div>
                  <p className="text-[10px] text-white/55 line-clamp-2 leading-tight">
                    {pose.description}
                  </p>
                  {isSelected && (
                    <span
                      className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider ${
                        isMatched ? 'text-emerald-300' : 'text-pink-400'
                      }`}
                    >
                      {isMatched ? '✨ Posisi Pas!' : 'Dipilih'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Toggle for Camera Shadow */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-[11px] text-white/60">Bayangan di Kamera</span>
          <button
            type="button"
            onClick={onToggleShadow}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              showShadowOnCamera
                ? 'bg-pink-500 text-white shadow-sm'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {showShadowOnCamera ? (
              <>
                <Eye className="w-3 h-3" /> Aktif
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 opacity-60" /> Mati
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

