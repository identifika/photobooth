'use client';
import type { FrameConfig, FrameElement, FramePhotoElement, FrameTitleElement, FrameStickerElement, FrameEmojiElement, FrameImageElement } from '@/lib/frame-types';

const DEFAULT_W = 400;
const DEFAULT_H = 600;

function repeatEmoji(emoji: string, count: number, max = 40): string {
  return Array.from({ length: Math.min(Math.max(count, 0), max) }, () => emoji).join('');
}

interface Props {
  config: FrameConfig;
  scale?: number;
}

export default function FramePreview({ config, scale = 0.5 }: Props) {
  const w = config.width ?? DEFAULT_W;
  const h = config.height ?? DEFAULT_H;
  const elements = (config.elements ?? []) as FrameElement[];
  const accentSize = config.accentSize ?? 4;

  const resolvedBg = (): string => {
    const bgType = config.bgType ?? 'solid';
    if (bgType === 'gradient') return `linear-gradient(${config.bgGradientAngle ?? 135}deg, ${config.bgGradientFrom ?? '#f5f0e8'}, ${config.bgGradientTo ?? '#e8dfd0'})`;
    if (bgType === 'image' && config.bgImage) return `url(${config.bgImage}) center/cover no-repeat`;
    return config.color ?? '#f5f0e8';
  };

  const getTicketMask = (size: number = 14) => {
    const r = Math.max(2, size);
    const spacing = Math.max(r * 2, Math.round(r * 2.8));
    const strip = r + 1;
    return {
      maskImage: `
              linear-gradient(black, black),
              radial-gradient(circle at ${spacing / 2}px 0, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at ${spacing / 2}px ${strip}px, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at 0 ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at ${strip}px ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px)
          `.replace(/\n/g, ''),
      WebkitMaskImage: `
              linear-gradient(black, black),
              radial-gradient(circle at ${spacing / 2}px 0, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at ${spacing / 2}px ${strip}px, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at 0 ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px),
              radial-gradient(circle at ${strip}px ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px)
          `.replace(/\n/g, ''),
      maskSize: `calc(100% - ${strip * 2}px) calc(100% - ${strip * 2}px), ${spacing}px ${strip}px, ${spacing}px ${strip}px, ${strip}px ${spacing}px, ${strip}px ${spacing}px`,
      WebkitMaskSize: `calc(100% - ${strip * 2}px) calc(100% - ${strip * 2}px), ${spacing}px ${strip}px, ${spacing}px ${strip}px, ${strip}px ${spacing}px, ${strip}px ${spacing}px`,
      maskPosition: `center, top left, bottom left, top left, top right`,
      WebkitMaskPosition: `center, top left, bottom left, top left, top right`,
      maskRepeat: `no-repeat, repeat-x, repeat-x, repeat-y, repeat-y`,
      WebkitMaskRepeat: `no-repeat, repeat-x, repeat-x, repeat-y, repeat-y`,
    };
  };

  return (
    <div style={{ width: w * scale, height: h * scale, flexShrink: 0 }}>
      <div
        style={{
          width: w,
          height: h,
          background: resolvedBg(),
          border: config.borderStyle === 'ticket' ? 'none' : `${config.borderWidth ?? 3}px ${config.borderStyle || 'solid'} ${config.borderColor ?? '#1a1410'}`,
          ...(config.borderStyle === 'ticket' ? getTicketMask(config.ticketHoleSize ?? 14) : {}),
          filter: config.borderStyle === 'ticket' ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'none',
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Accent top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: accentSize, background: config.accentColor ?? '#c9a84c' }} />

        {elements.map((el) => {
          const base: React.CSSProperties = {
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.width,
            height: el.height,
            opacity: (el as any).opacity !== undefined ? (el as any).opacity : 1,
          };

          if (el.type === 'photo') {
            const photoEl = el as FramePhotoElement;
            const borderStyleStr = photoEl.borderStyle || 'solid';
            const borderStyle = photoEl.borderWidth !== undefined
              ? (photoEl.borderWidth === 0 || photoEl.borderStyle === 'ticket' ? 'none' : `${photoEl.borderWidth}px ${borderStyleStr} ${photoEl.borderColor || '#000000'}`)
              : `1.5px dashed ${config.borderColor ?? '#1a1410'}60`;
            return (
              <div key={el.id} style={{
                ...base,
                background: `${config.borderColor ?? '#1a1410'}18`,
                border: borderStyle,
                ...(photoEl.borderStyle === 'ticket' ? getTicketMask(photoEl.ticketHoleSize ?? 14) : {}),
                borderRadius: photoEl.borderRadius,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: config.borderColor ?? '#1a1410', opacity: 0.5,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              }}>📷</div>
            );
          }

          if (el.type === 'title') {
            const t = el as FrameTitleElement;
            return (
              <div key={el.id} style={{
                ...base,
                display: 'flex', alignItems: 'center',
                justifyContent: t.align === 'left' ? 'flex-start' : t.align === 'right' ? 'flex-end' : 'center',
                fontFamily: `'${t.font}', serif`,
                fontSize: t.fontSize,
                color: t.color,
                fontWeight: 700,
                textAlign: t.align,
                userSelect: 'none',
              }}>
                {t.text || 'Title'}
              </div>
            );
          }

          if (el.type === 'image') {
            const img = el as FrameImageElement;
            return (
              <div key={el.id} style={{ ...base, overflow: 'hidden', borderRadius: 4 }}>
                {img.src ? (
                  <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: img.objectFit }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af' }}>🖼</div>
                )}
              </div>
            );
          }

          if (el.type === 'emoji') {
            const row = el as FrameEmojiElement;
            const count = Math.floor(el.width / Math.max(1, row.spacing));
            return (
              <div key={el.id} style={{
                ...base,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', whiteSpace: 'nowrap',
                fontSize: 18, letterSpacing: `${row.spacing}px`, userSelect: 'none',
              }}>
                {repeatEmoji(row.emoji, count)}
              </div>
            );
          }

          if (el.type === 'sticker') {
            const st = el as FrameStickerElement;
            const fontSize = Math.min(st.width, st.height) * 0.8;
            return (
              <div key={el.id} style={{
                ...base,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize, lineHeight: 1, userSelect: 'none',
                transform: st.rotation ? `rotate(${st.rotation}deg)` : undefined,
              }}>
                {st.emoji}
              </div>
            );
          }

          return null;
        })}

        {/* Accent bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: accentSize, background: config.accentColor ?? '#c9a84c' }} />
      </div>
    </div>
  );
}