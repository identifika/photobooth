'use client';
import { useState } from 'react';
import FrameSelector from '@/components/FrameSelector';
import Camera from '@/components/Camera';
import PhotoReview from '@/components/PhotoReview';
import BackgroundSelector from '@/components/BackgroundSelector';
import FinalStrip from '@/components/FinalStrip';
import { Frame } from '@/lib/frames';

type Step = 'select' | 'camera' | 'review' | 'background' | 'final';

export default function Home() {
  const [step, setStep] = useState<Step>('select');
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

  const handleFrameSelect = (frame: Frame) => {
    setSelectedFrame(frame);
  };

  const handleStart = () => {
    if (!selectedFrame) return;
    setPhotos([]);
    setStep('camera');
  };

  const handleCapture = (dataUrl: string) => {
    setPendingPhoto(dataUrl);
    setStep('review');
  };

  const handleAccept = (finalPhotoUrl: string) => {
    if (!selectedFrame) return;
    const newPhotos = [...photos, finalPhotoUrl];
    setPendingPhoto(null);
    setPhotos(newPhotos);
    if (newPhotos.length >= selectedFrame.photoCount) {
      setStep('background');
    } else {
      setStep('camera');
    }
  };

  const handleBackgroundComplete = (compositedPhotos: string[]) => {
    setPhotos(compositedPhotos);
    setStep('final');
  };

  const handleRetry = () => {
    setPendingPhoto(null);
    setStep('camera');
  };

  const handleRestart = () => {
    setStep('select');
    setSelectedFrame(null);
    setPhotos([]);
    setPendingPhoto(null);
  };

  const accentColor = selectedFrame?.accentColor || 'var(--gold)';
  const borderColor = selectedFrame?.borderColor || 'var(--ink)';

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="relative border-b" style={{ borderColor: `${borderColor}20` }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <button onClick={handleRestart} className="flex items-center gap-3 group">
            {/* Film reel logo */}
            <div style={{
              width: 36, height: 36,
              background: borderColor,
              borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.3s',
            }} className="group-hover:rotate-12">
              <span style={{ fontSize: 18 }}>📷</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none">Photobooth</h1>
              <p className="text-xs opacity-40 tracking-widest uppercase">Studio</p>
            </div>
          </button>

          {/* Step indicator */}
          <div className="hidden md:flex items-center gap-2">
            {(['select', 'camera', 'review', 'background', 'final'] as Step[]).map((s, i) => {
              const labels = ['Frame', 'Camera', 'Review', 'Background', 'Result'];
              const isActive = step === s;
              const isPast = ['select','camera','review','background','final'].indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: isActive ? borderColor : isPast ? accentColor : 'transparent',
                      border: `2px solid ${isActive || isPast ? borderColor : `${borderColor}30`}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: isActive ? 'white' : isPast ? 'white' : `${borderColor}50`,
                      fontWeight: 600, transition: 'all 0.3s',
                    }}>
                      {isPast ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: isActive ? borderColor : `${borderColor}40`,
                      fontWeight: isActive ? 600 : 400,
                      transition: 'color 0.3s',
                    }}>
                      {labels[i]}
                    </span>
                  </div>
                  {i < 4 && <div style={{ width: 16, height: 1, background: `${borderColor}20` }} />}
                </div>
              );
            })}
          </div>

          {/* Selected frame badge */}
          {selectedFrame && step !== 'select' && (
            <div className="text-xs px-3 py-1.5 rounded-full hidden sm:block" style={{
              background: `${selectedFrame.borderColor}15`,
              border: `1px solid ${selectedFrame.borderColor}30`,
              color: selectedFrame.borderColor,
            }}>
              {selectedFrame.emoji} {selectedFrame.name}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {step === 'select' && (
          <>
            <FrameSelector selected={selectedFrame} onSelect={handleFrameSelect} />
            {selectedFrame && (
              <div className="text-center mt-10 animate-fadeIn">
                <button
                  onClick={handleStart}
                  className="px-12 py-4 font-medium tracking-wide transition-all text-sm rounded-sm"
                  style={{
                    background: selectedFrame.borderColor,
                    color: selectedFrame.color,
                    boxShadow: `0 8px 24px ${selectedFrame.borderColor}30`,
                  }}
                >
                  Begin Session →
                </button>
              </div>
            )}
          </>
        )}

        {step === 'camera' && selectedFrame && (
          <Camera
            frame={selectedFrame}
            photoIndex={photos.length}
            totalPhotos={selectedFrame.photoCount}
            onCapture={handleCapture}
          />
        )}

        {step === 'review' && selectedFrame && pendingPhoto && (
          <PhotoReview
            photoUrl={pendingPhoto}
            photoIndex={photos.length}
            totalPhotos={selectedFrame.photoCount}
            frame={selectedFrame}
            onAccept={handleAccept}
            onRetry={handleRetry}
          />
        )}

        {step === 'background' && selectedFrame && (
          <BackgroundSelector
            photos={photos}
            frame={selectedFrame}
            onComplete={handleBackgroundComplete}
          />
        )}

        {step === 'final' && selectedFrame && (
          <FinalStrip
            photos={photos}
            frame={selectedFrame}
            onRestart={handleRestart}
          />
        )}
      </div>

      {/* Bottom ticker */}
      <div className="fixed bottom-0 left-0 right-0 overflow-hidden py-2 border-t"
        style={{ background: 'var(--ink)', borderColor: 'transparent', zIndex: 10 }}>
        <div className="flex whitespace-nowrap animate-ticker">
          {[...Array(4)].fill('📷 CAPTURE THE MOMENT · 🎞 VINTAGE PHOTOBOOTH · ✨ MAKE MEMORIES · 🎭 STRIKE A POSE · 💫 SAY CHEESE · ').map((t, i) => (
            <span key={i} className="text-xs tracking-widest uppercase mx-8" style={{ color: 'var(--gold)', opacity: 0.7 }}>{t}</span>
          ))}
        </div>
      </div>

      <div className="h-10" /> {/* Ticker spacer */}
    </main>
  );
}
