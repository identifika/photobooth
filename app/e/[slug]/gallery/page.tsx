'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { getEventBySlug, subscribeToEventCaptures, getEventCaptures, type BoothEvent, type EventCapture } from '@/lib/events';
import { getClientAuthToken } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog-provider';
import JSZip from 'jszip';
import {
  Image as ImageIcon,
  Download,
  Play,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowLeft,
  Share2,
  Loader2,
  ExternalLink,
  Camera,
  RefreshCw,
  X,
  Copy,
  Check,
  Layers,
  Film,
} from 'lucide-react';
import Link from 'next/link';
import { getApiUrl, getPublicAppUrl } from '@/lib/api-config';

interface MediaItem {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
}

export interface GallerySession {
  sessionId: string;
  coverUrl: string;
  stripUrl?: string;
  gifUrl?: string;
  photos: string[];
  liveClips: string[];
  createdAt?: Date | string;
  itemCount: number;
}

export default function EventLiveGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const router = useRouter();
  const { alert } = useDialog();

  const [event, setEvent] = useState<BoothEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [sessions, setSessions] = useState<GallerySession[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingSessionZip, setDownloadingSessionZip] = useState(false);

  // Selected session for detailed modal
  const [selectedSession, setSelectedSession] = useState<GallerySession | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'strip' | 'gif'>('strip');
  const [copiedLink, setCopiedLink] = useState(false);

  // Slideshow / Projector mode
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slideshowContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Event
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingEvent(true);
      try {
        const evt = await getEventBySlug(slug);
        if (active) setEvent(evt);
      } catch (err) {
        console.error('Failed to load event:', err);
      } finally {
        if (active) setLoadingEvent(false);
      }
    }
    load();
    return () => { active = false; };
  }, [slug]);

  // Convert Firestore captures to GallerySessions
  const capturesToSessions = (captures: EventCapture[]): GallerySession[] => {
    return captures.map((c) => {
      const photos = c.photoUrls || [];
      const liveClips = c.liveClipUrls || [];
      const coverUrl = c.stripUrl || c.gifUrl || photos[0] || '';

      let count = 0;
      if (c.stripUrl) count++;
      if (c.gifUrl) count++;
      count += photos.length + liveClips.length;

      let createdAt: Date | string | undefined = undefined;
      if (c.createdAt) {
        if (typeof (c.createdAt as any)?.toDate === 'function') {
          createdAt = (c.createdAt as any).toDate();
        } else if (typeof c.createdAt === 'string') {
          createdAt = new Date(c.createdAt);
        }
      }

      return {
        sessionId: c.sessionId,
        coverUrl,
        stripUrl: c.stripUrl,
        gifUrl: c.gifUrl,
        photos,
        liveClips,
        createdAt,
        itemCount: count,
      };
    });
  };

  // Convert S3 flat media items to GallerySessions (fallback)
  const mediaItemsToSessions = (items: MediaItem[]): GallerySession[] => {
    const sessionMap = new Map<string, {
      sessionId: string;
      stripUrl?: string;
      gifUrl?: string;
      photos: string[];
      liveClips: string[];
      lastModified?: string;
    }>();

    for (const item of items) {
      const parts = item.key.split('/');
      const sessionId = parts.length >= 3 ? `${parts[0]}/${parts[1]}` : (parts.length > 1 ? parts[0] : 'session');
      const filename = parts[parts.length - 1];

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          photos: [],
          liveClips: [],
          lastModified: item.lastModified,
        });
      }

      const sess = sessionMap.get(sessionId)!;
      if (filename.includes('strip.png')) {
        sess.stripUrl = item.url;
      } else if (filename.includes('strip.gif')) {
        sess.gifUrl = item.url;
      } else if (filename.includes('live_')) {
        sess.liveClips.push(item.url);
      } else {
        sess.photos.push(item.url);
      }
    }

    const result: GallerySession[] = [];
    for (const s of sessionMap.values()) {
      const coverUrl = s.stripUrl || s.gifUrl || s.photos[0] || '';
      let count = 0;
      if (s.stripUrl) count++;
      if (s.gifUrl) count++;
      count += s.photos.length + s.liveClips.length;

      result.push({
        sessionId: s.sessionId,
        coverUrl,
        stripUrl: s.stripUrl,
        gifUrl: s.gifUrl,
        photos: s.photos,
        liveClips: s.liveClips,
        createdAt: s.lastModified ? new Date(s.lastModified) : undefined,
        itemCount: count,
      });
    }

    return result;
  };

  // 2. Fetch Media items (Firestore subcollection with S3 fallback)
  const fetchMedia = async () => {
    if (!event) return;
    setLoadingItems(true);
    try {
      // 1. Try Firestore subcollection first
      const captures = await getEventCaptures(event.id);
      if (captures.length > 0) {
        setSessions(capturesToSessions(captures));
        return;
      }

      // 2. Fallback to S3
      const token = await getClientAuthToken();
      const res = await fetch(getApiUrl('/api/share'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId: slug }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setSessions(mediaItemsToSessions(data.items));
        }
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Failed to fetch event media:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  // Realtime subscription to Firestore captures
  useEffect(() => {
    if (!event) return;
    setLoadingItems(true);

    let isSubscribed = true;

    const unsubscribe = subscribeToEventCaptures(
      event.id,
      async (captures) => {
        if (!isSubscribed) return;
        if (captures.length > 0) {
          setSessions(capturesToSessions(captures));
          setLoadingItems(false);
        } else {
          // If Firestore has no items yet, check S3 fallback
          try {
            const token = await getClientAuthToken();
            const res = await fetch(getApiUrl('/api/share'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ sessionId: slug }),
            });
            if (res.ok) {
              const data = await res.json();
              if (isSubscribed && data.items) {
                setSessions(mediaItemsToSessions(data.items));
              }
            }
          } catch (err) {
            console.warn('S3 fallback check failed:', err);
          } finally {
            if (isSubscribed) setLoadingItems(false);
          }
        }
      },
      () => {
        if (isSubscribed) fetchMedia();
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [event, slug]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSession(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Slideshow auto-advance
  useEffect(() => {
    if (!isSlideshow || sessions.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlideIdx((prev) => (prev + 1) % sessions.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isSlideshow, sessions.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  // Download All photos across all sessions into a single event ZIP
  const handleDownloadAllZip = async () => {
    if (sessions.length === 0) {
      await alert('No photos have been taken for this event yet.');
      return;
    }

    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const allUrls: { url: string; filename: string }[] = [];

      sessions.forEach((s) => {
        if (s.stripUrl) allUrls.push({ url: s.stripUrl, filename: `${s.sessionId}_strip.png` });
        if (s.gifUrl) allUrls.push({ url: s.gifUrl, filename: `${s.sessionId}_strip.gif` });
        s.photos.forEach((u, i) => allUrls.push({ url: u, filename: `${s.sessionId}_photo_${i + 1}.png` }));
        s.liveClips.forEach((u, i) => allUrls.push({ url: u, filename: `${s.sessionId}_live_${i + 1}.gif` }));
      });

      const fetchPromises = allUrls.map(async (item) => {
        const response = await fetch(item.url);
        if (!response.ok) return;
        const blob = await response.blob();
        zip.file(item.filename, blob);
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${event?.slug || 'event'}-gallery.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download zip:', err);
      alert('Failed to download photos ZIP.');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Download All media for ONE specific session
  const handleDownloadSessionZip = async (session: GallerySession) => {
    setDownloadingSessionZip(true);
    try {
      const zip = new JSZip();
      const allUrls: { url: string; filename: string }[] = [];

      if (session.stripUrl) allUrls.push({ url: session.stripUrl, filename: 'strip.png' });
      if (session.gifUrl) allUrls.push({ url: session.gifUrl, filename: 'strip.gif' });
      session.photos.forEach((u, i) => allUrls.push({ url: u, filename: `photo_${i + 1}.png` }));
      session.liveClips.forEach((u, i) => allUrls.push({ url: u, filename: `live_${i + 1}.gif` }));

      const fetchPromises = allUrls.map(async (item) => {
        const response = await fetch(item.url);
        if (!response.ok) return;
        const blob = await response.blob();
        zip.file(item.filename, blob);
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      const safeSessionId = session.sessionId.replace(/[\/\\]/g, '-');
      link.download = `photobooth-${safeSessionId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download session zip:', err);
      alert('Failed to download session ZIP.');
    } finally {
      setDownloadingSessionZip(false);
    }
  };

  const downloadSingleFile = (url: string, filename: string) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(console.error);
  };

  const handleCopyShareLink = (sessionId: string) => {
    const origin = getPublicAppUrl();
    const url = `${origin}/share?s=${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(console.error);
  };

  if (loadingEvent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Live Photo Wall...</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <h1 className="text-xl font-bold">Event Not Found</h1>
        <Link href="/" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold">
          Back to Home
        </Link>
      </main>
    );
  }

  const slideshowSessions = sessions.filter((s) => s.coverUrl);

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Header />

      {/* Fullscreen Slideshow / Projector Overlay */}
      {isSlideshow && slideshowSessions.length > 0 && (
        <div
          ref={slideshowContainerRef}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden"
        >
          {/* Top Slideshow HUD */}
          <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">{event.name}</h2>
                <p className="text-white/60 text-xs">{event.hashtag || 'Live Event Photo Wall'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSlideshow(false)}
                className="text-white hover:bg-white/20 rounded-full text-xs"
              >
                Exit Slideshow
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 rounded-full"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Current Slide Display */}
          <div className="relative max-h-[82vh] max-w-[90vw] mx-auto flex items-center justify-center animate-fadeIn">
            <img
              src={slideshowSessions[currentSlideIdx].coverUrl}
              alt="Slideshow capture"
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
              crossOrigin="anonymous"
            />
          </div>

          {/* Bottom Progress Tracker */}
          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2 z-10">
            <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-mono">
              Session {currentSlideIdx + 1} / {slideshowSessions.length} · Auto-Advancing
            </div>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
        {/* Top Breadcrumb & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href={`/e/${event.slug}`}
            className="hover:text-foreground flex items-center gap-1 text-sm text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Booth
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {sessions.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsSlideshow(true)}
                  className="gap-1.5 rounded-full text-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-primary" />
                  Projector Slideshow
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  onClick={handleDownloadAllZip}
                  disabled={downloadingZip}
                  className="gap-1.5 rounded-full text-xs shadow-md"
                >
                  {downloadingZip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {downloadingZip ? 'Zipping...' : 'Download All (ZIP)'}
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={fetchMedia}
              className="p-2 rounded-full"
              title="Refresh Gallery"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Hero Event Banner */}
        <div className="bg-[var(--surface-2)] p-6 sm:p-8 rounded-3xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: `${event.themeColor || 'var(--brand)'}20`, color: event.themeColor || 'var(--brand)' }}
              >
                Live Event Guestbook
              </span>
              {event.hashtag && <span className="text-xs font-mono font-bold text-primary">{event.hashtag}</span>}
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-bold">{event.name}</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {event.tagline || 'Real-time photo stream capturing all the memories from this event.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <Link
              href={`/e/${event.slug}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-primary-foreground shadow-lg hover:shadow-xl transition-all"
              style={{ background: event.themeColor || 'var(--brand)' }}
            >
              <Camera className="w-4 h-4" />
              Take a Photo
            </Link>
          </div>
        </div>

        {/* Sessions Summary Bar */}
        {sessions.length > 0 && (
          <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium">
              <Layers className="w-4 h-4 text-primary" />
              <span>{sessions.length} Photobooth {sessions.length === 1 ? 'Session' : 'Sessions'}</span>
            </div>
            <span>Click any session to view all photos & clips</span>
          </div>
        )}

        {/* Gallery Grid of Collapsed Sessions */}
        {loadingItems ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading event captures...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 px-4 border border-dashed border-border rounded-3xl bg-[var(--surface-1)] space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl">
              📸
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-bold text-base">No Photos Taken Yet</h3>
              <p className="text-xs text-muted-foreground">
                Be the first to step into the booth and take a picture for {event.name}!
              </p>
            </div>
            <Link
              href={`/e/${event.slug}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-primary-foreground"
              style={{ background: event.themeColor || 'var(--brand)' }}
            >
              Launch Booth & Take First Photo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sessions.map((session, idx) => {
              const formattedDate = session.createdAt instanceof Date
                ? session.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={session.sessionId || idx}
                  onClick={() => {
                    setSelectedSession(session);
                    setActiveMediaTab(session.stripUrl ? 'strip' : 'gif');
                  }}
                  className="group relative bg-[var(--surface-2)] rounded-3xl border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-xl cursor-pointer flex flex-col"
                >
                  {/* Card Cover Preview */}
                  <div className="relative aspect-[3/4] w-full bg-black/5 dark:bg-black/40 flex items-center justify-center p-3 overflow-hidden">
                    {session.coverUrl ? (
                      <img
                        src={session.coverUrl}
                        alt={`Session ${idx + 1}`}
                        className="max-h-full w-auto object-contain rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105"
                        crossOrigin="anonymous"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                        <span className="text-xs">No preview</span>
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] font-medium text-white flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        {session.itemCount} {session.itemCount === 1 ? 'item' : 'items'}
                      </span>

                      {session.gifUrl && (
                        <span className="px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase shadow-sm">
                          GIF
                        </span>
                      )}
                    </div>

                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                      <span className="px-4 py-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md text-foreground rounded-full text-xs font-semibold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        View Session
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3.5 border-t border-border bg-[var(--surface-1)] flex items-center justify-between text-xs">
                    <div className="space-y-0.5 truncate">
                      <span className="font-semibold block truncate">
                        Session #{sessions.length - idx}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {session.photos.length > 0 ? `${session.photos.length} photos` : 'Photo Strip'}
                        {session.liveClips.length > 0 ? ` · ${session.liveClips.length} clips` : ''}
                      </span>
                    </div>

                    {formattedDate && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full shrink-0">
                        {formattedDate}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Collapsed Session Viewer Modal ───────────────────────────────── */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSession(null);
          }}
        >
          <div className="bg-[var(--surface-1)] border border-border text-foreground rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-4 bg-[var(--surface-2)]">
              <div className="space-y-1 truncate">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg truncate">Photobooth Session</h3>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-mono rounded-md font-semibold shrink-0">
                    {selectedSession.itemCount} items
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Session ID: <span className="font-mono text-foreground">{selectedSession.sessionId}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyShareLink(selectedSession.sessionId)}
                  className="gap-1.5 rounded-full text-xs h-8"
                  title="Copy direct share link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedLink ? 'Copied Link!' : 'Share'}</span>
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleDownloadSessionZip(selectedSession)}
                  disabled={downloadingSessionZip}
                  className="gap-1.5 rounded-full text-xs h-8 shadow-sm"
                >
                  {downloadingSessionZip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{downloadingSessionZip ? 'Zipping...' : 'Download Session'}</span>
                </Button>

                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Close modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-8">
              {/* Top Hero Section: The Final Strip & Animated GIF */}
              {(selectedSession.stripUrl || selectedSession.gifUrl) && (
                <div className="bg-[var(--surface-2)] p-4 sm:p-6 rounded-2xl border border-border flex flex-col items-center gap-4">
                  {/* Tab Selector if both Strip PNG and Strip GIF are available */}
                  {selectedSession.stripUrl && selectedSession.gifUrl && (
                    <div className="flex items-center p-1 bg-muted rounded-full text-xs font-semibold">
                      <button
                        onClick={() => setActiveMediaTab('strip')}
                        className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                          activeMediaTab === 'strip'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Final Strip (PNG)
                      </button>
                      <button
                        onClick={() => setActiveMediaTab('gif')}
                        className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                          activeMediaTab === 'gif'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        Animated Strip (GIF)
                      </button>
                    </div>
                  )}

                  {/* Media Display */}
                  <div className="relative max-w-xs sm:max-w-sm w-full mx-auto shadow-xl rounded-xl overflow-hidden bg-black/5 dark:bg-black/30">
                    <img
                      src={
                        activeMediaTab === 'gif' && selectedSession.gifUrl
                          ? selectedSession.gifUrl
                          : selectedSession.stripUrl || selectedSession.coverUrl
                      }
                      alt="Photobooth Strip"
                      className="w-full h-auto object-contain block"
                      crossOrigin="anonymous"
                    />
                  </div>

                  {/* Quick Download Strip Button */}
                  <div className="flex items-center gap-2 pt-2">
                    {selectedSession.stripUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadSingleFile(selectedSession.stripUrl!, 'strip.png')}
                        className="gap-1.5 rounded-full text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Strip PNG
                      </Button>
                    )}

                    {selectedSession.gifUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadSingleFile(selectedSession.gifUrl!, 'strip.gif')}
                        className="gap-1.5 rounded-full text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Animated GIF
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Individual Photos Grid */}
              {selectedSession.photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      Individual Photos ({selectedSession.photos.length})
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedSession.photos.map((url, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-[3/4] bg-muted rounded-2xl overflow-hidden border border-border"
                      >
                        <img
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover block transition-transform group-hover:scale-105"
                          crossOrigin="anonymous"
                          loading="lazy"
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                          <button
                            onClick={() => downloadSingleFile(url, `photo_${idx + 1}.png`)}
                            className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                            title="Download Photo"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                            title="View Full Size"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Motion Clips Grid */}
              {selectedSession.liveClips.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
                      <Film className="w-4 h-4 text-primary" />
                      Live Motion Clips ({selectedSession.liveClips.length})
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedSession.liveClips.map((url, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-[3/4] bg-muted rounded-2xl overflow-hidden border border-border"
                      >
                        <img
                          src={url}
                          alt={`Live Clip ${idx + 1}`}
                          className="w-full h-full object-cover block transition-transform group-hover:scale-105"
                          crossOrigin="anonymous"
                          loading="lazy"
                        />

                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-bold text-white uppercase">
                          GIF
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                          <button
                            onClick={() => downloadSingleFile(url, `live_${idx + 1}.gif`)}
                            className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                            title="Download Live Clip"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                            title="View Full Size"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

