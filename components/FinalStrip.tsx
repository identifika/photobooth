'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Frame } from '@/lib/frames';
import GIF from 'gif.js';

interface Props {
  photos: string[];
  frame: Frame;
  onRestart: () => void;
}

export default function FinalStrip({ photos, frame, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripDataUrl, setStripDataUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [gifDataUrl, setGifDataUrl] = useState('');
  const [generatingGif, setGeneratingGif] = useState(false);
  const [downloadingGif, setDownloadingGif] = useState(false);

  const roundRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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

  const renderStrip = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const PHOTO_W = 400;
    const isGrid = frame.layout === 'grid-2x2';
    const is2 = frame.layout === 'strip-2';
    const photoAR = isGrid ? 1 : 4/3;
    const PHOTO_H = Math.round(PHOTO_W / photoAR);
    const PADDING = 20;
    const HOLE_SIZE = 12;
    const HOLE_MARGIN = 10;

    let stripW: number, stripH: number;

    if (isGrid) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H * 2 + PADDING * 3 + 60;
    } else if (is2) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H + PADDING * 2 + 60 + (HOLE_SIZE + HOLE_MARGIN) * 2;
    } else {
      stripW = PHOTO_W + PADDING * 2 + (HOLE_SIZE + HOLE_MARGIN) * 2;
      stripH = PHOTO_H * photos.length + PADDING * (photos.length + 1) + 60;
    }

    canvas.width = stripW;
    canvas.height = stripH;

    // Background
    ctx.fillStyle = frame.color;
    ctx.fillRect(0, 0, stripW, stripH);

    // Border
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, stripW - 8, stripH - 8);

    // Load all images
    const imgs = await Promise.all(photos.map(src => new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    })));

    if (isGrid) {
      // 2x2 grid layout
      imgs.forEach((img, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = PADDING + col * (PHOTO_W + PADDING);
        const y = PADDING + row * (PHOTO_H + PADDING);
        ctx.save();
        ctx.rect(x, y, PHOTO_W, PHOTO_H);
        ctx.clip();
        ctx.drawImage(img, x, y, PHOTO_W, PHOTO_H);
        ctx.restore();
      });
    } else if (is2) {
      // Side by side
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
      // Vertical strip
      const holeY = (i: number) => PADDING + i * (PHOTO_H + PADDING) + PHOTO_H / 2 - (HOLE_SIZE + 4) / 2;
      const drawHoles = () => {
        for (let i = 0; i < photos.length; i++) {
          const y = holeY(i);
          [HOLE_MARGIN, stripW - HOLE_MARGIN - HOLE_SIZE].forEach(x => {
            ctx.fillStyle = `${frame.borderColor}50`;
            roundRect(ctx, x, y, HOLE_SIZE, HOLE_SIZE + 4, 3);
            ctx.fill();
          });
        }
      };
      drawHoles();
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

    // Footer label
    ctx.fillStyle = frame.borderColor;
    ctx.globalAlpha = 0.7;
    const labelY = stripH - 38;
    ctx.font = `bold 16px "Playfair Display", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(frame.name.toUpperCase(), stripW / 2, labelY);
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.globalAlpha = 0.4;
    ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), stripW / 2, labelY + 18);
    ctx.globalAlpha = 1;

    setStripDataUrl(canvas.toDataURL('image/jpeg', 0.95));
  }, [photos, frame, roundRect]);

  const generateGif = useCallback(async () => {
    setGeneratingGif(true);
    const PHOTO_W = 400;
    const isGrid = frame.layout === 'grid-2x2';
    const photoAR = isGrid ? 1 : 4/3;
    const PHOTO_H = Math.round(PHOTO_W / photoAR);

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: '/gif.worker.js',
      width: PHOTO_W,
      height: PHOTO_H,
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
      gif.addFrame(tempCanvas, { delay: 500 });
    });

    gif.on('finished', (blob: Blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGifDataUrl(reader.result as string);
        setGeneratingGif(false);
      };
      reader.readAsDataURL(blob);
    });

    gif.render();
  }, [photos, frame.layout]);

  useEffect(() => {
    renderStrip();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generateGif();
  }, [renderStrip, generateGif]);

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

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Complete</p>
        <h2 className="font-display text-4xl font-bold">Your Photo Strip</h2>
        <p className="mt-2 opacity-60 text-sm">{frame.emoji} {frame.name} · {photos.length} photos</p>
      </div>

      {/* Rendered strip preview */}
      <div className="max-w-2xl mx-auto">
        {stripDataUrl ? (
          <div className="animate-slideUp flex justify-center">
            <div style={{
              display: 'inline-block',
              boxShadow: `0 24px 80px ${frame.borderColor}30, 0 8px 24px rgba(0,0,0,0.1)`,
              transform: 'rotate(-0.5deg)',
            }}>
              <img
                src={stripDataUrl}
                alt="Photo strip"
                className="max-w-full"
                style={{
                  maxWidth: frame.layout === 'strip-4' || frame.layout === 'strip-3' ? 220 : 440,
                  display: 'block',
                  filter: 'sepia(8%) contrast(1.03)',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Action buttons */}
        {stripDataUrl && (
          <div className="flex flex-col sm:flex-row gap-4 mt-10 animate-fadeIn delay-200">
            <button
              onClick={handleDownload}
              className="flex-1 py-4 rounded-sm font-medium tracking-wide transition-all text-sm"
              style={{
                background: frame.borderColor,
                color: frame.color,
                border: `2px solid ${frame.borderColor}`,
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? '✓ Saved!' : '↓ Download Strip'}
            </button>
            {gifDataUrl && (
              <button
                onClick={handleDownloadGif}
                className="flex-1 py-4 rounded-sm font-medium tracking-wide transition-all text-sm"
                style={{
                  background: frame.borderColor,
                  color: frame.color,
                  border: `2px solid ${frame.borderColor}`,
                  opacity: downloadingGif ? 0.7 : 1,
                }}
              >
                {downloadingGif ? '✓ Saved!' : '↓ Download GIF'}
              </button>
            )}
            <button
              onClick={onRestart}
              className="flex-1 py-4 rounded-sm font-medium tracking-wide transition-all text-sm"
              style={{
                background: 'transparent',
                border: `2px solid ${frame.borderColor}`,
                color: frame.borderColor,
              }}
            >
              ↺ New Session
            </button>
          </div>
        )}

        {/* Animated GIF preview */}
        {generatingGif ? (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Animated GIF</p>
            <div className="flex items-center justify-center h-48">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
            </div>
          </div>
        ) : gifDataUrl && (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Animated GIF</p>
            <div className="flex justify-center">
              <div style={{
                display: 'inline-block',
                boxShadow: `0 12px 40px ${frame.borderColor}20, 0 4px 12px rgba(0,0,0,0.1)`,
                padding: '8px',
                background: 'white',
              }}>
                <img
                  src={gifDataUrl}
                  alt="Animated Photo Strip"
                  className="max-w-full"
                  style={{
                    maxWidth: 300,
                    display: 'block',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Individual photos row */}
        {stripDataUrl && (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Individual Shots</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {photos.map((photo, i) => (
                <div key={i} style={{
                  background: 'white',
                  padding: '6px 6px 24px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (i * 0.5 + 0.5)}deg)`,
                  transition: 'transform 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(0deg) scale(1.05) translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = `rotate(${(i % 2 === 0 ? -1 : 1) * (i * 0.5 + 0.5)}deg)`)}
                >
                  <img src={photo} alt={`Photo ${i + 1}`} style={{
                    width: 80, height: frame.layout === 'grid-2x2' ? 80 : 60,
                    objectFit: 'cover', display: 'block',
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
