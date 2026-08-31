'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { getEventBySlug, type BoothEvent } from '@/lib/events';
import { getClientAuthToken } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog-provider';
import JSZip from 'jszip';
import {
  Image as ImageIcon,
  Download,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Share2,
  Loader2,
  ExternalLink,
  Camera,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface MediaItem {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
}

export default function EventLiveGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const router = useRouter();
  const { alert } = useDialog();

  const [event, setEvent] = useState<BoothEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);

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

  // 2. Fetch Media items for this event
  const fetchMedia = async () => {
    if (!event) return;
    setLoadingItems(true);
    try {
      const token = await getClientAuthToken();
      // Fetch uploads with prefix
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId: `evt-${slug}` }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setItems(data.items);
        }
      } else {
        // If empty / not yet created, start with empty list
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch event media:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (event) {
      fetchMedia();
    }
  }, [event]);

  // Slideshow auto-advance
  useEffect(() => {
    if (!isSlideshow || items.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlideIdx((prev) => (prev + 1) % items.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isSlideshow, items.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (items.length === 0) {
      await alert('No photos have been taken for this event yet.');
      return;
    }

    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const fetchPromises = items.map(async (item) => {
        const response = await fetch(item.url);
        if (!response.ok) return;
        const blob = await response.blob();
        const filename = item.key.split('/').pop() || 'photo.png';
        zip.file(filename, blob);
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

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Header />

      {/* Fullscreen Slideshow / Projector Overlay */}
      {isSlideshow && items.length > 0 && (
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
              src={items[currentSlideIdx].url}
              alt="Slideshow capture"
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
              crossOrigin="anonymous"
            />
          </div>

          {/* Bottom Progress Tracker */}
          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2 z-10">
            <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-mono">
              {currentSlideIdx + 1} / {items.length} · Auto-Advancing
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
            {items.length > 0 && (
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

        {/* Gallery Grid */}
        {loadingItems ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading event captures...</p>
          </div>
        ) : items.length === 0 ? (
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
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {items.map((item, idx) => {
              const isStrip = item.key.includes('strip.png');
              const isGif = item.key.endsWith('.gif');
              const filename = item.key.split('/').pop() || 'photo.png';

              return (
                <div
                  key={item.key}
                  className="group relative bg-muted rounded-2xl overflow-hidden break-inside-avoid border border-border hover:border-primary/50 transition-all hover:shadow-lg"
                >
                  <img
                    src={item.url}
                    alt={filename}
                    className="w-full h-auto block transition-transform group-hover:scale-105"
                    crossOrigin="anonymous"
                    loading="lazy"
                  />

                  {/* Badges */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isGif && (
                      <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase">
                        GIF
                      </span>
                    )}
                    {isStrip && (
                      <span className="px-2 py-0.5 bg-primary/90 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase">
                        Strip
                      </span>
                    )}
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                    <button
                      onClick={() => downloadSingleFile(item.url, filename)}
                      className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                      title="Download Photo"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-transform active:scale-95"
                      title="View Full Size"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
