'use client';
import { useState, useRef } from 'react';
import { PoseReference } from '@/lib/pose/types';
import { DEFAULT_POSES } from '@/lib/pose/defaultPoses';
import { loadCustomPoses, deleteCustomPose, extractPoseFromImageFile } from '@/lib/pose/customPoses';
import PoseSilhouette from '@/components/PoseSilhouette';
import { Sparkles, Users, Eye, EyeOff, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface PoseSideGuideProps {
  detectedPeople: number;
  currentPose: PoseReference | null;
  onSelectPose: (pose: PoseReference) => void;
  showShadowOnCamera: boolean;
  onToggleShadow: () => void;
  shadowOpacity?: number;
  onShadowOpacityChange?: (opacity: number) => void;
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
  shadowOpacity = 0.3,
  onShadowOpacityChange,
  isMatched = false,
  countdownActive = false,
  isCapturing = false,
}: PoseSideGuideProps) {
  const [customPoses, setCustomPoses] = useState<PoseReference[]>(() => loadCustomPoses());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If 3 or more people detected, do NOT show any suggestions!
  if (detectedPeople >= 3) {
    return null;
  }

  // Filter poses: strictly 1 person if detected 1, 2 people if detected 2
  const targetPeople = detectedPeople === 2 ? 2 : 1;
  const presets = DEFAULT_POSES.filter((p) => p.people === targetPeople);
  const userCustoms = customPoses.filter((p) => p.people === targetPeople);
  const allPoses = [...userCustoms, ...presets];

  // During active shooting, gently fade so viewfinder is the star
  const isMuted = countdownActive || isCapturing;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newPose = await extractPoseFromImageFile(file);
      setCustomPoses((prev) => [newPose, ...prev.filter((p) => p.id !== newPose.id)]);
      onSelectPose(newPose);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses foto pose.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomPose(id);
    setCustomPoses((prev) => prev.filter((p) => p.id !== id));
    if (currentPose?.id === id) {
      onSelectPose(presets[0]);
    }
  };

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

        {/* Upload Pose Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-white/25 hover:border-pink-400/60 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all group disabled:opacity-50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                <span>Menganalisis Pose...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                <span>+ Upload Pose Kamu</span>
              </>
            )}
          </button>

          {/* Upload Error feedback */}
          {uploadError && (
            <div className="mt-2 p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-[11px] text-red-200 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Pose Cards List (Vertical on desktop, horizontal scroll on mobile) */}
        <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 scrollbar-none max-h-[380px] lg:overflow-y-auto">
          {allPoses.map((pose) => {
            const isSelected = currentPose?.id === pose.id;

            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => onSelectPose(pose)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all shrink-0 w-48 lg:w-full relative group cursor-pointer ${
                  isSelected
                    ? isMatched
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-md ring-1 ring-emerald-400/40'
                      : 'bg-pink-500/15 border-pink-400/80 shadow-md ring-1 ring-pink-400/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {/* Silhouette or Photo Thumbnail */}
                <div
                  className={`w-12 h-14 rounded-lg flex items-center justify-center p-0.5 shrink-0 overflow-hidden relative ${
                    isSelected
                      ? isMatched
                        ? 'bg-emerald-950/60 border border-emerald-400/50'
                        : 'bg-pink-950/50 border border-pink-400/50'
                      : 'bg-black/40 border border-white/10'
                  }`}
                >
                  {pose.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pose.thumb}
                      alt={pose.name}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <PoseSilhouette
                      skeleton={pose.skeleton}
                      fillColor={isSelected ? (isMatched ? '#34d399' : '#f472b6') : '#ffffff'}
                      opacity={isSelected ? 0.95 : 0.6}
                    />
                  )}
                </div>

                {/* Pose Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm shrink-0">{pose.emoji || '✨'}</span>
                    <h4 className="font-semibold text-xs text-white truncate">{pose.name}</h4>
                  </div>
                  <p className="text-[10px] text-white/55 line-clamp-2 leading-tight">
                    {pose.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {pose.isCustom && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-300 font-medium">
                        Custom
                      </span>
                    )}
                    {isSelected && (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider ${
                          isMatched ? 'text-emerald-300' : 'text-pink-400'
                        }`}
                      >
                        {isMatched ? '✨ Pas!' : 'Dipilih'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button for custom pose */}
                {pose.isCustom && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDeletePose(pose.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleDeletePose(pose.id, e as unknown as React.MouseEvent);
                      }
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Hapus pose ini"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Toggle & Thickness Slider for Camera Shadow */}
        <div className="pt-2.5 border-t border-white/10 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/70 font-medium">Bayangan di Kamera</span>
            <button
              type="button"
              onClick={onToggleShadow}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
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

          {/* Slider Ketebalan / Opacity Bayangan */}
          {showShadowOnCamera && onShadowOpacityChange && (
            <div className="flex items-center gap-2 pt-1 animate-fadeIn">
              <span className="text-[10px] text-white/50 shrink-0">Ketebalan:</span>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={Math.round(shadowOpacity * 100)}
                onChange={(e) => onShadowOpacityChange(Number(e.target.value) / 100)}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                title={`Ketebalan bayangan: ${Math.round(shadowOpacity * 100)}%`}
              />
              <span className="text-[10px] font-mono text-white/80 w-8 text-right shrink-0">
                {Math.round(shadowOpacity * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
