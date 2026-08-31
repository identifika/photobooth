'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import FrameSelector from '@/components/FrameSelector';
import Camera from '@/components/Camera';
import PhotoReview from '@/components/PhotoReview';
import BackgroundSelector from '@/components/BackgroundSelector';
import FinalStrip from '@/components/FinalStrip';
import StripPreview from '@/components/StripPreview';
import Header from '@/components/Header';
import { Frame, FRAMES, loadPublicFrames } from '@/lib/frames';
import { listUserFrames, loadUserFrame, loadUserFrameById, type UserFrame } from '@/lib/user-frames';
import { getEventBySlug, type BoothEvent } from '@/lib/events';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDialog } from '@/components/ui/dialog-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Lock,
  Calendar,
  MapPin,
  Eye,
  Camera as CameraIcon,
  Play,
  Share2,
} from 'lucide-react';
import Link from 'next/link';

type Step = 'select' | 'camera' | 'review' | 'preview' | 'background' | 'final';

function userFrameToFrame(f: UserFrame): Frame {
  const photoCount = Math.max(1, f.config.elements?.filter((e) => e.type === 'photo').length || 4);
  return {
    id: `user-${f.id}`,
    name: f.name || 'Event Frame',
    description: f.config.description || 'Custom event frame',
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

export default function EventBoothPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const router = useRouter();
  const isMobile = useIsMobile();
  const { alert } = useDialog();

  const [event, setEvent] = useState<BoothEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Booth State
  const [step, setStep] = useState<Step>('select');
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [eventFrames, setEventFrames] = useState<Frame[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [liveClips, setLiveClips] = useState<(string[] | null)[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingFrames, setPendingFrames] = useState<string[] | null>(null);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [photosBgRemoved, setPhotosBgRemoved] = useState<boolean[]>([]);
  const [sessionId, setSessionId] = useState<string>('');

  // 1. Fetch Event and Associated Frames
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingEvent(true);
      try {
        const evt = await getEventBySlug(slug);
        if (!active) return;
        if (!evt) {
          setEvent(null);
          setLoadingEvent(false);
          return;
        }

        setEvent(evt);
        if (!evt.requirePasscode) {
          setPasscodeUnlocked(true);
        }

        // Load frames for this event
        const loadedFrames: Frame[] = [];

        // Load configured event frames
        if (evt.frameIds && evt.frameIds.length > 0) {
          const publicFramesList = await loadPublicFrames().catch(() => []);

          for (const fId of evt.frameIds) {
            const rawId = fId.startsWith('user-') ? fId.replace('user-', '') : fId;
            // 1. Try loading custom user frame directly by ID
            const foundUser = await loadUserFrameById(rawId).catch(() => null);
            if (foundUser) {
              loadedFrames.push(userFrameToFrame(foundUser));
              continue;
            }

            // 2. Try loading public / preset frame
            const foundPub = publicFramesList.find((pf) => pf.id === fId || pf.id === rawId);
            if (foundPub) {
              loadedFrames.push(foundPub);
            } else {
              const foundStatic = FRAMES.find((sf) => sf.id === fId || sf.id === rawId);
              if (foundStatic) loadedFrames.push(foundStatic);
            }
          }
        }

        // If no frames specifically chosen, default to available frames
        if (loadedFrames.length === 0) {
          const pub = await loadPublicFrames().catch(() => FRAMES);
          loadedFrames.push(...pub);
        }

        setEventFrames(loadedFrames);

        // Match primary frame by ID with or without user- prefix
        const primary = loadedFrames.find(
          (f) => f.id === evt.primaryFrameId ||
                 f.id === `user-${evt.primaryFrameId}` ||
                 f.id.replace('user-', '') === evt.primaryFrameId?.replace('user-', '')
        ) || loadedFrames[0];

        if (primary) {
          setSelectedFrame(primary);
        }
      } catch (err) {
        console.error('Error loading event:', err);
      } finally {
        if (active) setLoadingEvent(false);
      }
    }

    load();
    return () => { active = false; };
  }, [slug]);

  // Generate unique session ID on mount
  useEffect(() => {
    setSessionId(`evt-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`);
  }, [slug]);

  // Handle Passcode Unlock
  const handleUnlockPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (event?.requirePasscode && passcodeAttempt.trim() === event.requirePasscode.trim()) {
      setPasscodeUnlocked(true);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
    }
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
    setRetakeIndex(index);
    setPendingPhoto(null);
    setPendingFrames(null);
    setStep('camera');
  };

  const handleRestart = () => {
    setSessionId(`evt-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`);
    if (event?.allowFrameSelection) {
      setStep('select');
    } else {
      setStep('select');
    }
    setPhotos([]);
    setLiveClips([]);
    setPhotosBgRemoved([]);
    setPendingPhoto(null);
    setPendingFrames(null);
    setRetakeIndex(null);
  };

  if (loadingEvent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Joining event photobooth...</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h1 className="text-xl font-bold">Event Not Found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The event URL <code>/e/{slug}</code> does not exist or has been removed.
        </p>
        <Link href="/" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold">
          Back to Home
        </Link>
      </main>
    );
  }

  // Passcode Gate
  if (!passcodeUnlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-[var(--surface-2)] p-8 rounded-3xl border border-border shadow-xl text-center space-y-6 animate-fadeIn">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-xl"
            style={{ background: `${event.themeColor || 'var(--brand)'}20`, color: event.themeColor || 'var(--brand)' }}
          >
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{event.name}</h1>
            <p className="text-xs text-muted-foreground">This event photobooth requires a guest access PIN.</p>
          </div>

          <form onSubmit={handleUnlockPasscode} className="space-y-4">
            <Input
              type="password"
              autoFocus
              value={passcodeAttempt}
              onChange={(e) => setPasscodeAttempt(e.target.value)}
              placeholder="Enter PIN"
              className={`text-center font-mono text-lg tracking-widest bg-background ${
                passcodeError ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            />
            {passcodeError && (
              <p className="text-xs text-destructive font-medium">Incorrect PIN. Please check with your host.</p>
            )}
            <Button
              type="submit"
              className="w-full rounded-full"
              style={{ background: event.themeColor || undefined }}
            >
              Enter Photobooth
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Event Header */}
      <header
        className="sticky top-0 z-30 border-b border-border bg-[var(--surface-2)]/90 backdrop-blur-md"
        style={{ borderTop: `3px solid ${event.themeColor || 'var(--brand)'}` }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm"
              style={{ background: event.themeColor || 'var(--brand)', color: '#fff' }}
            >
              📷
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-foreground truncate leading-tight">
                {event.name}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {event.eventDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {event.eventDate}
                  </span>
                )}
                {event.hashtag && <span className="font-mono text-primary">{event.hashtag}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {event.enableLiveGallery && (
              <Link
                href={`/e/${event.slug}/gallery`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live Wall</span>
              </Link>
            )}
            <button
              onClick={handleRestart}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Restart
            </button>
          </div>
        </div>
      </header>

      {/* Main Experience Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20">
        {/* Step: Select Frame */}
        {step === 'select' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: `${event.themeColor || 'var(--brand)'}15`, color: event.themeColor || 'var(--brand)' }}
              >
                Welcome Guests
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold">
                {event.tagline || 'Ready for your photo session?'}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                {event.allowFrameSelection
                  ? 'Choose an event frame below to start taking photos.'
                  : 'Your custom event frame is ready. Tap start to capture!'}
              </p>
            </div>

            {/* If frame selection is enabled */}
            {event.allowFrameSelection ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {eventFrames.map((frame) => {
                    const isSelected = selectedFrame?.id === frame.id;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => setSelectedFrame(frame)}
                        className={`group p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                          isSelected
                            ? 'border-primary bg-primary/10 scale-105 shadow-md'
                            : 'border-border bg-[var(--surface-2)] hover:border-primary/50'
                        }`}
                      >
                        <span className="text-3xl group-hover:scale-110 transition-transform">{frame.emoji}</span>
                        <div className="text-xs font-bold text-foreground truncate w-full">{frame.name}</div>
                        <div className="text-[10px] text-muted-foreground">{frame.photoCount} photos</div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-center pt-4">
                  <Button
                    size="lg"
                    onClick={handleStart}
                    disabled={!selectedFrame}
                    className="px-8 py-3 rounded-full text-sm font-semibold shadow-lg hover:shadow-xl gap-2 transition-all"
                    style={{ background: event.themeColor || undefined }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Session ({selectedFrame?.photoCount || 4} Photos)
                  </Button>
                </div>
              </div>
            ) : (
              /* Locked single frame banner */
              <div className="max-w-md mx-auto bg-[var(--surface-2)] p-6 rounded-3xl border border-border text-center space-y-6 shadow-sm">
                <div className="text-4xl">{selectedFrame?.emoji || '✨'}</div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{selectedFrame?.name || event.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedFrame?.photoCount || 4} synchronized photo captures</p>
                </div>
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="w-full rounded-full gap-2 shadow-lg"
                  style={{ background: event.themeColor || undefined }}
                >
                  <CameraIcon className="w-4 h-4" />
                  Tap to Start Taking Photos
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Camera Capture */}
        {step === 'camera' && selectedFrame && (
          <div className="space-y-4">
            <Camera
              frame={selectedFrame}
              photoIndex={retakeIndex !== null ? retakeIndex : photos.length}
              totalPhotos={selectedFrame.photoCount}
              onCapture={handleCapture}
              isRetake={retakeIndex !== null}
              retakeIndex={retakeIndex !== null ? retakeIndex : undefined}
            />
          </div>
        )}

        {/* Step: Photo Review */}
        {step === 'review' && pendingPhoto && selectedFrame && (
          <PhotoReview
            photoUrl={pendingPhoto}
            photoIndex={retakeIndex !== null ? retakeIndex : photos.length}
            totalPhotos={selectedFrame.photoCount}
            frame={selectedFrame}
            onAccept={handleAccept}
            onRetry={handleRetry}
          />
        )}

        {/* Step: Strip Preview & Retake */}
        {step === 'preview' && selectedFrame && (
          <StripPreview
            photos={photos}
            liveClips={liveClips}
            frame={selectedFrame}
            eventContext={event ? {
              eventName: event.name,
              eventDate: event.eventDate,
              brideName: event.brideName,
              groomName: event.groomName,
              venue: event.venue,
              hashtag: event.hashtag,
              tagline: event.tagline,
              customMessage: event.customMessage,
            } : undefined}
            onRetakePhoto={handleRetakePhoto}
            onConfirm={() => setStep('background')}
          />
        )}

        {/* Step: Background / Filter Selection */}
        {step === 'background' && selectedFrame && (
          <BackgroundSelector
            photos={photos}
            frame={selectedFrame}
            onComplete={handleBackgroundComplete}
          />
        )}

        {/* Step: Final Result & Dynamic QR Strip */}
        {step === 'final' && selectedFrame && (
          <div className="space-y-6">
            <FinalStrip
              photos={photos}
              liveClips={liveClips}
              frame={selectedFrame}
              sessionId={sessionId}
              eventSlug={event.slug}
              eventContext={event ? {
                eventName: event.name,
                eventDate: event.eventDate,
                brideName: event.brideName,
                groomName: event.groomName,
                venue: event.venue,
                hashtag: event.hashtag,
                tagline: event.tagline,
                customMessage: event.customMessage,
              } : undefined}
              onRestart={handleRestart}
            />

            {event.enableLiveGallery && (
              <div className="text-center pt-4">
                <Link
                  href={`/e/${event.slug}/gallery`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-muted text-foreground rounded-full text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  <Eye className="w-4 h-4" />
                  View All Event Photos on Live Wall →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
