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
import { Frame } from '@/lib/frames';
import { listUserFrames, deleteUserFrame, type UserFrame } from '@/lib/user-frames';
import { isAdmin } from '@/hooks/useAdmin';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { useStudioSettings } from '@/hooks/useStudioSettings';

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
  const [userFrames, setUserFrames] = useState<UserFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [photosBgRemoved, setPhotosBgRemoved] = useState<boolean[]>([]);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    setIsGuest(sessionStorage.getItem('guest') === 'true');
  }, []);

  useEffect(() => {
    if (!user) { setUserFrames([]); return; }
    setFramesLoading(true);
    listUserFrames(user.uid)
      .then(setUserFrames)
      .catch(console.error)
      .finally(() => setFramesLoading(false));
  }, [user]);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showUserMenu]);

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

  if (loading || !isLoaded || isGuest === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </main>
    );
  }

  if (!user && !isGuest) {
    router.replace('/login');
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redirecting...</p>
      </main>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>

          {/* Logo */}
          <button onClick={handleRestart} className="flex items-center gap-3 group" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <div className="flex items-center justify-center group-hover:rotate-12 transition-transform"
              style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand)', fontSize: 18 }}>
              {studioLogo}
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.3px', margin: 0 }}>{studioName}</h1>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>{tagline}</div>
            </div>
          </button>

          {/* Film strip step indicator */}
          <nav className="hidden md:flex items-center" aria-label="Session steps">
            {STEPS.map((s, i) => {
              const isActive = i === currentStepIndex;
              const isPast = i < currentStepIndex;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`film-cell ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}>
                    <div className="film-frame"><span>{String(i + 1).padStart(2, '0')}</span></div>
                    <div className="film-label">{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className="film-connector" />}
                </div>
              );
            })}
          </nav>

          {/* Header actions */}
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <ThemeToggle />
            {user && isAdmin(user.email) && (
              <>
                <button className="btn ghost" onClick={() => router.push('/frames')}>Frames</button>
                <button className="btn ghost" onClick={() => router.push('/settings')} aria-label="Settings">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </>
            )}
            {!isGuest && (
              <button className="btn primary" onClick={() => router.push('/editor')}>
                <span style={{ fontSize: 14 }}>+</span>
                <span className="hidden sm:inline">New frame</span>
              </button>
            )}
            {/* User dropdown */}
            <div className="relative" data-user-menu>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg-accent)', border: '0.5px solid var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-accent)',
                  flexShrink: 0,
                }}
              >
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'G'}
              </button>
              {showUserMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: 36, width: 220,
                  background: 'var(--surface-2)', border: '0.5px solid var(--border)',
                  borderRadius: 10, padding: '8px 0', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  zIndex: 50,
                }}>
                  <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{user?.displayName || 'Guest'}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user?.email || 'Not logged in'}</p>
                  </div>
                  {!isGuest && (
                    <>
                      <button
                        onClick={() => { setShowUserMenu(false); router.push('/frames'); }}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        className="hover:bg-[var(--surface-1)]"
                      >
                        My Frames
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); router.push('/settings'); }}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        className="hover:bg-[var(--surface-1)]"
                      >
                        Settings
                      </button>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    </>
                  )}
                  <button
                    onClick={() => { 
                      setShowUserMenu(false); 
                      if (isGuest) {
                        sessionStorage.removeItem('guest');
                        setIsGuest(false);
                        router.push('/login');
                      } else {
                        signOut(); 
                      }
                    }}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    className="hover:bg-[var(--surface-1)]"
                  >
                    {isGuest ? 'Sign in' : 'Sign out'}
                  </button>
                  <div style={{ padding: '8px 14px 4px 14px', borderTop: '0.5px solid var(--border)' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

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
              <div className="fixed z-50 animate-fadeIn" style={{ bottom: '48px', right: '24px' }}>
                <button className="begin-btn" onClick={handleStart} style={{ boxShadow: 'var(--shadow-md)' }}>
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
            {'📷 CAPTURE THE MOMENT · 🎞 PHOTOBOOTH STUDIO · ✨ MAKE MEMORIES · 🎭 STRIKE A POSE · 💫 SAY CHEESE · '.repeat(6)}
          </span>
        </div>
      </div>
    </>
  );
}