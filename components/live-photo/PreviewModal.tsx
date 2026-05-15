'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { LivePhotoResult } from '@/types/live-photo';
import GIF from 'gif.js';

interface Props {
  result: LivePhotoResult;
  onRetake: () => void;
  onClose: () => void;
}

export default function PreviewModal({ result, onRetake, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [generatingGif, setGeneratingGif] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate GIF from the video on mount
  useEffect(() => {
    generateGif();
    return () => {
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateGif = useCallback(async () => {
    setGeneratingGif(true);
    setGifProgress(0);

    try {
      // Create an offscreen video element to extract frames
      const video = document.createElement('video');
      video.src = result.videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video for GIF'));
      });

      const width = Math.min(video.videoWidth, 480);
      const height = Math.round((width / video.videoWidth) * video.videoHeight);
      const duration = video.duration;
      const fps = 10;
      const totalFrames = Math.min(Math.floor(duration * fps), 40); // Cap at 40 frames
      const frameDelay = 1000 / fps;

      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/gif.worker.js',
        width,
        height,
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Extract frames by seeking through the video
      for (let i = 0; i < totalFrames; i++) {
        const seekTime = (i / totalFrames) * duration;
        video.currentTime = seekTime;

        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        // Mirror to match the preview display
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();

        // Create a copy of the canvas for gif.js
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d')!;
        frameCtx.drawImage(canvas, 0, 0);

        gif.addFrame(frameCtx, { delay: frameDelay, copy: true });
        setGifProgress(Math.round(((i + 1) / totalFrames) * 60)); // 0-60% for frame extraction
      }

      // Render GIF
      const gifBlob = await new Promise<Blob>((resolve) => {
        gif.on('progress', (p: number) => {
          setGifProgress(60 + Math.round(p * 40)); // 60-100% for encoding
        });
        gif.on('finished', (blob: Blob) => {
          resolve(blob);
        });
        gif.render();
      });

      const url = URL.createObjectURL(gifBlob);
      setGifUrl(url);
    } catch (err) {
      console.error('GIF generation failed:', err);
    } finally {
      setGeneratingGif(false);
      setGifProgress(100);
    }
  }, [result.videoUrl]);

  // Press and hold to play motion clip (Apple Live Photo interaction)
  const handlePointerDown = useCallback(() => {
    holdTimerRef.current = setTimeout(() => {
      setShowVideo(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }, 150);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setShowVideo(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const handleSavePhoto = useCallback(() => {
    setSaving(true);
    const a = document.createElement('a');
    a.href = result.photoUrl;
    a.download = `live-photo-${result.createdAt}.jpg`;
    a.click();
    setTimeout(() => setSaving(false), 1000);
  }, [result]);

  const handleSaveVideo = useCallback(() => {
    setSaving(true);
    const a = document.createElement('a');
    a.href = result.videoUrl;
    a.download = `live-motion-${result.createdAt}.webm`;
    a.click();
    setTimeout(() => setSaving(false), 1000);
  }, [result]);

  const handleSaveGif = useCallback(() => {
    if (!gifUrl) return;
    setSaving(true);
    const a = document.createElement('a');
    a.href = gifUrl;
    a.download = `live-motion-${result.createdAt}.gif`;
    a.click();
    setTimeout(() => setSaving(false), 1000);
  }, [gifUrl, result.createdAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md animate-slideUp" ref={containerRef}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-display text-xl font-bold">Live Photo</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-2xl leading-none"
            aria-label="Close preview"
          >
            ×
          </button>
        </div>

        {/* Photo/Video preview */}
        <div
          className="relative rounded-xl overflow-hidden shadow-2xl cursor-pointer select-none"
          style={{ aspectRatio: '16/9' }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Still photo */}
          <img
            src={result.photoUrl}
            alt="Captured live photo"
            className="w-full h-full object-cover absolute inset-0 transition-opacity duration-200"
            style={{ opacity: showVideo ? 0 : 1 }}
            draggable={false}
          />

          {/* Motion video */}
          <video
            ref={videoRef}
            src={result.videoUrl}
            className="w-full h-full object-cover absolute inset-0 transition-opacity duration-200"
            style={{ opacity: showVideo ? 1 : 0, transform: 'scaleX(-1)' }}
            playsInline
            muted
            loop
          />

          {/* Live indicator badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-white text-xs font-medium tracking-wide">LIVE</span>
          </div>

          {/* Hold hint */}
          {!showVideo && (
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="text-white/60 text-xs px-3 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                Hold to play motion
              </span>
            </div>
          )}

          {/* Playing indicator */}
          {showVideo && (
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="text-white text-xs px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,200,0,0.3)', border: '1px solid rgba(255,200,0,0.5)' }}>
                ▶ Playing motion
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            onClick={handleSavePhoto}
            disabled={saving}
            className="py-3 rounded-lg font-medium text-sm transition-all"
            style={{
              background: 'white',
              color: '#1a1410',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '✓ Saved' : '↓ Photo'}
          </button>
          <button
            onClick={handleSaveVideo}
            disabled={saving}
            className="py-3 rounded-lg font-medium text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '✓ Saved' : '↓ Video'}
          </button>
          <button
            onClick={handleSaveGif}
            disabled={saving || generatingGif || !gifUrl}
            className="py-3 rounded-lg font-medium text-sm transition-all"
            style={{
              background: gifUrl ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
              color: gifUrl ? '#fbbf24' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${gifUrl ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {generatingGif ? `${gifProgress}%` : gifUrl ? '↓ GIF' : '...'}
          </button>
        </div>

        {/* GIF preview */}
        {gifUrl && (
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <img
              src={gifUrl}
              alt="Live photo as GIF"
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>
        )}

        <div className="flex gap-3 mt-3">
          <button
            onClick={onRetake}
            className="flex-1 py-3 rounded-lg font-medium text-sm transition-all"
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            ↺ Retake
          </button>
        </div>

        {/* Metadata */}
        <p className="text-white/30 text-xs text-center mt-4">
          {new Date(result.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
