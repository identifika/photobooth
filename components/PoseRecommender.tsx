'use client';
import { useState } from 'react';
import { PoseReference } from '@/lib/pose/types';
import { DEFAULT_POSES } from '@/lib/pose/defaultPoses';
import { Sparkles, Users, Eye, EyeOff, RefreshCw, X } from 'lucide-react';

interface PoseRecommenderProps {
  currentPose: PoseReference | null;
  detectedPeople: number;
  showGhost: boolean;
  onToggleGhost: () => void;
  onSelectPose: (pose: PoseReference) => void;
  onNextSuggestion: () => void;
  isCapturing?: boolean;
  countdownActive?: boolean;
}

export default function PoseRecommender({
  currentPose,
  detectedPeople,
  showGhost,
  onToggleGhost,
  onSelectPose,
  onNextSuggestion,
  isCapturing = false,
  countdownActive = false,
}: PoseRecommenderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'auto' | 1 | 2 | 3>('auto');

  // Filter library based on active tab or auto
  const effectivePeople = activeTab === 'auto' ? Math.max(1, Math.min(3, detectedPeople)) : activeTab;
  const filteredPoses = DEFAULT_POSES.filter((p) =>
    effectivePeople >= 3 ? p.people >= 3 : p.people === effectivePeople
  );

  if (isCapturing || countdownActive) {
    // Keep UI minimal during active countdown/capture so viewfinder is clean
    return null;
  }

  return (
    <>
      {/* Floating Suggestion Bar */}
      <div className="w-full max-w-md mx-auto px-2 mt-3">
        <div className="bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 text-white">
          <div
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setDrawerOpen(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
              {currentPose?.emoji || '✨'}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-pink-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Ide Gaya
                </span>
                {detectedPeople > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/70 flex items-center gap-0.5">
                    <Users className="w-2.5 h-2.5" /> {detectedPeople}P
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-white/95 truncate">
                {currentPose ? currentPose.name : 'Pilih Inspirasi Gaya'}
              </h4>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Ghost Overlay */}
            <button
              type="button"
              onClick={onToggleGhost}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-all ${
                showGhost
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30 ring-1 ring-pink-300'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
              title={showGhost ? 'Sembunyikan Siluet Panduan' : 'Tampilkan Siluet Panduan'}
            >
              {showGhost ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-70" />}
              <span className="hidden sm:inline">{showGhost ? 'Siluet On' : 'Siluet'}</span>
            </button>

            {/* Next / Shuffle Suggestion */}
            <button
              type="button"
              onClick={onNextSuggestion}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="Ganti Rekomendasi Lain"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Pose Picker Drawer / Modal */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" /> Katalog Pose Photobooth
                </h3>
                <p className="text-xs text-white/60">Pilih pose untuk memunculkan siluet di layar kamera</p>
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
                1 Orang (Solo)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 2 ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                2 Orang (Duo)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(3)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 3 ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                3+ Orang (Group)
              </button>
            </div>

            {/* Poses Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {filteredPoses.map((pose) => {
                const isSelected = currentPose?.id === pose.id;
                return (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => {
                      onSelectPose(pose);
                      if (!showGhost) onToggleGhost();
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

