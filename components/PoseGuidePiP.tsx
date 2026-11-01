'use client';
import { useState } from 'react';
import { PoseReference } from '@/lib/pose/types';
import { DEFAULT_POSES } from '@/lib/pose/defaultPoses';
import { Sparkles, RefreshCw, X, Check, ChevronRight } from 'lucide-react';

interface PoseGuidePiPProps {
  currentPose: PoseReference | null;
  isMatched: boolean;
  matchScore: number;
  photoIndex: number;
  detectedPeople: number;
  onSelectPose: (pose: PoseReference) => void;
  onNextSuggestion: () => void;
  countdownActive?: boolean;
  capturing?: boolean;
}

export default function PoseGuidePiP({
  currentPose,
  isMatched,
  matchScore,
  photoIndex,
  detectedPeople,
  onSelectPose,
  onNextSuggestion,
  countdownActive = false,
  capturing = false,
}: PoseGuidePiPProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'auto' | 1 | 2 | 3>('auto');

  if (!currentPose) return null;

  // Filter poses in catalog
  const effectivePeople = activeTab === 'auto' ? Math.max(1, Math.min(3, detectedPeople)) : activeTab;
  const filteredPoses = DEFAULT_POSES.filter((p) =>
    effectivePeople >= 3 ? p.people >= 3 : p.people === effectivePeople
  );

  // During active shooting / countdown, fade down so user is not distracted
  const isMuted = countdownActive || capturing;

  return (
    <>
      {/* Floating Picture-in-Picture Card (Top-Right of Viewfinder) */}
      <div
        className={`absolute top-3 right-3 z-20 transition-all duration-300 pointer-events-auto ${
          isMuted ? 'opacity-30 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {isMinimized ? (
          // Minimized pill button
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs shadow-lg transition-all"
          >
            <span className="text-sm">{currentPose.emoji || '✨'}</span>
            <span className="font-medium text-[11px]">Ide Gaya</span>
            {isMatched && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </button>
        ) : (
          // Aesthetic Floating Card
          <div
            className={`w-40 sm:w-44 rounded-2xl p-2.5 backdrop-blur-md transition-all duration-300 shadow-2xl border ${
              isMatched
                ? 'bg-emerald-950/70 border-emerald-400/80 ring-2 ring-emerald-400/40 shadow-emerald-900/40'
                : 'bg-black/65 border-white/20 hover:border-white/35'
            }`}
          >
            {/* Top row: badge + close */}
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                  isMatched
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : 'bg-white/10 text-pink-300'
                }`}
              >
                {isMatched ? (
                  <>
                    <Check className="w-2.5 h-2.5" /> Pas!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5" /> Ide #{photoIndex + 1}
                  </>
                )}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={onNextSuggestion}
                  className="w-5 h-5 rounded-full hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  title="Ganti rekomendasi gaya"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-5 h-5 rounded-full hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  title="Sembunyikan panduan"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Pose Content (Clickable to browse catalog) */}
            <div
              className="cursor-pointer group"
              onClick={() => setDrawerOpen(true)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 shadow-inner ${
                    isMatched
                      ? 'bg-emerald-500/20 border border-emerald-400/40'
                      : 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/15'
                  }`}
                >
                  {currentPose.emoji || '✨'}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-white truncate leading-tight group-hover:text-pink-200 transition-colors">
                    {currentPose.name}
                  </h4>
                  <p className="text-[10px] text-white/50 truncate leading-tight mt-0.5">
                    {currentPose.description || `${currentPose.people} Orang`}
                  </p>
                </div>
              </div>

              {/* Match Score or Browse hint */}
              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px]">
                {isMatched ? (
                  <span className="text-emerald-300 font-medium flex items-center gap-1">
                    ✨ Posisi pas ({matchScore}%)
                  </span>
                ) : (
                  <span className="text-white/40 group-hover:text-white/70 flex items-center gap-0.5 transition-colors">
                    Lihat katalog <ChevronRight className="w-2.5 h-2.5" />
                  </span>
                )}
                <span className="text-white/40 font-mono text-[9px]">
                  {currentPose.people}P
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Catalog Modal / Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" /> Katalog Gaya Photobooth
                </h3>
                <p className="text-xs text-white/60">Pilih pose untuk ditampilkan di kartu panduan</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs for Person Count */}
            <div className="flex gap-2 p-3 bg-black/30 border-b border-white/10 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('auto')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'auto' ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Auto ({detectedPeople || 1} Orang)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(1)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 1 ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Solo (1P)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 2 ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Duo (2P)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(3)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 3 ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                Group (3P+)
              </button>
            </div>

            {/* Poses Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {filteredPoses.map((pose) => {
                const isSelected = currentPose.id === pose.id;
                return (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => {
                      onSelectPose(pose);
                      setIsMinimized(false);
                      setDrawerOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg ring-2 ring-pink-500/40'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl">{pose.emoji || '✨'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        {pose.people}P
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-white mb-0.5">{pose.name}</h4>
                      <p className="text-[11px] text-white/50 line-clamp-2 leading-tight">
                        {pose.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

