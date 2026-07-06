'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import FrameSelector from '@/components/FrameSelector';
import Camera from '@/components/Camera';
import PhotoReview from '@/components/PhotoReview';
import BackgroundSelector from '@/components/BackgroundSelector';
import FinalStrip from '@/components/FinalStrip';
import StripPreview from '@/components/StripPreview';
import Header from '@/components/Header';
import { Frame } from '@/lib/frames';
import { type UserFrame } from '@/lib/user-frames';
import { isAdmin } from '@/hooks/useAdmin';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDialog } from '@/components/ui/dialog-provider';
import { useUserFrames, usePendingPublishRequests } from '@/hooks/useFrames';

type Step = 'select' | 'camera' | 'review' | 'background' | 'preview' | 'final';

function userFrameToFrame(f: UserFrame): Frame {
  const photoCount = Math.max(1, f.config.elements?.filter((e) => e.type === 'photo').length || 4);
  return {
    id: `user-${f.id}`,
    name: f.name || 'My Frame',
    description: f.config.description || 'Custom frame',
    photoCount,
    layout: photoCount <= 2 ? 'strip-2' : photoCount === 3 ? 'strip-3' : 'grid-2x2',
    aspectRatio: 4 / 3,
    color: f.config.color || '#f5f0e8',
    borderColor: f.config.borderColor || '#1a1410',
    accentColor: f.config.accentColor || '#c9a84c',
    emoji: f.emoji || '✨',
    config: f.config,
    width: f.config.width,
    height: f.config.height,
  };
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'select', label: 'Frame' },
  { id: 'camera', label: 'Capture' },
  { id: 'review', label: 'Review' },
  { id: 'preview', label: 'Preview' },
  { id: 'background', label: 'BG' },
  { id: 'final', label: 'Result' },
];

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { settings, isLoaded } = useStudioSettings();
  const [step, setStep] = useState<Step>('select');
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [liveClips, setLiveClips] = useState<(string[] | null)[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingFrames, setPendingFrames] = useState<string[] | null>(null);
  const { data: userFrames = [] } = useUserFrames(user?.uid);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [photosBgRemoved, setPhotosBgRemoved] = useState<boolean[]>([]);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const isMobile = useIsMobile();
  const { alert } = useDialog();

  useEffect(() => {
    setIsGuest(sessionStorage.getItem('guest') === 'true');
  }, []);

  // Warn before refreshing if session is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step !== 'select' && step !== 'final') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  const handleFrameSelect = (frame: Frame) => {
    setSelectedFrame(frame);
  };

  const handleStart = () => {
    if (!selectedFrame) return;
    setPhotos([]);
    setLiveClips([]);
    setStep('camera');
  };

  const handleCapture = (dataUrl: string, liveFrames: string[] | null) => {
    setPendingPhoto(dataUrl);
    setPendingFrames(liveFrames);
    setStep('review');
  };

  const handleAccept = (finalPhotoUrl: string, bgRemoved: boolean = false) => {
    if (!selectedFrame) return;

    if (retakeIndex !== null) {
      // Replace the photo at the specific index
      const newPhotos = [...photos];
      newPhotos[retakeIndex] = finalPhotoUrl;
      const newClips = [...liveClips];
      newClips[retakeIndex] = pendingFrames;
      const newBgRemoved = [...photosBgRemoved];
      newBgRemoved[retakeIndex] = bgRemoved;
      setPhotos(newPhotos);
      setLiveClips(newClips);
      setPhotosBgRemoved(newBgRemoved);
      setRetakeIndex(null);
      setPendingPhoto(null);
      setPendingFrames(null);
      setStep('preview');
    } else {
      // Normal flow - append new photo
      const newPhotos = [...photos, finalPhotoUrl];
      const newClips = [...liveClips, pendingFrames];
      const newBgRemoved = [...photosBgRemoved, bgRemoved];
      setPendingPhoto(null);
      setPendingFrames(null);
      setPhotos(newPhotos);
      setLiveClips(newClips);
      setPhotosBgRemoved(newBgRemoved);
      if (newPhotos.length >= selectedFrame.photoCount) {
        setStep('preview');
      } else {
        setStep('camera');
      }
    }
  };

  const handleBackgroundComplete = (compositedPhotos: string[]) => {
    setPhotos(compositedPhotos);
    setStep('final');
  };

  const handleRetry = () => {
    setPendingPhoto(null);
    setPendingFrames(null);
    setStep('camera');
  };

  const handleRetakePhoto = (index: number) => {
    // Mark which index we're retaking, keep photos in place
    setRetakeIndex(index);
    setPendingPhoto(null);
    setPendingFrames(null);
    setStep('camera');
  };

  const handleConfirmPreview = () => {
    setStep('background');
  };

  const handleRestart = () => {
    setStep('select');
    setSelectedFrame(null);
    setPhotos([]);
    setLiveClips([]);
    setPhotosBgRemoved([]);
    setPendingPhoto(null);
    setPendingFrames(null);
    setRetakeIndex(null);
  };

  const studioName = settings?.studioName || 'Photobooth';
  const studioLogo = settings?.studioLogo || '📷';
  const tagline = settings?.tagline || 'Capture the moment';

  useEffect(() => {
    if (isLoaded) {
      document.title = `${studioName} — ${tagline}`;
    }
  }, [studioName, tagline, isLoaded]);

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  useEffect(() => {
    if (!loading && isLoaded && isGuest !== null && !user && !isGuest) {
      router.replace('/login');
    }
  }, [loading, isLoaded, isGuest, user, router]);

  if (loading || !isLoaded || isGuest === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </main>
    );
  }

  if (!user && !isGuest) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redirecting...</p>
      </main>
    );
  }

  return (
    <>
      <Header
        steps={STEPS}
        currentStepIndex={STEPS.findIndex(s => s.id === step)}
        onRestart={handleRestart}
      />

      {/* Main content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px 80px' : '32px 24px 80px' }}>

        {/* Frame badge */}
        {selectedFrame && step !== 'select' && (
          <div className="frame-badge visible">
            <div className="frame-badge-dot" />
            <span>{selectedFrame.emoji} {selectedFrame.name}</span>
          </div>
        )}

        {/* Step: Select */}
        {step === 'select' && (
          <>
            <FrameSelector
              selected={selectedFrame}
              onSelect={handleFrameSelect}
              userFrames={userFrames.map(userFrameToFrame)}
            />
            {selectedFrame && (
              <div className={`fixed z-50 animate-fadeIn ${isMobile ? 'bottom-6 left-4 right-4' : ''}`} style={isMobile ? {} : { bottom: '48px', right: '24px' }}>
                <button
                  className={`begin-btn ${isMobile ? 'w-full justify-center' : ''}`}
                  onClick={handleStart}
                  style={{ boxShadow: 'var(--shadow-md)', ...(isMobile ? { display: 'flex', width: '100%', padding: '0 16px' } : {}) }}
                >
                  Begin session
                  <span className="arrow">→</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Step: Camera */}
        {step === 'camera' && selectedFrame && (
          <Camera
            frame={selectedFrame}
            photoIndex={photos.length}
            totalPhotos={selectedFrame.photoCount}
            onCapture={handleCapture}
            isRetake={retakeIndex !== null}
            retakeIndex={retakeIndex ?? undefined}
          />
        )}

        {/* Step: Review */}
        {step === 'review' && selectedFrame && pendingPhoto && (
          <PhotoReview
            photoUrl={pendingPhoto}
            photoIndex={photos.length}
            totalPhotos={selectedFrame.photoCount}
            frame={selectedFrame}
            onAccept={handleAccept}
            onRetry={handleRetry}
            autoRemoveBg={retakeIndex !== null && photosBgRemoved[retakeIndex] === true}
          />
        )}

        {/* Step: Background */}
        {step === 'background' && selectedFrame && (
          <BackgroundSelector
            photos={photos}
            frame={selectedFrame}
            onComplete={handleBackgroundComplete}
          />
        )}

        {/* Step: Preview */}
        {step === 'preview' && selectedFrame && (
          <StripPreview
            photos={photos}
            liveClips={liveClips}
            frame={selectedFrame}
            onRetakePhoto={handleRetakePhoto}
            onConfirm={handleConfirmPreview}
          />
        )}

        {/* Step: Final */}
        {step === 'final' && selectedFrame && (
          <FinalStrip
            photos={photos}
            liveClips={liveClips}
            frame={selectedFrame}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Ticker */}
      <div className="ticker" role="marquee">
        <div className="ticker-track">
          <span className="ticker-text">
            {'🎞 PHOTOBOOTH STUDIO · 📷 CAPTURE THE MOMENT · ✨ MAKE MEMORIES · 🎭 STRIKE A POSE · 💫 SAY CHEESE · '.repeat(6)}
          </span>
        </div>
      </div>
    </>
  );
}