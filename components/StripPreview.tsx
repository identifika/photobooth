'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Frame } from '@/lib/frames';

interface Props {
  photos: string[];
  liveClips?: (string[] | null)[];
  frame: Frame;
  onRetakePhoto: (index: number) => void;
  onConfirm: () => void;
}

export default function StripPreview({ photos, liveClips, frame, onRetakePhoto, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripDataUrl, setStripDataUrl] = useState('');

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

  const buildTicketPath = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const spacing = Math.max(r * 2, Math.round(r * 2.8));
    ctx.beginPath();
    ctx.moveTo(x, y);

    const xHoles = [];
    for (let cx = x + spacing / 2; cx < x + w; cx += spacing) xHoles.push(cx);
    const yHoles = [];
    for (let cy = y + spacing / 2; cy < y + h; cy += spacing) yHoles.push(cy);

    for (const cx of xHoles) { ctx.lineTo(cx - r, y); ctx.arc(cx, y, r, Math.PI, 0, true); }
    ctx.lineTo(x + w, y);
    for (const cy of yHoles) { ctx.lineTo(x + w, cy - r); ctx.arc(x + w, cy, r, -Math.PI / 2, Math.PI / 2, true); }
    ctx.lineTo(x + w, y + h);
    for (let i = xHoles.length - 1; i >= 0; i--) { const cx = xHoles[i]; ctx.lineTo(cx + r, y + h); ctx.arc(cx, y + h, r, 0, Math.PI, true); }
    ctx.lineTo(x, y + h);
    for (let i = yHoles.length - 1; i >= 0; i--) { const cy = yHoles[i]; ctx.lineTo(x, cy + r); ctx.arc(x, cy, r, Math.PI / 2, -Math.PI / 2, true); }
    ctx.lineTo(x, y);
    ctx.closePath();
  }, []);

  const formatDate = useCallback((date: Date, format: string): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    return format
      .replace('YYYY', String(y))
      .replace('MMM', months[m])
      .replace('MM', String(m + 1).padStart(2, '0'))
      .replace('DD', String(d).padStart(2, '0'));
  }, []);

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    }), []);

  const renderStrip = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Elements-based rendering
    const cfg = frame.config;
    if (cfg && cfg.elements && cfg.elements.length > 0) {
      const fw = cfg.width ?? 400;
      const fh = cfg.height ?? 600;
      const OUT_W = 400; // Smaller for preview
      const scale = OUT_W / fw;
      const OUT_H = Math.round(fh * scale);

      canvas.width = OUT_W;
      canvas.height = OUT_H;

      // Background
      const bgType = cfg.bgType ?? 'solid';
      if (bgType === 'gradient') {
        const angle = ((cfg.bgGradientAngle ?? 135) - 90) * (Math.PI / 180);
        const cx = OUT_W / 2;
        const cy = OUT_H / 2;
        const diag = Math.sqrt(cx * cx + cy * cy);
        const grad = ctx.createLinearGradient(
          cx - Math.cos(angle) * diag,
          cy - Math.sin(angle) * diag,
          cx + Math.cos(angle) * diag,
          cy + Math.sin(angle) * diag
        );
        grad.addColorStop(0, cfg.bgGradientFrom ?? '#f5f0e8');
        grad.addColorStop(1, cfg.bgGradientTo ?? '#e8dfd0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, OUT_W, OUT_H);
      } else if (bgType === 'image' && cfg.bgImage) {
        try {
          const bgImg = await loadImage(cfg.bgImage);
          const imgRatio = bgImg.width / bgImg.height;
          const canvasRatio = OUT_W / OUT_H;
          let dw = OUT_W, dh = OUT_H, dx = 0, dy = 0;
          if (imgRatio > canvasRatio) { dh = OUT_H; dw = OUT_H * imgRatio; dx = (OUT_W - dw) / 2; }
          else { dw = OUT_W; dh = OUT_W / imgRatio; dy = (OUT_H - dh) / 2; }
          ctx.drawImage(bgImg, dx, dy, dw, dh);
        } catch {
          ctx.fillStyle = cfg.color ?? '#f5f0e8';
          ctx.fillRect(0, 0, OUT_W, OUT_H);
        }
      } else {
        ctx.fillStyle = cfg.color ?? '#f5f0e8';
        ctx.fillRect(0, 0, OUT_W, OUT_H);
      }
      if (cfg.borderStyle !== 'ticket') {
        ctx.save();
        ctx.strokeStyle = cfg.borderColor ?? '#1a1410';
        ctx.lineWidth = 6;
        if (cfg.borderStyle === 'dashed') ctx.setLineDash([15 * scale, 10 * scale]);
        else if (cfg.borderStyle === 'dotted') {
          ctx.setLineDash([6 * scale, 12 * scale]);
          ctx.lineCap = 'round';
        }
        ctx.strokeRect(3, 3, OUT_W - 6, OUT_H - 6);
        ctx.restore();
      }

      // Accent bars
      const accentSz = cfg.accentSize ?? 4;
      ctx.fillStyle = cfg.accentColor ?? '#e11d48';
      ctx.fillRect(0, 0, OUT_W, accentSz * scale);
      ctx.fillRect(0, OUT_H - accentSz * scale, OUT_W, accentSz * scale);

      const photoImgs = await Promise.all(photos.map(src => loadImage(src)));
      let photoIdx = 0;
      const photoPositions: { x: number; y: number; w: number; h: number }[] = [];

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
          
          // Fill background for the slot first
          ctx.fillStyle = `${cfg.borderColor ?? '#1a1410'}18`;
          if ((el as any).borderStyle === 'ticket') {
            buildTicketPath(ctx, x, y, w, h, ((el as any).ticketHoleSize ?? 14) * scale);
          } else {
            ctx.beginPath();
            roundRect(ctx, x, y, w, h, el.borderRadius * scale);
          }
          ctx.fill();

          const hasImage = photoIdx < photoImgs.length;
          if (hasImage) {
            const img = photoImgs[photoIdx]!;
            ctx.save();
            if ((el as any).borderStyle === 'ticket') {
              buildTicketPath(ctx, x, y, w, h, ((el as any).ticketHoleSize ?? 14) * scale);
            } else {
              ctx.beginPath();
              roundRect(ctx, x, y, w, h, el.borderRadius * scale);
            }
            ctx.clip();
            const imgRatio = img.width / img.height;
            const slotRatio = w / h;
            let dw = w, dh = h, dx = x, dy = y;
            if (imgRatio > slotRatio) { dh = h; dw = h * imgRatio; dx = x - (dw - w) / 2; }
            else { dw = w; dh = w / imgRatio; dy = y - (dh - h) / 2; }
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
            photoPositions.push({ x, y, w, h });
            photoIdx++;
          }

          // Draw border on top
          const photoEl = el as any;
          if (photoEl.borderWidth !== undefined) {
            if (photoEl.borderWidth > 0 || photoEl.borderStyle === 'ticket') {
              if (photoEl.borderWidth > 0 && photoEl.borderStyle !== 'ticket') {
                  ctx.strokeStyle = photoEl.borderColor || '#000000';
                  ctx.lineWidth = photoEl.borderWidth * scale;
                  if (photoEl.borderStyle === 'dashed') ctx.setLineDash([15 * scale, 10 * scale]);
                  else if (photoEl.borderStyle === 'dotted') {
                    ctx.setLineDash([6 * scale, 12 * scale]);
                    ctx.lineCap = 'round';
                  } else {
                    ctx.setLineDash([]);
                  }
                  roundRect(ctx, x, y, w, h, el.borderRadius * scale);
                  ctx.stroke();
              }
            }
          } else if (!hasImage) {
            ctx.strokeStyle = `${cfg.borderColor ?? '#1a1410'}40`;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            roundRect(ctx, x, y, w, h, el.borderRadius * scale);
            ctx.stroke();
          }
          ctx.setLineDash([]);
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

        if (el.type === 'date') {
          const d = el as any;
          ctx.save();
          ctx.fillStyle = d.color;
          ctx.font = `bold ${d.fontSize * scale}px "${d.font}", serif`;
          ctx.textAlign = d.align === 'left' ? 'left' : d.align === 'right' ? 'right' : 'center';
          const textX = d.align === 'left' ? x : d.align === 'right' ? x + w : x + w / 2;
          const text = formatDate(new Date(), d.format || 'MMM DD, YYYY');
          ctx.fillText(text, textX, y + d.fontSize * scale + 8);
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
              const imgRatio = img.width / img.height;
              const slotRatio = w / h;
              let dw = w, dh = h, dx = x, dy = y;
              if (imgRatio > slotRatio) { dw = w; dh = w / imgRatio; dy = y + (h - dh) / 2; }
              else { dh = h; dw = h * imgRatio; dx = x + (w - dw) / 2; }
              ctx.drawImage(img, dx, dy, dw, dh);
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

      if (cfg.borderStyle === 'ticket') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const r = (cfg.ticketHoleSize ?? 14) * scale;
        const spacing = Math.max(r * 2, Math.round(r * 2.8));
        ctx.beginPath();
        for (let x = spacing / 2; x < OUT_W; x += spacing) {
          ctx.moveTo(x + r, 0); ctx.arc(x, 0, r, 0, Math.PI * 2);
          ctx.moveTo(x + r, OUT_H); ctx.arc(x, OUT_H, r, 0, Math.PI * 2);
        }
        for (let y = spacing / 2; y < OUT_H; y += spacing) {
          ctx.moveTo(r, y); ctx.arc(0, y, r, 0, Math.PI * 2);
          ctx.moveTo(OUT_W + r, y); ctx.arc(OUT_W, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      setStripDataUrl(canvas.toDataURL('image/png'));
      return;
    }

    // Legacy layout-based rendering
    const PHOTO_W = 400;
    const isGrid = frame.layout === 'grid-2x2';
    const is2 = frame.layout === 'strip-2';
    const photoAR = isGrid ? 1 : 4 / 3;
    const PHOTO_H = Math.round(PHOTO_W / photoAR);
    const PADDING = 15;
    const HOLE_SIZE = 9;
    const HOLE_MARGIN = 7;

    let stripW: number, stripH: number;
    if (isGrid) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H * 2 + PADDING * 3 + 45;
    } else if (is2) {
      stripW = PHOTO_W * 2 + PADDING * 3;
      stripH = PHOTO_H + PADDING * 2 + 45 + (HOLE_SIZE + HOLE_MARGIN) * 2;
    } else {
      stripW = PHOTO_W + PADDING * 2 + (HOLE_SIZE + HOLE_MARGIN) * 2;
      stripH = PHOTO_H * photos.length + PADDING * (photos.length + 1) + 45;
    }

    canvas.width = stripW;
    canvas.height = stripH;

    ctx.fillStyle = frame.color;
    ctx.fillRect(0, 0, stripW, stripH);
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, stripW - 6, stripH - 6);

    const imgs = await Promise.all(photos.map(src => loadImage(src)));
    const photoPositions: { x: number; y: number; w: number; h: number }[] = [];

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
        photoPositions.push({ x, y, w: PHOTO_W, h: PHOTO_H });
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
        photoPositions.push({ x, y, w: PHOTO_W, h: PHOTO_H });
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
        photoPositions.push({ x, y, w, h: PHOTO_H });
      });
    }

    setStripDataUrl(canvas.toDataURL('image/png'));
  }, [photos, frame, roundRect, loadImage]);

  useEffect(() => { renderStrip(); }, [renderStrip]);

  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-6">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Preview</p>
        <h2 className="font-display text-3xl font-bold">Review Your Strip</h2>
        <p className="mt-2 opacity-60 text-sm">Below you can click to retake any photo</p>
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Strip preview */}
        <div className="animate-slideUp">
          <div style={{
            display: 'inline-block',
            boxShadow: frame.config?.borderStyle === 'ticket' ? 'none' : `0 24px 80px ${frame.borderColor}30, 0 8px 24px rgba(0,0,0,0.1)`,
            filter: frame.config?.borderStyle === 'ticket' ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))' : 'none',
            transform: 'rotate(-0.5deg)',
          }}>
            <canvas
              ref={canvasRef}
              style={{ 
                display: 'block', 
                maxWidth: '100%',
                filter: 'sepia(8%) contrast(1.03)',
              }}
            />
          </div>
        </div>

        {/* Photo thumbnails */}
        <div className="flex gap-3 justify-center flex-wrap">
          {photos.map((photo, i) => {
            let currentAspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
            if (frame.config?.elements) {
              const photoSlots = frame.config.elements.filter(el => el.type === 'photo');
              const targetPhoto = photoSlots[i] || photoSlots[0];
              if (targetPhoto && targetPhoto.width && targetPhoto.height) {
                currentAspectRatio = targetPhoto.width / targetPhoto.height;
              }
            }

            return (
              <button
                key={i}
                onClick={() => onRetakePhoto(i)}
                className="relative group transition-transform hover:scale-105"
                style={{
                  width: 80,
                  aspectRatio: String(currentAspectRatio),
                borderRadius: 6,
                overflow: 'hidden',
                border: `2px solid ${frame.borderColor}`,
                background: 'var(--surface-2)',
              }}
            >
              <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                  Retake
                </span>
              </div>
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {i + 1}
              </div>
            </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-sm font-medium text-sm tracking-wide transition-all hover:opacity-75 bg-primary text-primary-foreground hover:opacity-90"
          >
            Continue to Edit →
          </button>
        </div>
      </div>
    </div>
  );
}
