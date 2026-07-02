import { Frame } from './frames';

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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
}

export function buildTicketPath(
  ctx: CanvasRenderingContext2D, 
  x: number, y: number, w: number, h: number, r: number
) {
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
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Draws a frame onto a canvas context using elements-based configuration.
 * @param ctx The canvas 2D context
 * @param canvasWidth The width of the canvas
 * @param canvasHeight The height of the canvas
 * @param frame The frame configuration
 * @param photoSources An array of images or videos to draw into the photo slots
 * @param mirrorVideo If true, videos will be mirrored horizontally
 */
export async function drawFrameElements(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  frame: Frame,
  photoSources: (HTMLImageElement | HTMLVideoElement | null)[],
  mirrorVideo = false
) {
  const cfg = frame.config;
  if (!cfg || !cfg.elements || cfg.elements.length === 0) return;

  const fw = cfg.width ?? 400;
  const fh = cfg.height ?? 600;
  const scale = canvasWidth / fw;

  // Background
  const bgType = cfg.bgType ?? 'solid';
  if (bgType === 'gradient') {
    const angle = ((cfg.bgGradientAngle ?? 135) - 90) * (Math.PI / 180);
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
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
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (bgType === 'image' && cfg.bgImage) {
    try {
      const bgImg = await loadImage(cfg.bgImage);
      const imgRatio = bgImg.width / bgImg.height;
      const canvasRatio = canvasWidth / canvasHeight;
      let dw = canvasWidth, dh = canvasHeight, dx = 0, dy = 0;
      if (imgRatio > canvasRatio) { dh = canvasHeight; dw = canvasHeight * imgRatio; dx = (canvasWidth - dw) / 2; }
      else { dw = canvasWidth; dh = canvasWidth / imgRatio; dy = (canvasHeight - dh) / 2; }
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } catch {
      ctx.fillStyle = cfg.color ?? frame.color;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  } else {
    ctx.fillStyle = cfg.color ?? frame.color;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  if (cfg.borderStyle !== 'ticket') {
    ctx.save();
    ctx.strokeStyle = cfg.borderColor ?? frame.borderColor;
    ctx.lineWidth = 4 * scale;
    if (cfg.borderStyle === 'dashed') ctx.setLineDash([15 * scale, 10 * scale]);
    else if (cfg.borderStyle === 'dotted') {
      ctx.setLineDash([6 * scale, 12 * scale]);
      ctx.lineCap = 'round';
    }
    ctx.strokeRect(3 * scale, 3 * scale, canvasWidth - 6 * scale, canvasHeight - 6 * scale);
    ctx.restore();
  }

  // Accent bars
  const accentSz = cfg.accentSize ?? 4;
  ctx.fillStyle = cfg.accentColor ?? frame.accentColor;
  ctx.fillRect(0, 0, canvasWidth, accentSz * scale);
  ctx.fillRect(0, canvasHeight - accentSz * scale, canvasWidth, accentSz * scale);

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

      // Fill background for the slot first
      ctx.fillStyle = `${cfg.borderColor ?? '#1a1410'}18`;
      if ((el as any).borderStyle === 'ticket') {
        buildTicketPath(ctx, x, y, w, h, ((el as any).ticketHoleSize ?? 14) * scale);
      } else {
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, el.borderRadius * scale);
      }
      ctx.fill();

      const hasSource = photoIdx < photoSources.length && photoSources[photoIdx] !== null;
      if (hasSource) {
        const source = photoSources[photoIdx]!;
        
        // Ensure source has dimensions before drawing
        const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
        const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

        if (srcW > 0 && srcH > 0) {
            ctx.save();
            if ((el as any).borderStyle === 'ticket') {
              buildTicketPath(ctx, x, y, w, h, ((el as any).ticketHoleSize ?? 14) * scale);
            } else {
              ctx.beginPath();
              roundRect(ctx, x, y, w, h, el.borderRadius * scale);
            }
            ctx.clip();
            const sourceRatio = srcW / srcH;
            const slotRatio = w / h;
            let dw = w, dh = h, dx = x, dy = y;
            if (sourceRatio > slotRatio) { dh = h; dw = h * sourceRatio; dx = x - (dw - w) / 2; }
            else { dw = w; dh = w / sourceRatio; dy = y - (dh - h) / 2; }
            
            if (mirrorVideo && source instanceof HTMLVideoElement) {
              ctx.translate(dx + dw / 2, dy + dh / 2);
              ctx.scale(-1, 1);
              ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
            }
            ctx.drawImage(source, dx, dy, dw, dh);
            ctx.restore();
        }
        photoIdx++;
      } else {
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
      } else if (!hasSource) {
        ctx.strokeStyle = `${cfg.borderColor ?? '#1a1410'}40`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        roundRect(ctx, x, y, w, h, el.borderRadius * scale);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (el.type === 'title') {
      ctx.save();
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontSize * scale}px "${el.font}", serif`;
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
    for (let x = spacing / 2; x < canvasWidth; x += spacing) {
      ctx.moveTo(x + r, 0); ctx.arc(x, 0, r, 0, Math.PI * 2);
      ctx.moveTo(x + r, canvasHeight); ctx.arc(x, canvasHeight, r, 0, Math.PI * 2);
    }
    for (let y = spacing / 2; y < canvasHeight; y += spacing) {
      ctx.moveTo(r, y); ctx.arc(0, y, r, 0, Math.PI * 2);
      ctx.moveTo(canvasWidth + r, y); ctx.arc(canvasWidth, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}
