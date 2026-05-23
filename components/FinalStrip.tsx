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
  // null = not started, 'pending' = generating, string = done, 'error' = failed
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

  const renderStrip = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

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

    ctx.fillStyle = frame.borderColor;
    ctx.globalAlpha = 0.7;
    const labelY = stripH - 55;
    ctx.font = `bold 24px "Playfair Display", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(frame.name.toUpperCase(), stripW / 2, labelY);
    ctx.font = '16px "DM Sans", sans-serif';
    ctx.globalAlpha = 0.4;
    ctx.fillText(
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      stripW / 2,
      labelY + 26
    );
    ctx.globalAlpha = 1;

    setStripDataUrl(canvas.toDataURL('image/jpeg', 0.95));
  }, [photos, frame, roundRect]);

  const generateGif = useCallback(async () => {
    setGeneratingGif(true);
    try {
      const PHOTO_W = 600;
      const isGrid = frame.layout === 'grid-2x2';
      const photoAR = isGrid ? 1 : 4 / 3;
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
        gif.addFrame(tempCanvas, { delay: 500, copy: true });
      });

      await new Promise<void>((resolve, reject) => {
        gif.on('finished', (blob: Blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setGifDataUrl(reader.result as string);
            resolve();
          };
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

    // Load first frame to get dimensions
    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = frames[0];
    });

    const width = firstImg.width;
    const height = firstImg.height;

    const gif = new GIF({
      workers: 2,
      quality: 8,
      workerScript: '/gif.worker.js',
      width,
      height,
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Load and add each frame
    for (const frameSrc of frames) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = frameSrc;
      });
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      gif.addFrame(ctx.getImageData(0, 0, width, height), { delay: 150 });
    }

    const blob = await new Promise<Blob>((resolve) => {
      gif.on('finished', resolve);
      gif.render();
    });

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
      if (!frames || frames.length === 0) {
        setLiveClipGifs(prev => {
          const next = [...prev];
          next[i] = null;
          return next;
        });
        continue;
      }
      try {
        const gifUrl = await convertClipToGif(frames);
        setLiveClipGifs(prev => {
          const next = [...prev];
          next[i] = gifUrl;
          return next;
        });
      } catch (err) {
        console.error(`Clip ${i} GIF failed:`, err);
        setLiveClipGifs(prev => {
          const next = [...prev];
          next[i] = 'error';
          return next;
        });
      }
    }

    setGeneratingClipGifs(false);
  }, [liveClips, convertClipToGif]);

  useEffect(() => {
    renderStrip();
    generateGif();
    generateClipGifs();
  }, [renderStrip, generateGif, generateClipGifs]);

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

  const downloadIndividual = async (photoSrc: string, index: number) => {
    const PHOTO_W = 800;
    const isGrid = frame.layout === 'grid-2x2';
    const photoAR = isGrid ? 1 : 4 / 3;
    const PHOTO_H = Math.round(PHOTO_W / photoAR);
    const FRAME_PAD_SIDE = 40;
    const FRAME_PAD_TOP = 40;
    const FRAME_PAD_BOTTOM = 120;
    const BORDER_W = 6;
    const canvasW = PHOTO_W + FRAME_PAD_SIDE * 2 + BORDER_W * 2;
    const canvasH = PHOTO_H + FRAME_PAD_TOP + FRAME_PAD_BOTTOM + BORDER_W * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = BORDER_W;
    ctx.strokeRect(BORDER_W / 2, BORDER_W / 2, canvasW - BORDER_W, canvasH - BORDER_W);

    const tapeW = 100;
    const tapeH = 24;
    ctx.fillStyle = `${frame.accentColor}90`;
    ctx.fillRect((canvasW - tapeW) / 2, 6, tapeW, tapeH);

    const img = new Image();
    await new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.src = photoSrc;
    });

    const photoX = FRAME_PAD_SIDE + BORDER_W;
    const photoY = FRAME_PAD_TOP + BORDER_W;
    ctx.drawImage(img, photoX, photoY, PHOTO_W, PHOTO_H);

    const labelY = photoY + PHOTO_H + 40;
    ctx.fillStyle = frame.borderColor;
    ctx.globalAlpha = 0.5;
    ctx.font = 'italic 22px "Playfair Display", serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}/${photos.length}`, photoX, labelY);
    ctx.font = '16px "DM Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(frame.name.toUpperCase(), photoX + PHOTO_W, labelY);
    ctx.globalAlpha = 0.3;
    ctx.font = '14px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      canvasW / 2,
      labelY + 30
    );
    ctx.globalAlpha = 1;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `photobooth-${frame.id}-photo${index + 1}-${Date.now()}.jpg`;
    a.click();
  };

  const hasLiveClips = liveClips && liveClips.some(c => c !== null && c.length > 0);

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Complete</p>
        <h2 className="font-display text-4xl font-bold">Your Photo Strip</h2>
        <p className="mt-2 opacity-60 text-sm">{frame.emoji} {frame.name} · {photos.length} photos</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Strip preview */}
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

            {generatingGif ? (
              <button
                disabled
                className="flex-1 py-4 rounded-sm font-medium tracking-wide text-sm cursor-not-allowed"
                style={{
                  background: 'transparent',
                  border: `2px solid ${frame.borderColor}`,
                  color: frame.borderColor,
                  opacity: 0.5,
                }}
              >
                ⏳ Building GIF…
              </button>
            ) : gifDataUrl ? (
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
            ) : null}

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
        {(generatingGif || gifDataUrl) && (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Animated GIF</p>
            {generatingGif ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
              </div>
            ) : gifDataUrl && (
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
                    style={{ maxWidth: 300, display: 'block' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Individual photos */}
        {stripDataUrl && (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Individual Shots</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {photos.map((photo, i) => {
                const clip = liveClips?.[i] ?? null;
                const hasClip = clip !== null && clip.length > 0;
                const clipGif = liveClipGifs[i];

                return (
                  <div
                    key={i}
                    className="group relative"
                    style={{
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
                      width: 80,
                      height: frame.layout === 'grid-2x2' ? 80 : 60,
                      objectFit: 'cover',
                      display: 'block',
                    }} />

                    {/* Live badge */}
                    {hasClip && (
                      <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8 }}>
                        <div className="w-1 h-1 rounded-full bg-red-500" />
                        <span className="text-white font-medium">LIVE</span>
                      </div>
                    )}

                    {/* Download overlay */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.6)' }}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); downloadIndividual(photo, i); }}
                        className="text-white text-xs px-2 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.2)' }}
                        aria-label={`Download photo ${i + 1}`}
                      >
                        📷
                      </button>

                      {hasClip && clipGif === 'pending' && (
                        <span className="text-white text-xs opacity-60">⏳</span>
                      )}
                      {hasClip && clipGif && clipGif !== 'pending' && clipGif !== 'error' && (
                        <button
                          onClick={e => { e.stopPropagation(); downloadClipGif(clipGif as string, i); }}
                          className="text-white text-xs px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.2)' }}
                          aria-label={`Download live clip ${i + 1}`}
                        >
                          🎬
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Moments GIFs */}
        {hasLiveClips && stripDataUrl && (
          <div className="mt-10 animate-fadeIn delay-300">
            <p className="text-xs opacity-40 tracking-widest uppercase text-center mb-4">Live Moments</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              {liveClips!.map((frames, i) => {
                if (!frames || frames.length === 0) return null;
                const gifEntry = liveClipGifs[i];

                return (
                  <div
                    key={i}
                    className="rounded-lg overflow-hidden"
                    style={{
                      background: 'white',
                      padding: '8px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    }}
                  >
                    {(!gifEntry || gifEntry === 'pending') && (
                      <div className="flex items-center justify-center rounded-sm"
                        style={{ height: 150, background: '#f0f0f0' }}>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
                          <span className="text-xs opacity-50">Creating GIF…</span>
                        </div>
                      </div>
                    )}

                    {gifEntry && gifEntry !== 'pending' && gifEntry !== 'error' && (
                      <img
                        src={gifEntry as string}
                        alt={`Live moment ${i + 1}`}
                        className="w-full rounded-sm"
                        style={{ display: 'block' }}
                      />
                    )}

                    {gifEntry === 'error' && (
                      <div className="flex items-center justify-center rounded-sm"
                        style={{ height: 150, background: '#fef2f2' }}>
                        <span className="text-xs text-red-500">Failed to create GIF</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-xs opacity-50">Photo {i + 1} · Live</span>
                      {gifEntry && gifEntry !== 'pending' && gifEntry !== 'error' ? (
                        <button
                          onClick={() => downloadClipGif(gifEntry as string, i)}
                          className="text-xs px-2 py-1 rounded transition-all"
                          style={{
                            background: `${frame.borderColor}15`,
                            color: frame.borderColor,
                            border: `1px solid ${frame.borderColor}30`,
                          }}
                        >
                          ↓ Download GIF
                        </button>
                      ) : gifEntry === 'error' ? (
                        <span className="text-xs opacity-40">Failed</span>
                      ) : (
                        <span className="text-xs opacity-30">Generating…</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}