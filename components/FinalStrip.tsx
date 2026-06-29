'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Frame } from '@/lib/frames';
import GIF from 'gif.js';

interface Props {
  photos: string[];
  liveClips?: (string[] | null)[];
  frame: Frame;
  onRestart: () => void;
}

export default function FinalStrip({ photos, liveClips, frame, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripDataUrl, setStripDataUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [gifDataUrl, setGifDataUrl] = useState('');
  const [generatingGif, setGeneratingGif] = useState(false);
  const [downloadingGif, setDownloadingGif] = useState(false);
  const [liveClipGifs, setLiveClipGifs] = useState<(string | null | 'pending' | 'error')[]>([]);
  const [generatingClipGifs, setGeneratingClipGifs] = useState(false);

  const roundRect = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }, []);

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    }), []);

  const renderStrip = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Elements-based rendering (frame editor config) ──
    const cfg = frame.config;
    if (cfg && cfg.elements && cfg.elements.length > 0) {
      const fw = cfg.width ?? 400;
      const fh = cfg.height ?? 600;
      const OUT_W = 1200; // High quality output
      const scale = OUT_W / fw;
      const OUT_H = Math.round(fh * scale);

      canvas.width = OUT_W;
      canvas.height = OUT_H;

      // Background
      ctx.fillStyle = cfg.color ?? frame.color;
      ctx.fillRect(0, 0, OUT_W, OUT_H);
      ctx.strokeStyle = cfg.borderColor ?? frame.borderColor;
      ctx.lineWidth = 12;
      ctx.strokeRect(4, 4, OUT_W - 8, OUT_H - 8);

      // Accent bars
      const accentSz = cfg.accentSize ?? 4;
      ctx.fillStyle = cfg.accentColor ?? frame.accentColor;
      ctx.fillRect(0, 0, OUT_W, accentSz * scale);
      ctx.fillRect(0, OUT_H - accentSz * scale, OUT_W, accentSz * scale);

      const photoImgs = await Promise.all(photos.map(src => loadImage(src)));
      let photoIdx = 0;

      for (const el of cfg.elements) {
        const x = el.x * scale;
        const y = el.y * scale;
        const w = el.width * scale;
        const h = el.height * scale;

        if (el.type === 'photo') {
          const rot = (el as any).rotation ?? 0;
          ctx.save();

          // Apply rotation if needed
          if (rot !== 0) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.translate(-(x + w / 2), -(y + h / 2));
          }

          // Draw border (rotated with the slot)
          ctx.fillStyle = `${cfg.borderColor ?? '#1a1410'}18`;
          ctx.strokeStyle = `${cfg.borderColor ?? '#1a1410'}40`;
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 8]);
          roundRect(ctx, x, y, w, h, el.borderRadius * scale);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          if (photoIdx < photoImgs.length) {
            const img = photoImgs[photoIdx]!;
            ctx.save();
            roundRect(ctx, x, y, w, h, el.borderRadius * scale);
            ctx.clip();
            const imgRatio = img.width / img.height;
            const slotRatio = w / h;
            let dw = w, dh = h, dx = x, dy = y;
            if (imgRatio > slotRatio) { dh = h; dw = h * imgRatio; dx = x - (dw - w) / 2; }
            else { dw = w; dh = w / imgRatio; dy = y - (dh - h) / 2; }
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
            photoIdx++;
          }
          ctx.restore();
        }

        if (el.type === 'title') {
          ctx.save();
          ctx.fillStyle = el.color;
          ctx.font = `bold ${el.fontSize * scale}px "${el.font}", serif`;
          ctx.textAlign = el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center';
          const textX = el.align === 'left' ? x : el.align === 'right' ? x + w : x + w / 2;
          ctx.fillText(el.text, textX, y + el.fontSize * scale + 8);
          ctx.restore();
        }

        if (el.type === 'image' && el.src) {
          try {
            const img = await loadImage(el.src);
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
            if (el.objectFit === 'cover') {
              const imgRatio = img.width / img.height;
              const slotRatio = w / h;
              let dw = w, dh = h, dx = x, dy = y;
              if (imgRatio > slotRatio) { dh = h; dw = h * imgRatio; dx = x - (dw - w) / 2; }
              else { dw = w; dh = w / imgRatio; dy = y - (dh - h) / 2; }
              ctx.drawImage(img, dx, dy, dw, dh);
            } else {
              ctx.drawImage(img, x, y, w, h);
            }
            ctx.restore();
          } catch { /* skip broken images */ }
        }

        if (el.type === 'emoji') {
          ctx.save();
          ctx.font = `${20 * scale}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          ctx.textAlign = 'center';
          const emojiW = el.spacing * scale;
          const count = Math.floor(w / emojiW);
          for (let i = 0; i < count; i++) {
            ctx.fillText(el.emoji, x + emojiW / 2 + i * emojiW, y + h * 0.8);
          }
          ctx.restore();
        }

        if (el.type === 'sticker') {
          ctx.save();
          const fontSize = Math.max(48, Math.min(w, h));
          ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (el.rotation) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((el.rotation * Math.PI) / 180);
            ctx.fillText(el.emoji, 0, 4);
          } else {
            ctx.fillText(el.emoji, x + w / 2, y + h / 2 + 4);
          }
          ctx.restore();
        }
      }

      setStripDataUrl(canvas.toDataURL('image/jpeg', 0.95));
      return;
    }

    // ── Legacy layout-based rendering ──
    const PHOTO_W = 800;
    const isGrid = frame.layout === 'grid-2x2';
    const is2 = frame.layout === 'strip-2';
    const photoAR = isGrid ? 1 : 4 / 3;
    const PHOTO_H = Math.round(PHOTO_W / photoAR);
    const PADDING = 30;
    const HOLE_SIZE = 18;
    const HOLE_MARGIN = 14;

    let stripW: number, stripH: number;
    if (isGrid) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H * 2 + PADDING * 3 + 90;
    } else if (is2) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H + PADDING * 2 + 90 + (HOLE_SIZE + HOLE_MARGIN) * 2;
    } else {
      stripW = PHOTO_W + PADDING * 2 + (HOLE_SIZE + HOLE_MARGIN) * 2;
      stripH = PHOTO_H * photos.length + PADDING * (photos.length + 1) + 90;
    }

    canvas.width = stripW;
    canvas.height = stripH;

    ctx.fillStyle = frame.color;
    ctx.fillRect(0, 0, stripW, stripH);
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, stripW - 12, stripH - 12);

    const imgs = await Promise.all(photos.map(src => new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    })));

    if (isGrid) {
      imgs.forEach((img, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = PADDING + col * (PHOTO_W + PADDING);
        const y = PADDING + row * (PHOTO_H + PADDING);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, PHOTO_W, PHOTO_H);
        ctx.clip();
        ctx.drawImage(img, x, y, PHOTO_W, PHOTO_H);
        ctx.restore();
      });
    } else if (is2) {
      const holeX1 = PADDING;
      const holeX2 = stripW - PADDING - HOLE_SIZE;
      const drawHoleRow = (y: number) => {
        [holeX1, holeX2].forEach(hx => {
          ctx.fillStyle = `${frame.borderColor}60`;
          roundRect(ctx, hx, y, HOLE_SIZE, HOLE_SIZE + 4, 3);
          ctx.fill();
        });
      };
      drawHoleRow(PADDING);
      imgs.forEach((img, i) => {
        const x = PADDING + i * (PHOTO_W + PADDING);
        const y = PADDING + HOLE_SIZE + HOLE_MARGIN;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, PHOTO_W, PHOTO_H);
        ctx.clip();
        ctx.drawImage(img, x, y, PHOTO_W, PHOTO_H);
        ctx.restore();
      });
      drawHoleRow(PADDING + HOLE_SIZE + HOLE_MARGIN + PHOTO_H + 6);
    } else {
      const holeY = (i: number) =>
        PADDING + i * (PHOTO_H + PADDING) + PHOTO_H / 2 - (HOLE_SIZE + 4) / 2;
      for (let i = 0; i < photos.length; i++) {
        const y = holeY(i);
        [HOLE_MARGIN, stripW - HOLE_MARGIN - HOLE_SIZE].forEach(x => {
          ctx.fillStyle = `${frame.borderColor}50`;
          roundRect(ctx, x, y, HOLE_SIZE, HOLE_SIZE + 4, 3);
          ctx.fill();
        });
      }
      imgs.forEach((img, i) => {
        const x = HOLE_MARGIN + HOLE_SIZE + PADDING / 2;
        const y = PADDING + i * (PHOTO_H + PADDING);
        const w = stripW - (HOLE_MARGIN + HOLE_SIZE + PADDING / 2) * 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, PHOTO_H);
        ctx.clip();
        ctx.drawImage(img, x, y, w, PHOTO_H);
        ctx.restore();
      });
    }

    setStripDataUrl(canvas.toDataURL('image/jpeg', 0.95));
  }, [photos, frame, roundRect, loadImage]);

  const generateGif = useCallback(async () => {
    setGeneratingGif(true);
    try {
      const PHOTO_W = 600;
      const isGrid = frame.layout === 'grid-2x2';
      const photoAR = isGrid ? 1 : 4 / 3;
      const PHOTO_H = Math.round(PHOTO_W / photoAR);

      const gif = new GIF({
        workers: 2, quality: 10, workerScript: '/gif.worker.js',
        width: PHOTO_W, height: PHOTO_H,
      });

      const imgs = await Promise.all(photos.map(src => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      })));

      imgs.forEach(img => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = PHOTO_W;
        tempCanvas.height = PHOTO_H;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, PHOTO_W, PHOTO_H);
        gif.addFrame(tempCanvas, { delay: 500, copy: true });
      });

      await new Promise<void>((resolve, reject) => {
        gif.on('finished', (blob: Blob) => {
          const reader = new FileReader();
          reader.onloadend = () => { setGifDataUrl(reader.result as string); resolve(); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        gif.render();
      });
    } catch (err) {
      console.error('Strip GIF generation failed:', err);
    } finally {
      setGeneratingGif(false);
    }
  }, [photos, frame.layout]);

  const convertClipToGif = useCallback(async (frames: string[]): Promise<string> => {
    if (frames.length === 0) throw new Error('No frames to convert');
    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = frames[0]!;
    });
    const gif = new GIF({ workers: 2, quality: 8, workerScript: '/gif.worker.js', width: firstImg.width, height: firstImg.height });
    const canvas = document.createElement('canvas');
    canvas.width = firstImg.width;
    canvas.height = firstImg.height;
    const ctx = canvas.getContext('2d')!;
    for (const frameSrc of frames) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = frameSrc;
      });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      gif.addFrame(ctx.getImageData(0, 0, canvas.width, canvas.height), { delay: 150 });
    }
    const blob = await new Promise<Blob>((resolve) => { gif.on('finished', resolve); gif.render(); });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const generateClipGifs = useCallback(async () => {
    if (!liveClips || !liveClips.some(c => c !== null)) return;
    setGeneratingClipGifs(true);
    setLiveClipGifs(liveClips.map(c => (c ? 'pending' : null)));
    for (let i = 0; i < liveClips.length; i++) {
      const frames = liveClips[i];
      if (!frames || frames.length === 0) { setLiveClipGifs(prev => { const next = [...prev]; next[i] = null; return next; }); continue; }
      try {
        const gifUrl = await convertClipToGif(frames);
        setLiveClipGifs(prev => { const next = [...prev]; next[i] = gifUrl; return next; });
      } catch (err) {
        console.error(`Clip ${i} GIF failed:`, err);
        setLiveClipGifs(prev => { const next = [...prev]; next[i] = 'error'; return next; });
      }
    }
    setGeneratingClipGifs(false);
  }, [liveClips, convertClipToGif]);

  useEffect(() => { renderStrip(); generateGif(); generateClipGifs(); }, [renderStrip, generateGif, generateClipGifs]);

  const handleDownload = () => {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = stripDataUrl;
    a.download = `photobooth-${frame.id}-${Date.now()}.jpg`;
    a.click();
    setTimeout(() => setDownloading(false), 1500);
  };

  const handleDownloadGif = () => {
    if (!gifDataUrl) return;
    setDownloadingGif(true);
    const a = document.createElement('a');
    a.href = gifDataUrl;
    a.download = `photobooth-${frame.id}-${Date.now()}.gif`;
    a.click();
    setTimeout(() => setDownloadingGif(false), 1500);
  };

  const downloadClipGif = (gifUrl: string, index: number) => {
    const a = document.createElement('a');
    a.href = gifUrl;
    a.download = `photobooth-${frame.id}-live${index + 1}-${Date.now()}.gif`;
    a.click();
  };

  const handleDownloadPhoto = (photoUrl: string, index: number) => {
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = `photobooth-${frame.id}-photo${index + 1}-${Date.now()}.jpg`;
    a.click();
  };

  const hasLiveClips = liveClips && liveClips.some(c => c !== null && c.length > 0);

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-6">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Complete</p>
        <h2 className="font-display text-3xl font-bold">Your Photo Strip</h2>
        <p className="mt-2 opacity-60 text-sm">{frame.emoji} {frame.name} · {photos.length} photos</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Main strip preview */}
        {stripDataUrl ? (
          <div className="animate-slideUp flex justify-center mb-8">
            <div style={{
              display: 'inline-block',
              boxShadow: `0 24px 80px ${frame.borderColor}30, 0 8px 24px rgba(0,0,0,0.1)`,
              transform: 'rotate(-0.5deg)',
            }}>
              <img src={stripDataUrl} alt="Photo strip" className="max-w-full" style={{ display: 'block', filter: 'sepia(8%) contrast(1.03)', maxWidth: 400, width: '100%' }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 mb-8">
            <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Live result preview - show first live clip GIF if available */}
        {liveClipGifs.some(g => g && g !== 'pending' && g !== 'error') && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 opacity-70">Live Preview</h3>
            <div className="flex gap-4 justify-center">
              {liveClipGifs.map((gifUrl, i) => (
                gifUrl && gifUrl !== 'pending' && gifUrl !== 'error' ? (
                  <div key={i} className="relative">
                    <img src={gifUrl} alt={`Live ${i + 1}`} className="h-24 rounded-sm" />
                    <button
                      onClick={() => downloadClipGif(gifUrl, i)}
                      className="absolute bottom-1 right-1 px-2 py-1 text-xs rounded transition-all hover:opacity-90 bg-primary text-primary-foreground"
                    >
                      ↓
                    </button>
                  </div>
                ) : gifUrl === 'pending' ? (
                  <div key={i} className="h-24 w-24 flex items-center justify-center rounded-sm" style={{ background: `${frame.borderColor}20` }}>
                    <span className="text-xs opacity-50">Loading...</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}

        {/* Download one by one - individual photos */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 opacity-70">Download Photos</h3>
          <div className="flex gap-3 justify-center flex-wrap">
            {photos.map((photo, i) => (
              <div key={i} className="relative group">
                <img src={photo} alt={`Photo ${i + 1}`} className="h-16 rounded-sm" style={{ border: `1px solid ${frame.borderColor}40` }} />
                <button
                  onClick={() => handleDownloadPhoto(photo, i)}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all rounded-sm"
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs">↓</span>
                </button>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] opacity-50">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GIF preview and download */}
        {gifDataUrl && (
          <div className="mb-6 text-center">
            <h3 className="text-sm font-medium mb-3 opacity-70">Animated GIF Preview</h3>
            <div className="inline-block rounded-sm overflow-hidden" style={{ boxShadow: `0 8px 24px ${frame.borderColor}20` }}>
              <img src={gifDataUrl} alt="Animated GIF" className="max-h-48" />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {stripDataUrl && (
          <div className="flex flex-col sm:flex-row gap-3 animate-fadeIn delay-200">
            <button onClick={handleDownload} className="flex-1 py-3 rounded-sm font-medium tracking-wide transition-all text-sm hover:opacity-90 bg-primary text-primary-foreground" style={{ opacity: downloading ? 0.7 : 1 }}>
              {downloading ? '✓ Saved!' : '↓ Download Strip'}
            </button>
            {generatingGif ? (
              <button disabled className="flex-1 py-3 rounded-sm font-medium tracking-wide text-sm cursor-not-allowed border-2 border-input text-muted-foreground bg-transparent" style={{ opacity: 0.5 }}>
                ⏳ GIF...
              </button>
            ) : gifDataUrl ? (
              <button onClick={handleDownloadGif} className="flex-1 py-3 rounded-sm font-medium tracking-wide transition-all text-sm hover:opacity-90 bg-primary text-primary-foreground" style={{ opacity: downloadingGif ? 0.7 : 1 }}>
                {downloadingGif ? '✓ Saved!' : '↓ Download GIF'}
              </button>
            ) : null}
            <button onClick={onRestart} className="flex-1 py-3 rounded-sm font-medium tracking-wide transition-all text-sm hover:opacity-75 border-2 border-input text-foreground bg-transparent hover:bg-surface-0">
              ↺ New
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
