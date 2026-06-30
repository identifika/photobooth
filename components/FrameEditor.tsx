'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { uploadFrameImage } from '@/lib/uploadFrameImage';
import type {
    FrameConfig,
    FrameElement,
    FramePhotoElement,
    FrameTitleElement,
    FrameImageElement,
    FrameEmojiElement,
    FrameStickerElement,
    LayoutType,
} from '@/lib/frame-types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ── Constants ──

const DEFAULT_W = 400;
const DEFAULT_H = 600;
const RULER_SIZE = 16;
const SNAP_THRESHOLD = 4;
const MIN_FRAME_SIZE = 100;
const MAX_FRAME_SIZE = 1200;

const FONTS = [
    'Playfair Display', 'DM Sans', 'Inter', 'Poppins', 'Lato',
    'Roboto', 'Georgia', 'Pacifico', 'Dancing Script', 'Courier New',
];

const POPULAR_EMOJIS = [
    '📷', '🎞', '💕', '🌿', '🌊', '🖤', '🌅', '💜', '📺', '🌙',
    '🌸', '🍃', '✨', '⚡', '🌲', '🩷', '🐚', '🏜️', '🩶', '🌌',
    '🍋', '🍬', '🪸', '🎉', '🎊', '💖', '⭐', '🔥', '🦋', '🌻',
    '🎀', '💍', '🎂', '🎈', '🌈', '☀️', '💫', '🎶', '🕊', '👑',
];

// Layout presets. NOTE: extend `LayoutType` in `@/lib/frame-types` to include
// these values for full type-safety; until then they're cast at the call site.
type LocalLayoutType = LayoutType | 'grid_3x3' | 'strip_2_v' | 'strip_5' | 'grid_2x3' | 'big_top' | 'big_left';

const LAYOUT_PRESETS: { value: LocalLayoutType; label: string; icon: string }[] = [
    { value: 'single', label: '1P', icon: '⬜' },
    { value: 'strip_2', label: '2P', icon: '▫️▫️' },
    { value: 'strip_2_v', label: '2P ↕', icon: '▫️\n▫️' },
    { value: 'strip_3', label: '3P', icon: '▫️▫️▫️' },
    { value: 'strip_4', label: '4P', icon: '▫️▫️▫️▫️' },
    { value: 'strip_5', label: '5P', icon: '▫️▫️▫️▫️▫️' },
    { value: 'grid_2x2', label: '2×2', icon: '▫️▫️\n▫️▫️' },
    { value: 'grid_2x3', label: '2×3', icon: '▫️▫️\n▫️▫️\n▫️▫️' },
    { value: 'grid_3x3', label: '3×3', icon: '▫️▫️▫️\n▫️▫️▫️\n▫️▫️▫️' },
    { value: 'big_top', label: 'Big+2', icon: '⬜\n▫️▫️' },
    { value: 'big_left', label: 'Big+2 ↔', icon: '⬛▫️\n  ▫️' },
];

const ROTATION_PRESETS = [0, 45, 90, 135, -45, -90] as const;

const FRAME_PRESETS = [
    { label: 'Portrait 2:3', w: 400, h: 600 },
    { label: 'Square 1:1', w: 500, h: 500 },
    { label: 'Landscape 3:2', w: 600, h: 400 },
    { label: 'Story 9:16', w: 360, h: 640 },
    { label: 'Tall 3:4', w: 450, h: 600 },
] as const;

const ALIGN_OPTIONS = [
    { type: 'left' as const, label: '⬅', title: 'Align Left' },
    { type: 'center-h' as const, label: '↔', title: 'Center Horizontal' },
    { type: 'right' as const, label: '➡', title: 'Align Right' },
    { type: 'top' as const, label: '⬆', title: 'Align Top' },
    { type: 'center-v' as const, label: '↕', title: 'Center Vertical' },
    { type: 'bottom' as const, label: '⬇', title: 'Align Bottom' },
];

type AlignType = typeof ALIGN_OPTIONS[number]['type'];

const LAYER_TYPE_ICON: Record<string, string> = {
    photo: '📷', title: '✏️', image: '🖼', emoji: '✨', sticker: '🌟',
};
const LAYER_TYPE_LABEL: Record<string, string> = {
    photo: 'Photo Slot', title: 'Title', image: 'Image', emoji: 'Emoji Row', sticker: 'Sticker',
};

type AnyElement = FrameElement;

interface SnapGuide {
    axis: 'x' | 'y';
    value: number;
}

// ── Small shared UI primitives ──

function PanelLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
    return <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{children}</label>;
}

function FieldLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
    return <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{children}</label>;
}

function ColorField({ value, placeholder, onChange, isDark }: { value: string; placeholder?: string; onChange: (v: string) => void; isDark?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded border shrink-0" />
            <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="flex-1 text-xs" />
        </div>
    );
}

function XYFields({ x, y, onX, onY, isDark }: { x: number; y: number; onX: (v: number) => void; onY: (v: number) => void; isDark: boolean }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div><FieldLabel isDark={isDark}>X</FieldLabel><Input type="number" value={x} onChange={(e) => onX(+e.target.value)} /></div>
            <div><FieldLabel isDark={isDark}>Y</FieldLabel><Input type="number" value={y} onChange={(e) => onY(+e.target.value)} /></div>
        </div>
    );
}

function WHFields({ w, h, onW, onH, isDark, wLabel = 'Width', hLabel = 'Height' }: {
    w: number; h: number; onW: (v: number) => void; onH: (v: number) => void; isDark: boolean; wLabel?: string; hLabel?: string;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div><FieldLabel isDark={isDark}>{wLabel}</FieldLabel><Input type="number" value={w} onChange={(e) => onW(+e.target.value)} /></div>
            <div><FieldLabel isDark={isDark}>{hLabel}</FieldLabel><Input type="number" value={h} onChange={(e) => onH(+e.target.value)} /></div>
        </div>
    );
}

function EmojiPickerRow({ value, onPick, isDark }: { value: string; onPick: (e: string) => void; isDark: boolean }) {
    return (
        <div className="flex flex-wrap gap-1">
            {POPULAR_EMOJIS.map((e) => (
                <button key={e} onClick={() => onPick(e)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm transition ${value === e ? 'bg-gray-900 text-white' : (isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100')}`}>
                    {e}
                </button>
            ))}
        </div>
    );
}

function AlignmentTools({ onAlign, isDark }: { onAlign: (type: AlignType) => void; isDark: boolean }) {
    return (
        <div>
            <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Align to Canvas</p>
            <div className="grid grid-cols-3 gap-1">
                {ALIGN_OPTIONS.map((a) => (
                    <button key={a.type} onClick={() => onAlign(a.type)} title={a.title}
                        className={`rounded border py-1.5 text-sm transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                        {a.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function LayerControls({ index, total, onFront, onBack, onForward, onBackward, isDark }: {
    index: number; total: number; onFront: () => void; onBack: () => void; onForward: () => void; onBackward: () => void; isDark: boolean;
}) {
    const isTop = index === total - 1;
    const isBottom = index === 0;
    const btnCls = `rounded border py-1 text-[11px] transition disabled:opacity-30 ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'}`;
    return (
        <div>
            <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                Layer <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>({index + 1}/{total})</span>
            </p>
            <div className="grid grid-cols-2 gap-1">
                <button onClick={onFront} disabled={isTop} title="Bring to Front" className={btnCls}>⬆⬆ Front</button>
                <button onClick={onBack} disabled={isBottom} title="Send to Back" className={btnCls}>⬇⬇ Back</button>
                <button onClick={onForward} disabled={isTop} title="Bring Forward" className={btnCls}>⬆ Forward</button>
                <button onClick={onBackward} disabled={isBottom} title="Send Backward" className={btnCls}>⬇ Backward</button>
            </div>
        </div>
    );
}

function RotationControl({ value, onChange, isDark }: { value: number; onChange: (v: number) => void; isDark: boolean }) {
    return (
        <div>
            <SliderInput label="Rotation" value={value} min={-180} max={180} unit="°" onChange={onChange} isDark={isDark} />
            <div className="flex gap-1 mt-1 flex-wrap">
                {ROTATION_PRESETS.map((deg) => (
                    <button key={deg} onClick={() => onChange(deg)}
                        className={`flex-1 rounded border text-[10px] py-0.5 transition min-w-[28px] ${value === deg ? (isDark ? 'bg-slate-400 text-slate-900 border-slate-400' : 'bg-gray-900 text-white border-gray-900') : (isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                        {deg}°
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Ruler components ──

function HRuler({ width, cursorX }: { width: number; cursorX: number | null }) {
    const h = RULER_SIZE;
    const ticks: React.ReactNode[] = [];
    for (let x = 0; x <= width; x += 10) {
        const isMajor = x % 50 === 0;
        ticks.push(<line key={x} x1={x} y1={isMajor ? 0 : h / 2} x2={x} y2={h} stroke="#94a3b8" strokeWidth={0.5} />);
        if (isMajor && x > 0)
            ticks.push(<text key={`t${x}`} x={x + 2} y={h - 3} fontSize={7} fill="#64748b">{x}</text>);
    }
    return (
        <svg width={width} height={h} style={{ display: 'block', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {ticks}
            {cursorX !== null && <line x1={cursorX} y1={0} x2={cursorX} y2={h} stroke="#3b82f6" strokeWidth={1} />}
        </svg>
    );
}

function VRuler({ height, cursorY }: { height: number; cursorY: number | null }) {
    const w = RULER_SIZE;
    const ticks: React.ReactNode[] = [];
    for (let y = 0; y <= height; y += 10) {
        const isMajor = y % 50 === 0;
        ticks.push(<line key={y} x1={isMajor ? 0 : w / 2} y1={y} x2={w} y2={y} stroke="#94a3b8" strokeWidth={0.5} />);
        if (isMajor && y > 0)
            ticks.push(<text key={`t${y}`} x={1} y={y - 2} fontSize={7} fill="#64748b" transform={`rotate(-90, 1, ${y - 2})`}>{y}</text>);
    }
    return (
        <svg width={w} height={height} style={{ display: 'block', background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
            {ticks}
            {cursorY !== null && <line x1={0} y1={cursorY} x2={w} y2={cursorY} stroke="#3b82f6" strokeWidth={1} />}
        </svg>
    );
}

// ── Canvas resize handles (8-point) ──

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function CanvasResizeHandles({
    onEdgeDown,
}: {
    onEdgeDown: (e: React.PointerEvent, edge: ResizeEdge) => void;
}) {
    const SZ = 8;
    const HALF = SZ / 2;

    const handles: { edge: ResizeEdge; style: React.CSSProperties }[] = [
        { edge: 'n', style: { top: -HALF, left: '50%', transform: 'translateX(-50%)', width: 24, height: SZ, cursor: 'n-resize' } },
        { edge: 's', style: { bottom: -HALF, left: '50%', transform: 'translateX(-50%)', width: 24, height: SZ, cursor: 's-resize' } },
        { edge: 'e', style: { right: -HALF, top: '50%', transform: 'translateY(-50%)', width: SZ, height: 24, cursor: 'e-resize' } },
        { edge: 'w', style: { left: -HALF, top: '50%', transform: 'translateY(-50%)', width: SZ, height: 24, cursor: 'w-resize' } },
        { edge: 'ne', style: { top: -HALF, right: -HALF, width: SZ, height: SZ, cursor: 'ne-resize' } },
        { edge: 'nw', style: { top: -HALF, left: -HALF, width: SZ, height: SZ, cursor: 'nw-resize' } },
        { edge: 'se', style: { bottom: -HALF, right: -HALF, width: SZ, height: SZ, cursor: 'se-resize' } },
        { edge: 'sw', style: { bottom: -HALF, left: -HALF, width: SZ, height: SZ, cursor: 'sw-resize' } },
    ];

    return (
        <>
            {handles.map(({ edge, style }) => (
                <div
                    key={edge}
                    style={{ position: 'absolute', background: '#3b82f6', borderRadius: 2, zIndex: 300, ...style }}
                    onPointerDown={(e) => onEdgeDown(e, edge)}
                />
            ))}
        </>
    );
}

// ── Overlays ──

function SnapGuides({ guides }: { guides: SnapGuide[] }) {
    return (
        <>
            {guides.map((g, i) =>
                g.axis === 'x'
                    ? <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: g.value, width: 1, background: '#f43f5e', pointerEvents: 'none', zIndex: 100 }} />
                    : <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: g.value, height: 1, background: '#f43f5e', pointerEvents: 'none', zIndex: 100 }} />,
            )}
        </>
    );
}

function DimensionBadge({ el }: { el: AnyElement }) {
    return (
        <div style={{
            position: 'absolute', left: el.x, top: el.y - 20,
            background: '#1e293b', color: '#f1f5f9', fontSize: 10, fontFamily: 'monospace',
            padding: '1px 5px', borderRadius: 3, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 200,
        }}>
            {Math.round(el.width)} × {Math.round(el.height)}
        </div>
    );
}

function MarginLines({ el, canvasW, canvasH }: { el: AnyElement; canvasW: number; canvasH: number }) {
    const right = canvasW - el.x - el.width;
    const bottom = canvasH - el.y - el.height;
    const line = (axis: 'h' | 'v', pos: React.CSSProperties): React.CSSProperties => ({
        position: 'absolute', background: '#f43f5e', opacity: 0.4, pointerEvents: 'none', zIndex: 99,
        ...(axis === 'h' ? { height: 1 } : { width: 1 }), ...pos,
    });
    const badge = (text: string, style: React.CSSProperties) => (
        <div style={{ position: 'absolute', zIndex: 101, pointerEvents: 'none', background: '#f43f5e', color: '#fff', fontSize: 9, fontFamily: 'monospace', padding: '0 3px', borderRadius: 2, ...style }}>{text}</div>
    );
    return (
        <>
            {el.x > 0 && <><div style={line('h', { top: el.y + el.height / 2, left: 0, width: el.x })} />{badge(`${el.x}`, { top: el.y + el.height / 2 - 8, left: el.x / 2 - 6 })}</>}
            {right > 0 && <><div style={line('h', { top: el.y + el.height / 2, left: el.x + el.width, width: right })} />{badge(`${Math.round(right)}`, { top: el.y + el.height / 2 - 8, left: el.x + el.width + right / 2 - 6 })}</>}
            {el.y > 0 && <><div style={line('v', { left: el.x + el.width / 2, top: 0, height: el.y })} />{badge(`${el.y}`, { left: el.x + el.width / 2 + 3, top: el.y / 2 - 7 })}</>}
            {bottom > 0 && <><div style={line('v', { left: el.x + el.width / 2, top: el.y + el.height, height: bottom })} />{badge(`${Math.round(bottom)}`, { left: el.x + el.width / 2 + 3, top: el.y + el.height + bottom / 2 - 7 })}</>}
        </>
    );
}

// ── SliderInput ──

function SliderInput({ label, value, min, max, step = 1, unit = '', onChange, isDark = false }: {
    label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; isDark?: boolean;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-0.5">
                <label className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{label}</label>
                <span className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{value}{unit}</span>
            </div>
            <div className="flex items-center gap-2">
                <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-1.5 accent-blue-500 cursor-pointer" />
                <Input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-16 text-xs text-center" />
            </div>
        </div>
    );
}

// ── Helpers ──

function uid(): string { return Math.random().toString(36).slice(2, 10); }

function getDefaultTitleColor(): string { return '#1a1410'; }

function makePhotoSlot(id: string, x: number, y: number, w: number, h: number): FramePhotoElement {
    return { id, type: 'photo', x, y, width: w, height: h, borderRadius: 4, rotation: 0 };
}
function makeTitleElement(id: string, x: number, y: number, text: string): FrameTitleElement {
    return { id, type: 'title', x, y, width: 200, height: 40, text, font: 'Playfair Display', color: getDefaultTitleColor(), fontSize: 24, align: 'center' };
}
function makeImageElement(id: string, x: number, y: number): FrameImageElement {
    return { id, type: 'image', x, y, width: 100, height: 60, src: '', objectFit: 'contain' };
}
function makeEmojiRowElement(id: string, x: number, y: number, emoji: string): FrameEmojiElement & { rotation?: number } {
    return { id, type: 'emoji', x, y, width: DEFAULT_W, height: 30, emoji, spacing: 24 };
}
function makeStickerElement(id: string, x: number, y: number, emoji: string): FrameStickerElement {
    return { id, type: 'sticker', x, y, width: 48, height: 48, emoji, rotation: 0 };
}

function centerPhotoGroup(photos: FramePhotoElement[], canvasW: number, canvasH: number): FramePhotoElement[] {
    if (photos.length === 0) return photos;
    const minX = Math.min(...photos.map((p) => p.x));
    const maxX = Math.max(...photos.map((p) => p.x + p.width));
    const minY = Math.min(...photos.map((p) => p.y));
    const maxY = Math.max(...photos.map((p) => p.y + p.height));
    const groupW = maxX - minX;
    const groupH = maxY - minY;
    const dx = (canvasW - groupW) / 2 - minX;
    const dy = (canvasH - groupH) / 2 - minY;
    return photos.map((p) => ({ ...p, x: Math.round(p.x + dx), y: Math.round(p.y + dy) }));
}

function applyLayout(layout: LocalLayoutType, existing: AnyElement[], canvasW: number, canvasH: number): AnyElement[] {
    const nonPhotos = existing.filter((e) => e.type !== 'photo');
    const pad = 20, gap = 8;
    let photos: FramePhotoElement[] = [];
    if (layout === 'single') {
        const w = canvasW - pad * 2, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h)];
    } else if (layout === 'strip_2') {
        const w = (canvasW - pad * 2 - gap) / 2, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h)];
    } else if (layout === 'strip_2_v') {
        const w = canvasW - pad * 2, h = (canvasH - pad - 60 - gap) / 2 - pad / 2;
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad, pad + 60 + h + gap, w, h)];
    } else if (layout === 'strip_3') {
        const w = (canvasW - pad * 2 - gap * 2) / 3, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h), makePhotoSlot(uid(), pad + (w + gap) * 2, pad + 60, w, h)];
    } else if (layout === 'strip_4') {
        const w = canvasW - pad * 2, h = Math.round((w * 3 / 4) * 0.4);
        photos = Array.from({ length: 4 }, (_, i) => makePhotoSlot(uid(), pad, pad + 60 + i * (h + gap), w, h));
    } else if (layout === 'strip_5') {
        const w = (canvasW - pad * 2 - gap * 4) / 5, h = Math.round(w * 3 / 4);
        photos = Array.from({ length: 5 }, (_, i) => makePhotoSlot(uid(), pad + i * (w + gap), pad + 60, w, h));
    } else if (layout === 'grid_2x2') {
        const w = (canvasW - pad * 2 - gap) / 2, h = w;
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h), makePhotoSlot(uid(), pad, pad + 60 + h + gap, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60 + h + gap, w, h)];
    } else if (layout === 'grid_2x3') {
        const w = (canvasW - pad * 2 - gap) / 2, h = (canvasH - pad - 60 - gap * 2) / 3;
        photos = Array.from({ length: 6 }, (_, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            return makePhotoSlot(uid(), pad + col * (w + gap), pad + 60 + row * (h + gap), w, h);
        });
    } else if (layout === 'grid_3x3') {
        const w = (canvasW - pad * 2 - gap * 2) / 3, h = w;
        photos = Array.from({ length: 9 }, (_, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            return makePhotoSlot(uid(), pad + col * (w + gap), pad + 60 + row * (h + gap), w, h);
        });
    } else if (layout === 'big_top') {
        const bigW = canvasW - pad * 2, bigH = Math.round(bigW * 0.55);
        const smallW = (canvasW - pad * 2 - gap) / 2, smallH = Math.round(smallW * 0.75);
        photos = [
            makePhotoSlot(uid(), pad, pad + 60, bigW, bigH),
            makePhotoSlot(uid(), pad, pad + 60 + bigH + gap, smallW, smallH),
            makePhotoSlot(uid(), pad + smallW + gap, pad + 60 + bigH + gap, smallW, smallH),
        ];
    } else if (layout === 'big_left') {
        const availH = canvasH - pad - 60;
        const bigW = Math.round((canvasW - pad * 2 - gap) * 0.6), bigH = availH;
        const smallW = canvasW - pad * 2 - gap - bigW, smallH = (availH - gap) / 2;
        photos = [
            makePhotoSlot(uid(), pad, pad + 60, bigW, bigH),
            makePhotoSlot(uid(), pad + bigW + gap, pad + 60, smallW, smallH),
            makePhotoSlot(uid(), pad + bigW + gap, pad + 60 + smallH + gap, smallW, smallH),
        ];
    }
    photos = centerPhotoGroup(photos, canvasW, canvasH);
    return [...nonPhotos, ...photos];
}

function repeatEmoji(emoji: string, count: number, max = 40): string {
    return Array.from({ length: Math.min(Math.max(count, 0), max) }, () => emoji).join('');
}

function elementLabel(el: AnyElement): string {
    if (el.type === 'title') {
        const text = (el as FrameTitleElement).text?.trim();
        return text ? text.slice(0, 24) : 'Title';
    }
    if (el.type === 'sticker' || el.type === 'emoji') {
        const emoji = (el as any).emoji;
        return emoji ? `${LAYER_TYPE_LABEL[el.type]} ${emoji}` : LAYER_TYPE_LABEL[el.type];
    }
    return LAYER_TYPE_LABEL[el.type] ?? el.type;
}

function computeSnap(movingId: string, candidateX: number, candidateY: number, width: number, height: number, elements: AnyElement[], canvasW: number, canvasH: number): { x: number; y: number; guides: SnapGuide[] } {
    const cL = candidateX, cR = candidateX + width, cCX = candidateX + width / 2;
    const cT = candidateY, cB = candidateY + height, cCY = candidateY + height / 2;
    const xLines: number[] = [0, canvasW / 2, canvasW];
    const yLines: number[] = [0, canvasH / 2, canvasH];
    for (const el of elements) {
        if (el.id === movingId) continue;
        xLines.push(el.x, el.x + el.width / 2, el.x + el.width);
        yLines.push(el.y, el.y + el.height / 2, el.y + el.height);
    }
    let snapX = candidateX, snapY = candidateY;
    const guides: SnapGuide[] = [];
    for (const refX of xLines) {
        if (Math.abs(cL - refX) <= SNAP_THRESHOLD) { snapX = refX; guides.push({ axis: 'x', value: refX }); break; }
        if (Math.abs(cCX - refX) <= SNAP_THRESHOLD) { snapX = refX - width / 2; guides.push({ axis: 'x', value: refX }); break; }
        if (Math.abs(cR - refX) <= SNAP_THRESHOLD) { snapX = refX - width; guides.push({ axis: 'x', value: refX }); break; }
    }
    for (const refY of yLines) {
        if (Math.abs(cT - refY) <= SNAP_THRESHOLD) { snapY = refY; guides.push({ axis: 'y', value: refY }); break; }
        if (Math.abs(cCY - refY) <= SNAP_THRESHOLD) { snapY = refY - height / 2; guides.push({ axis: 'y', value: refY }); break; }
        if (Math.abs(cB - refY) <= SNAP_THRESHOLD) { snapY = refY - height; guides.push({ axis: 'y', value: refY }); break; }
    }
    return { x: Math.round(snapX), y: Math.round(snapY), guides };
}

// ── Props ──

interface Props {
    config: FrameConfig;
    onChange: (config: FrameConfig) => void;
    frameName: string;
    onNameChange: (name: string) => void;
    frameEmoji?: string;
    onEmojiChange?: (emoji: string) => void;
    categoryId: string;
    onCategoryChange: (id: string) => void;
    sortOrder: string;
    onSortOrderChange: (v: string) => void;
    categories: { id: string; name: string }[];
    onSave: () => void;
    onCancel: () => void;
    isEdit: boolean;
}

// ── Component ──

const getTicketMask = (size: number = 14) => {
    const r = Math.max(2, size);
    const spacing = Math.max(r * 2, Math.round(r * 2.8));
    const strip = r + 1;
    const mask = `
        linear-gradient(black, black),
        radial-gradient(circle at ${spacing / 2}px 0, transparent ${r}px, black ${r + 0.5}px),
        radial-gradient(circle at ${spacing / 2}px ${strip}px, transparent ${r}px, black ${r + 0.5}px),
        radial-gradient(circle at 0 ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px),
        radial-gradient(circle at ${strip}px ${spacing / 2}px, transparent ${r}px, black ${r + 0.5}px)
    `.replace(/\n/g, '');
    return {
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: `calc(100% - ${strip * 2}px) calc(100% - ${strip * 2}px), ${spacing}px ${strip}px, ${spacing}px ${strip}px, ${strip}px ${spacing}px, ${strip}px ${spacing}px`,
        WebkitMaskSize: `calc(100% - ${strip * 2}px) calc(100% - ${strip * 2}px), ${spacing}px ${strip}px, ${spacing}px ${strip}px, ${strip}px ${spacing}px, ${strip}px ${spacing}px`,
        maskPosition: `center, top left, bottom left, top left, top right`,
        WebkitMaskPosition: `center, top left, bottom left, top left, top right`,
        maskRepeat: `no-repeat, repeat-x, repeat-x, repeat-y, repeat-y`,
        WebkitMaskRepeat: `no-repeat, repeat-x, repeat-x, repeat-y, repeat-y`,
    };
};

export default function FrameEditor({
    config, onChange, frameName, onNameChange, frameEmoji, onEmojiChange,
    onSave, onCancel, isEdit,
}: Props) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const canvasRef = useRef<HTMLDivElement>(null);
    const centerPanelRef = useRef<HTMLDivElement>(null);

    const { user } = useAuth();
    const currentUserId = user?.uid || 'anonymous';
    const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
    const [bgUploading, setBgUploading] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const [clipboard, setClipboard] = useState<AnyElement | null>(null);

    // ── Undo/Redo history ──
    const historyRef = useRef<FrameConfig[]>([]);
    const futureRef = useRef<FrameConfig[]>([]);
    const [historyTick, setHistoryTick] = useState(0); // forces re-render so undo/redo buttons reflect availability

    const pushHistory = useCallback(() => {
        historyRef.current.push(JSON.parse(JSON.stringify(config)));
        futureRef.current = [];
        if (historyRef.current.length > 50) historyRef.current.shift();
        setHistoryTick((t) => t + 1);
    }, [config]);

    const undo = useCallback(() => {
        if (historyRef.current.length === 0) return;
        futureRef.current.push(JSON.parse(JSON.stringify(config)));
        const prev = historyRef.current.pop()!;
        onChange(prev);
        setHistoryTick((t) => t + 1);
    }, [config, onChange]);

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return;
        historyRef.current.push(JSON.parse(JSON.stringify(config)));
        const next = futureRef.current.pop()!;
        onChange(next);
        setHistoryTick((t) => t + 1);
    }, [config, onChange]);

    const canUndo = historyRef.current.length > 0;
    const canRedo = futureRef.current.length > 0;

    const [dragging, setDragging] = useState<{
        id: string; startX: number; startY: number; origX: number; origY: number;
    } | null>(null);

    const [resizing, setResizing] = useState<{
        id: string; startX: number; startY: number; origW: number; origH: number;
    } | null>(null);

    const [frameResizing, setFrameResizing] = useState<{
        edge: ResizeEdge; startX: number; startY: number; origW: number; origH: number;
    } | null>(null);

    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
    const pointerDownOnElement = useRef(false);

    // ── Layers panel drag-reorder state ──
    const [layersCollapsed, setLayersCollapsed] = useState(false);
    const [layerDragId, setLayerDragId] = useState<string | null>(null);
    const [layerOverId, setLayerOverId] = useState<string | null>(null);
    const layerDragPos = useRef<'above' | 'below'>('above');

    // ── Zoom state ──
    const [zoom, setZoom] = useState(1);
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 3;
    const ZOOM_STEP = 0.1;
    const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
    const zoomReset = useCallback(() => setZoom(1), []);

    // ── Background ──
    type BgType = 'solid' | 'gradient' | 'image';
    const bgType: BgType = config.bgType ?? 'solid';
    const bgGradientFrom: string = config.bgGradientFrom ?? '#f5f0e8';
    const bgGradientTo: string = config.bgGradientTo ?? '#e8dfd0';
    const bgGradientAngle: number = config.bgGradientAngle ?? 135;
    const bgImage: string = config.bgImage ?? '';

    const setBgType = (t: BgType) => onChange({ ...config, bgType: t });
    const setBgGradientFrom = (v: string) => onChange({ ...config, bgGradientFrom: v });
    const setBgGradientTo = (v: string) => onChange({ ...config, bgGradientTo: v });
    const setBgGradientAngle = (v: number) => onChange({ ...config, bgGradientAngle: v });
    const setBgImage = (v: string) => onChange({ ...config, bgImage: v });

    const resolvedBg = (): string => {
        if (bgType === 'gradient') return `linear-gradient(${bgGradientAngle}deg, ${bgGradientFrom}, ${bgGradientTo})`;
        if (bgType === 'image' && bgImage) return `url(${bgImage}) center/cover no-repeat`;
        return config.color ?? '#f5f0e8';
    };

    // Ctrl/Cmd + scroll wheel zoom
    useEffect(() => {
        const el = centerPanelRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setZoom((z) => {
                const next = z - e.deltaY * 0.005;
                return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +next.toFixed(2)));
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const elements = (config.elements ?? []) as AnyElement[];
    const selected = selectedId ? elements.find((e) => e.id === selectedId) ?? null : null;

    const canvasW: number = (config as any).width ?? DEFAULT_W;
    const canvasH: number = (config as any).height ?? DEFAULT_H;
    const setCanvasDims = (w: number, h: number) =>
        onChange({ ...config, width: Math.max(MIN_FRAME_SIZE, Math.min(MAX_FRAME_SIZE, Math.round(w))), height: Math.max(MIN_FRAME_SIZE, Math.min(MAX_FRAME_SIZE, Math.round(h))) } as any);

    const accentSize: number = (config as any).accentSize ?? 4;
    const setAccentSize = (v: number) => onChange({ ...config, accentSize: v } as any);

    const getScale = useCallback(() => {
        const el = canvasRef.current;
        if (!el) return { sx: 1 / zoom, sy: 1 / zoom };
        const rect = el.getBoundingClientRect();
        return { sx: canvasW / (rect.width / zoom), sy: canvasH / (rect.height / zoom) };
    }, [canvasW, canvasH, zoom]);

    const updateElements = useCallback(
        (next: AnyElement[]) => onChange({ ...config, elements: next as FrameElement[] }),
        [config, onChange],
    );

    const updateElement = useCallback(
        (id: string, patch: Partial<AnyElement>) => {
            updateElements(elements.map((e) => (e.id === id ? { ...e, ...patch } as AnyElement : e)));
        },
        [elements, updateElements],
    );

    // ── Layer ordering ──
    const bringToFront = useCallback((id: string) => {
        pushHistory();
        const el = elements.find((e) => e.id === id);
        if (!el) return;
        updateElements([...elements.filter((e) => e.id !== id), el]);
    }, [elements, pushHistory, updateElements]);

    const sendToBack = useCallback((id: string) => {
        pushHistory();
        const el = elements.find((e) => e.id === id);
        if (!el) return;
        updateElements([el, ...elements.filter((e) => e.id !== id)]);
    }, [elements, pushHistory, updateElements]);

    const bringForward = useCallback((id: string) => {
        pushHistory();
        const idx = elements.findIndex((e) => e.id === id);
        if (idx < 0 || idx === elements.length - 1) return;
        const next = [...elements];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        updateElements(next);
    }, [elements, pushHistory, updateElements]);

    const sendBackward = useCallback((id: string) => {
        pushHistory();
        const idx = elements.findIndex((e) => e.id === id);
        if (idx <= 0) return;
        const next = [...elements];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        updateElements(next);
    }, [elements, pushHistory, updateElements]);

    // ── Layers panel — drag-to-reorder ──
    // elements[] is stored back-to-front (later index paints on top).
    // The panel displays front-to-back, so we reverse for display and convert back on reorder.
    const handleLayerDrop = useCallback((targetId: string) => {
        if (!layerDragId || layerDragId === targetId) { setLayerDragId(null); setLayerOverId(null); return; }
        const stacked = [...elements].reverse();
        const fromIdx = stacked.findIndex((el) => el.id === layerDragId);
        let toIdx = stacked.findIndex((el) => el.id === targetId);
        if (fromIdx === -1 || toIdx === -1) { setLayerDragId(null); setLayerOverId(null); return; }
        if (layerDragPos.current === 'below') toIdx += 1;

        const next = [...stacked];
        const [moved] = next.splice(fromIdx, 1);
        const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        next.splice(adjustedToIdx, 0, moved);

        pushHistory();
        updateElements([...next].reverse());
        setLayerDragId(null);
        setLayerOverId(null);
    }, [layerDragId, elements, pushHistory, updateElements]);

    const toggleElementVisibility = useCallback((id: string) => {
        pushHistory();
        updateElements(elements.map((e) => (e.id === id ? { ...e, hidden: !(e as any).hidden } as AnyElement : e)));
    }, [elements, pushHistory, updateElements]);

    const deleteElementById = useCallback((id: string) => {
        pushHistory();
        updateElements(elements.filter((e) => e.id !== id));
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, [elements, pushHistory, updateElements]);

    // ── Alignment ──
    const alignSelected = useCallback((type: AlignType) => {
        if (selectedIds.size === 0) return;
        pushHistory();
        updateElements(elements.map((el) => {
            if (!selectedIds.has(el.id)) return el;
            switch (type) {
                case 'left': return { ...el, x: 0 };
                case 'center-h': return { ...el, x: Math.round((canvasW - el.width) / 2) };
                case 'right': return { ...el, x: canvasW - el.width };
                case 'top': return { ...el, y: 0 };
                case 'center-v': return { ...el, y: Math.round((canvasH - el.height) / 2) };
                case 'bottom': return { ...el, y: canvasH - el.height };
                default: return el;
            }
        }));
    }, [selectedIds, elements, canvasW, canvasH, pushHistory, updateElements]);

    // ── Element drag ──
    const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
        e.stopPropagation(); e.preventDefault();
        pointerDownOnElement.current = true;

        if (e.shiftKey || e.metaKey) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            });
            return;
        }

        if (!selectedIds.has(id)) setSelectedIds(new Set([id]));

        const el = elements.find((x) => x.id === id);
        if (!el) return;
        pushHistory();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDragging({ id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
    }, [elements, pushHistory, selectedIds]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        const { sx, sy } = getScale();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) setCursor({ x: Math.round((e.clientX - rect.left) * sx), y: Math.round((e.clientY - rect.top) * sy) });

        if (dragging) {
            const dx = (e.clientX - dragging.startX) * sx;
            const dy = (e.clientY - dragging.startY) * sy;
            const el = elements.find((x) => x.id === dragging.id);
            if (!el) return;
            const rawX = Math.max(0, Math.min(canvasW - el.width, dragging.origX + dx));
            const rawY = Math.max(0, Math.min(canvasH - el.height, dragging.origY + dy));
            const { x, y, guides } = computeSnap(dragging.id, rawX, rawY, el.width, el.height, elements, canvasW, canvasH);
            setSnapGuides(guides);
            updateElement(dragging.id, { x, y });
        }

        if (resizing) {
            const dx = (e.clientX - resizing.startX) * sx;
            const dy = (e.clientY - resizing.startY) * sy;
            updateElement(resizing.id, {
                width: Math.round(Math.max(20, resizing.origW + dx)),
                height: Math.round(Math.max(20, resizing.origH + dy)),
            });
        }
    }, [dragging, resizing, getScale, updateElement, elements, canvasW, canvasH]);

    const onPointerUp = useCallback(() => { setDragging(null); setResizing(null); setSnapGuides([]); }, []);
    const onPointerLeave = useCallback(() => { if (!dragging && !resizing) setCursor(null); }, [dragging, resizing]);

    const onResizeDown = useCallback((e: React.PointerEvent, id: string) => {
        e.stopPropagation(); e.preventDefault();
        pointerDownOnElement.current = true;
        const el = elements.find((x) => x.id === id);
        if (!el) return;
        pushHistory();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setResizing({ id, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height });
    }, [elements, pushHistory]);

    const onCanvasClick = useCallback((e: React.MouseEvent) => {
        if (pointerDownOnElement.current) { pointerDownOnElement.current = false; return; }
        if (e.target === e.currentTarget) setSelectedIds(new Set());
    }, []);

    const onCenterPanelMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) setSelectedIds(new Set());
    }, []);

    // ── Frame (canvas) resize via handles ──
    const onFrameEdgeDown = useCallback((e: React.PointerEvent, edge: ResizeEdge) => {
        e.stopPropagation(); e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setFrameResizing({ edge, startX: e.clientX, startY: e.clientY, origW: canvasW, origH: canvasH });
    }, [canvasW, canvasH]);

    useEffect(() => {
        if (!frameResizing) return;
        const onMove = (e: PointerEvent) => {
            const dx = e.clientX - frameResizing.startX;
            const dy = e.clientY - frameResizing.startY;
            const { edge, origW, origH } = frameResizing;
            let newW = origW, newH = origH;
            if (edge.includes('e')) newW = origW + dx;
            if (edge.includes('w')) newW = origW - dx;
            if (edge.includes('s')) newH = origH + dy;
            if (edge.includes('n')) newH = origH - dy;
            setCanvasDims(newW, newH);
        };
        const onUp = () => setFrameResizing(null);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    }, [frameResizing]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            const mod = e.ctrlKey || e.metaKey;

            if (e.key === 'Escape') { setSelectedIds(new Set()); return; }

            if (mod && e.key === 'z' && !e.shiftKey && !isTyping) { e.preventDefault(); undo(); return; }
            if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && !isTyping) { e.preventDefault(); redo(); return; }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !isTyping) {
                pushHistory();
                updateElements(elements.filter((el) => !selectedIds.has(el.id)));
                setSelectedIds(new Set());
                return;
            }

            if (mod && e.key === 'c' && selectedId && !isTyping) {
                const el = elements.find((x) => x.id === selectedId);
                if (el) { setClipboard(el); e.preventDefault(); }
                return;
            }
            if (mod && e.key === 'v' && clipboard && !isTyping) {
                e.preventDefault();
                pushHistory();
                const newEl: AnyElement = { ...clipboard, id: uid(), x: clipboard.x + 16, y: clipboard.y + 16 };
                updateElements([...elements, newEl]);
                setSelectedIds(new Set([newEl.id]));
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0 && !isTyping) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                pushHistory();
                updateElements(elements.map((el) => {
                    if (!selectedIds.has(el.id)) return el;
                    switch (e.key) {
                        case 'ArrowUp': return { ...el, y: Math.max(0, el.y - step) };
                        case 'ArrowDown': return { ...el, y: Math.min(canvasH - el.height, el.y + step) };
                        case 'ArrowLeft': return { ...el, x: Math.max(0, el.x - step) };
                        case 'ArrowRight': return { ...el, x: Math.min(canvasW - el.width, el.x + step) };
                        default: return el;
                    }
                }));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedId, selectedIds, clipboard, elements, updateElements, undo, redo, pushHistory, canvasW, canvasH]);

    // ── Add element handlers ──
    const addPhoto = () => { pushHistory(); const el = makePhotoSlot(uid(), 50, 80, 150, 112); updateElements([...elements, el]); setSelectedIds(new Set([el.id])); };
    const addTitle = () => { pushHistory(); const el = makeTitleElement(uid(), 100, 20, 'Your Title'); updateElements([...elements, el]); setSelectedIds(new Set([el.id])); };
    const addImage = () => { pushHistory(); const el = makeImageElement(uid(), 50, 300); updateElements([...elements, el]); setSelectedIds(new Set([el.id])); };
    const addEmojiRow = () => { pushHistory(); const el = makeEmojiRowElement(uid(), 0, canvasH - 60, '✨'); updateElements([...elements, el]); setSelectedIds(new Set([el.id])); };
    const addSticker = (emoji = '✨') => {
        pushHistory();
        const el = makeStickerElement(uid(), canvasW / 2 - 24, canvasH / 2 - 24, emoji);
        updateElements([...elements, el]);
        setSelectedIds(new Set([el.id]));
    };

    const deleteSelected = () => {
        if (selectedIds.size === 0) return;
        pushHistory();
        updateElements(elements.filter((e) => !selectedIds.has(e.id)));
        setSelectedIds(new Set());
    };

    const copySelected = () => { if (selected) setClipboard(selected); };

    const pasteClipboard = () => {
        if (!clipboard) return;
        pushHistory();
        const newEl: AnyElement = { ...clipboard, id: uid(), x: clipboard.x + 16, y: clipboard.y + 16 };
        updateElements([...elements, newEl]);
        setSelectedIds(new Set([newEl.id]));
    };

    const handleLayoutPreset = (layout: LocalLayoutType) => { pushHistory(); updateElements(applyLayout(layout, elements, canvasW, canvasH)); };

    const handleImageUpload = async (file: File, elementId: string) => {
        try {
            setUploadingIds((prev) => new Set(prev).add(elementId));
            const url = await uploadFrameImage(file, 'frame-elements', currentUserId);
            updateElement(elementId, { src: url } as any);
        } catch (error: any) {
            alert(error.message || 'Upload failed');
        } finally {
            setUploadingIds((prev) => {
                const next = new Set(prev);
                next.delete(elementId);
                return next;
            });
        }
    };

    // ── Render element ──
    const renderElement = (el: AnyElement) => {
        if ((el as any).hidden) return null;
        const isSelected = selectedIds.has(el.id);
        const elRotation = (el as any).rotation ?? 0;
        const opacity = (el as any).opacity !== undefined ? (el as any).opacity : 1;

        const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: el.x, top: el.y, width: el.width, height: el.height,
            cursor: dragging?.id === el.id ? 'grabbing' : 'grab',
            outline: isSelected ? '2px solid #3b82f6' : 'none',
            outlineOffset: 2,
            zIndex: isSelected ? 10 : 1,
            opacity,
        };

        const rotatedStyle: React.CSSProperties = elRotation !== 0
            ? { ...baseStyle, transform: `rotate(${elRotation}deg)`, transformOrigin: 'center center' }
            : baseStyle;

        const resizeHandle = isSelected ? (
            <div
                style={{ position: 'absolute', right: -4, bottom: -4, width: 10, height: 10, background: '#3b82f6', borderRadius: 2, cursor: 'nwse-resize' }}
                onPointerDown={(e) => onResizeDown(e, el.id)}
            />
        ) : null;

        if (el.type === 'photo') {
            const photoEl = el as FramePhotoElement;
            const borderStyleStr = photoEl.borderStyle || 'solid';
            const borderStyle = photoEl.borderWidth !== undefined
                ? (photoEl.borderWidth === 0 || photoEl.borderStyle === 'ticket' ? 'none' : `${photoEl.borderWidth}px ${borderStyleStr} ${photoEl.borderColor || '#000000'}`)
                : `1.5px dashed ${config.borderColor ?? '#1a1410'}60`;
            return (
                <div key={el.id} style={{
                    ...rotatedStyle,
                    background: `${config.borderColor ?? '#1a1410'}18`,
                    border: borderStyle,
                    ...(photoEl.borderStyle === 'ticket' ? getTicketMask(photoEl.ticketHoleSize ?? 14) : {}),
                    borderRadius: photoEl.borderRadius,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: config.borderColor ?? '#1a1410', opacity: opacity * 0.5,
                }} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
                    📷{resizeHandle}
                </div>
            );
        }
        if (el.type === 'title') {
            const t = el as FrameTitleElement;
            return (
                <div key={el.id} style={{
                    ...baseStyle,
                    display: 'flex', alignItems: 'center',
                    justifyContent: t.align === 'left' ? 'flex-start' : t.align === 'right' ? 'flex-end' : 'center',
                    fontFamily: `'${t.font}', serif`, fontSize: t.fontSize, color: t.color,
                    fontWeight: 700, textAlign: t.align, pointerEvents: dragging ? 'none' : 'auto', userSelect: 'none',
                }} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
                    {t.text || 'Title'}{resizeHandle}
                </div>
            );
        }
        if (el.type === 'image') {
            const img = el as FrameImageElement;
            return (
                <div key={el.id} style={{ ...baseStyle, overflow: 'hidden', border: isSelected ? 'none' : '1px dashed #ccc', borderRadius: 4 }}
                    onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
                    {img.src
                        ? <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: img.objectFit, pointerEvents: 'none' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', color: '#9ca3af', fontSize: 11 }}>🖼 Image</div>
                    }
                    {resizeHandle}
                </div>
            );
        }
        if (el.type === 'emoji') {
            const row = el as FrameEmojiElement & { rotation?: number };
            const count = Math.floor(el.width / Math.max(1, row.spacing));
            return (
                <div key={el.id} style={{
                    ...rotatedStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', whiteSpace: 'nowrap',
                    fontSize: 18, letterSpacing: `${row.spacing}px`, userSelect: 'none',
                }} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
                    {repeatEmoji(row.emoji, count)}{resizeHandle}
                </div>
            );
        }
        if (el.type === 'sticker') {
            const st = el as FrameStickerElement;
            const fontSize = Math.min(st.width, st.height) * 0.8;
            return (
                <div key={el.id} style={{
                    ...rotatedStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize, lineHeight: 1, userSelect: 'none',
                    border: isSelected ? '1.5px dashed #3b82f680' : 'none',
                    borderRadius: 4,
                }} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
                    {st.emoji}{resizeHandle}
                </div>
            );
        }
        return null;
    };

    const selectedOpacity = selected ? ((selected as any).opacity ?? 1) : 1;
    const selectedLayerIdx = selectedId ? elements.findIndex((e) => e.id === selectedId) : -1;

    return (
        <div className="flex h-full">
            {/* ── Left: Toolbar ── */}
            <div className="w-48 border-r p-4 space-y-4 overflow-y-auto bg-surface-2">
                <div>
                    <PanelLabel isDark={isDark}>Frame Meta</PanelLabel>
                    <div className="flex gap-2">
                        <div className="w-12 shrink-0">
                            <Input value={frameEmoji || ''} onChange={(e) => onEmojiChange?.(e.target.value)} placeholder="✨" className="w-full text-center px-1" maxLength={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <Input value={frameName} onChange={(e) => onNameChange(e.target.value)} placeholder="Frame name" className="w-full" />
                        </div>
                    </div>
                </div>

                <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <PanelLabel isDark={isDark}>Add Elements</PanelLabel>
                    <div className="space-y-1">
                        <Button variant="outline" size="sm" onClick={addPhoto} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>📷 Photo Slot</Button>
                        <Button variant="outline" size="sm" onClick={addTitle} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>✏️ Title Text</Button>
                        <Button variant="outline" size="sm" onClick={addImage} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>🖼 Image</Button>
                        <Button variant="outline" size="sm" onClick={addEmojiRow} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>✨ Emoji Row</Button>
                        <Button variant="outline" size="sm" onClick={() => addSticker('✨')} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>🌟 Emoji Sticker</Button>
                    </div>
                </div>

                <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <button
                        onClick={() => setLayersCollapsed((c) => !c)}
                        className={`mb-2 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider transition ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <span>Layers {elements.length > 0 && <span className="font-mono normal-case opacity-60">({elements.length})</span>}</span>
                        <span className={`text-[10px] transition-transform ${layersCollapsed ? '-rotate-90' : ''}`}>▾</span>
                    </button>

                    {!layersCollapsed && (
                        elements.length === 0 ? (
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                No elements yet. Add one above to see it here.
                            </p>
                        ) : (
                            <div className={`space-y-0.5 max-h-56 overflow-y-auto rounded-md border ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                {[...elements].reverse().map((el) => {
                                    const isSelected = selectedIds.has(el.id);
                                    const isDragTarget = layerOverId === el.id && layerDragId !== el.id;
                                    const isHidden = (el as any).hidden === true;

                                    return (
                                        <div
                                            key={el.id}
                                            draggable
                                            onDragStart={(e) => { setLayerDragId(el.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.id); }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                if (el.id === layerDragId) return;
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                layerDragPos.current = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
                                                setLayerOverId(el.id);
                                            }}
                                            onDrop={() => handleLayerDrop(el.id)}
                                            onDragEnd={() => { setLayerDragId(null); setLayerOverId(null); }}
                                            onClick={(e) => {
                                                if (e.shiftKey || e.metaKey) {
                                                    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(el.id)) next.delete(el.id); else next.add(el.id); return next; });
                                                } else {
                                                    setSelectedIds(new Set([el.id]));
                                                }
                                            }}
                                            className={[
                                                'group flex items-center gap-1.5 px-1.5 py-1 text-xs cursor-pointer select-none transition relative',
                                                isSelected ? (isDark ? 'bg-slate-600/60' : 'bg-blue-50') : (isDark ? 'hover:bg-slate-700/60' : 'hover:bg-gray-50'),
                                                layerDragId === el.id ? 'opacity-40' : '',
                                                isDragTarget && layerDragPos.current === 'above' ? 'border-t-2 border-blue-500' : '',
                                                isDragTarget && layerDragPos.current === 'below' ? 'border-b-2 border-blue-500' : '',
                                            ].join(' ')}
                                        >
                                            <span className={`cursor-grab active:cursor-grabbing px-0.5 ${isDark ? 'text-slate-500' : 'text-gray-300'}`} title="Drag to reorder">⠿</span>
                                            <span className="text-[13px] leading-none shrink-0">{LAYER_TYPE_ICON[el.type] ?? '◻️'}</span>
                                            <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''} ${isDark ? 'text-slate-200' : 'text-gray-700'} ${isHidden ? 'opacity-40 italic' : ''}`}>
                                                {elementLabel(el)}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleElementVisibility(el.id); }}
                                                title={isHidden ? 'Show' : 'Hide'}
                                                className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] opacity-0 group-hover:opacity-100 transition ${isHidden ? 'opacity-100' : ''} ${isDark ? 'hover:bg-slate-600' : 'hover:bg-gray-200'}`}
                                            >
                                                {isHidden ? '🚫' : '👁'}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteElementById(el.id); }}
                                                title="Delete"
                                                className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] opacity-0 group-hover:opacity-100 transition text-red-500 ${isDark ? 'hover:bg-red-900/40' : 'hover:bg-red-50'}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                    {!layersCollapsed && elements.length > 0 && (
                        <p className={`mt-1.5 text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            Top = front. Drag ⠿ to reorder, click 👁 to hide.
                        </p>
                    )}
                </div>

                <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <PanelLabel isDark={isDark}>Layout Presets</PanelLabel>
                    <div className="grid grid-cols-3 gap-1">
                        {LAYOUT_PRESETS.map((p) => (
                            <button key={p.value} onClick={() => handleLayoutPreset(p.value)} className={`flex flex-col items-center justify-center rounded-md border py-1.5 px-1 text-xs transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'} overflow-hidden`}>
                                <span className="text-[10px] whitespace-pre-line leading-[1.1] tracking-widest text-center">{p.icon}</span>
                                <span className="mt-1 font-medium text-[11px] whitespace-nowrap">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <div className={`border-t pt-3 space-y-1 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                        {selectedId && (
                            <Button variant="outline" size="sm" onClick={copySelected}
                                className={`w-full justify-between text-xs ${isDark ? 'border-slate-600' : ''}`}>
                                <span>📋 Copy</span>
                                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌘C</span>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={deleteSelected}
                            className={`w-full justify-between text-xs text-red-600 ${isDark ? 'hover:bg-red-900/30 border-slate-600' : 'hover:bg-red-50'}`}>
                            <span>🗑 Delete{selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌫</span>
                        </Button>
                    </div>
                )}

                {clipboard && (
                    <div className={selectedIds.size > 0 ? '' : `border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                        <Button variant="outline" size="sm" onClick={pasteClipboard}
                            className={`w-full justify-between text-xs ${isDark ? 'border-slate-600' : ''}`}>
                            <span>📌 Paste <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>({clipboard.type})</span></span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌘V</span>
                        </Button>
                    </div>
                )}

                <p className={`text-[10px] text-center pt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    Esc · click outside = deselect<br />
                    ⇧+click = multi-select<br />
                    ↑↓←→ nudge · ⇧+arrow = 10px
                </p>
            </div>

            {/* ── Center: Canvas + Rulers ── */}
            <div
                ref={centerPanelRef}
                className={`flex-1 flex flex-col overflow-auto ${isDark ? 'bg-slate-900' : 'bg-gray-100'}`}
                onMouseDown={onCenterPanelMouseDown}
            >
                <div className={`flex items-center justify-center gap-2 py-2 px-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                    <button onClick={zoomOut} className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Zoom Out">−</button>
                    <button onClick={zoomReset} className={`px-2 h-7 rounded border text-[11px] font-mono transition min-w-[48px] ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Reset Zoom">
                        {Math.round(zoom * 100)}%
                    </button>
                    <button onClick={zoomIn} className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Zoom In">+</button>
                    <span className={`text-[10px] ml-2 ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Ctrl+scroll to zoom</span>
                    <div className="ml-auto flex gap-1">
                        <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition disabled:opacity-30 ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`}>↩</button>
                        <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)" className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition disabled:opacity-30 ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`}>↪</button>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                    <div
                        style={{ position: 'relative', width: (canvasW + RULER_SIZE) * zoom, height: (canvasH + RULER_SIZE) * zoom, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, width: RULER_SIZE, height: RULER_SIZE, background: '#f1f5f9', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', zIndex: 10 }} />
                        <div style={{ position: 'absolute', top: 0, left: RULER_SIZE }}><HRuler width={canvasW} cursorX={cursor?.x ?? null} /></div>
                        <div style={{ position: 'absolute', top: RULER_SIZE, left: 0 }}><VRuler height={canvasH} cursorY={cursor?.y ?? null} /></div>

                        <div style={{ position: 'absolute', top: -22, left: RULER_SIZE, fontSize: 10, fontFamily: 'monospace', color: '#64748b', userSelect: 'none', pointerEvents: 'none' }}>
                            {canvasW} × {canvasH}px {frameResizing ? '(resizing…)' : ''}
                        </div>

                        <div style={{ position: 'absolute', top: RULER_SIZE, left: RULER_SIZE, width: canvasW, height: canvasH }}>
                            <CanvasResizeHandles onEdgeDown={onFrameEdgeDown} />

                            <div
                                ref={canvasRef}
                                className="relative shadow-lg"
                                style={{
                                    width: canvasW, height: canvasH,
                                    background: resolvedBg(),
                                    border: config.borderStyle === 'ticket' ? 'none' : `${config.borderWidth ?? 3}px ${config.borderStyle || 'solid'} ${config.borderColor ?? '#1a1410'}`,
                                    ...(config.borderStyle === 'ticket' ? getTicketMask(config.ticketHoleSize ?? 14) : {}),
                                    borderRadius: 4, overflow: 'hidden',
                                }}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerLeave={onPointerLeave}
                                onClick={onCanvasClick}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <div className="absolute top-0 left-0 right-0" style={{ height: accentSize, background: config.accentColor ?? '#c9a84c' }} />

                                {cursor && !dragging && !resizing && (
                                    <>
                                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: cursor.x, width: 1, background: '#3b82f6', opacity: 0.3, pointerEvents: 'none', zIndex: 50 }} />
                                        <div style={{ position: 'absolute', left: 0, right: 0, top: cursor.y, height: 1, background: '#3b82f6', opacity: 0.3, pointerEvents: 'none', zIndex: 50 }} />
                                        <div style={{ position: 'absolute', left: cursor.x + 6, top: cursor.y - 18, background: '#1e293b', color: '#f1f5f9', fontSize: 9, fontFamily: 'monospace', padding: '1px 4px', borderRadius: 2, pointerEvents: 'none', zIndex: 200, whiteSpace: 'nowrap' }}>
                                            {cursor.x}, {cursor.y}
                                        </div>
                                    </>
                                )}

                                <SnapGuides guides={snapGuides} />

                                {selected && !dragging && <><MarginLines el={selected} canvasW={canvasW} canvasH={canvasH} /><DimensionBadge el={selected} /></>}
                                {selected && dragging && <DimensionBadge el={selected} />}

                                {elements.map(renderElement)}

                                <div className="absolute bottom-0 left-0 right-0" style={{ height: accentSize, background: config.accentColor ?? '#c9a84c' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right: Properties Panel ── */}
            <div className="w-64 border-l p-4 space-y-4 overflow-y-auto bg-surface-2">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
                    {selectedIds.size > 1
                        ? `${selectedIds.size} Elements Selected`
                        : selected
                            ? `${selected.type.charAt(0).toUpperCase() + selected.type.slice(1)} Properties`
                            : 'Frame Style'}
                </h3>

                {/* ── Multi-select: shared alignment + delete ── */}
                {selectedIds.size > 1 && (
                    <div className="space-y-3">
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                            {selectedIds.size} elements selected. Use alignment tools or delete below.
                        </p>
                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <AlignmentTools onAlign={alignSelected} isDark={isDark} />
                        </div>
                        <Button variant="outline" size="sm" onClick={deleteSelected}
                            className={`w-full justify-center text-xs text-red-600 ${isDark ? 'hover:bg-red-900/30 border-slate-600' : 'hover:bg-red-50'}`}>
                            🗑 Delete {selectedIds.size} elements
                        </Button>
                    </div>
                )}

                {/* ── Frame Style (nothing selected) ── */}
                {!selected && selectedIds.size === 0 && (
                    <div className="space-y-3">
                        <div>
                            <PanelLabel isDark={isDark}>Background</PanelLabel>
                            <div className={`flex rounded-lg border overflow-hidden mb-2 ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
                                {(['solid', 'gradient', 'image'] as BgType[]).map((t) => (
                                    <button key={t} onClick={() => setBgType(t)}
                                        className={`flex-1 py-1 text-[11px] font-medium capitalize transition ${bgType === t ? (isDark ? 'bg-slate-400 text-slate-900' : 'bg-gray-900 text-white') : (isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50')}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {bgType === 'solid' && (
                                <ColorField value={config.color ?? '#f5f0e8'} onChange={(v) => onChange({ ...config, color: v })} isDark={isDark} />
                            )}

                            {bgType === 'gradient' && (
                                <div className="space-y-2">
                                    <ColorField value={bgGradientFrom} placeholder="From" onChange={setBgGradientFrom} isDark={isDark} />
                                    <ColorField value={bgGradientTo} placeholder="To" onChange={setBgGradientTo} isDark={isDark} />
                                    <SliderInput label="Angle" value={bgGradientAngle} min={0} max={360} unit="°" onChange={setBgGradientAngle} isDark={isDark} />
                                    <div className="h-8 rounded border overflow-hidden" style={{ background: `linear-gradient(${bgGradientAngle}deg, ${bgGradientFrom}, ${bgGradientTo})` }} />
                                </div>
                            )}

                            {bgType === 'image' && (
                                <div className="space-y-2">
                                    {bgImage ? (
                                        <div className="relative group">
                                            <div className="h-20 rounded border overflow-hidden flex items-center justify-center bg-gray-50">
                                                <img src={bgImage} alt="" className="max-h-full max-w-full object-cover w-full h-full" style={{ objectFit: 'cover' }} />
                                            </div>
                                            <button onClick={() => setBgImage('')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                        </div>
                                    ) : (
                                        <label className="flex h-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 transition">
                                            {bgUploading ? 'Uploading...' : 'Click to upload bg image'}
                                            <input type="file" accept="image/*" className="hidden" disabled={bgUploading} onChange={async (e) => {
                                                const f = e.target.files?.[0];
                                                if (f) {
                                                    setBgUploading(true);
                                                    try {
                                                        const url = await uploadFrameImage(f, 'frame-backgrounds', currentUserId);
                                                        setBgImage(url);
                                                    } catch (err: any) {
                                                        alert(err.message || 'Upload failed');
                                                    } finally {
                                                        setBgUploading(false);
                                                    }
                                                }
                                            }} />
                                        </label>
                                    )}
                                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Image fills the canvas (cover).</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <FieldLabel isDark={isDark}>Border</FieldLabel>
                            <div className="flex flex-col gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <FieldLabel isDark={isDark}>Border Color</FieldLabel>
                                        <ColorField value={config.borderColor ?? '#1a1410'} placeholder="#1a1410" onChange={(v) => onChange({ ...config, borderColor: v })} isDark={isDark} />
                                    </div>
                                    <div><FieldLabel isDark={isDark}>Border Width</FieldLabel><Input type="number" min={0} value={config.borderWidth ?? 3} onChange={(e) => onChange({ ...config, borderWidth: +e.target.value })} /></div>
                                    {config.borderStyle === 'ticket' && <div><FieldLabel isDark={isDark}>Ticket Hole Size</FieldLabel><Input type="number" min={2} value={config.ticketHoleSize ?? 14} onChange={(e) => onChange({ ...config, ticketHoleSize: +e.target.value })} /></div>}
                                </div>
                                <select
                                    value={config.borderStyle || 'solid'}
                                    onChange={(e) => onChange({ ...config, borderStyle: e.target.value as any })}
                                    className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-gray-300 text-gray-900'}`}
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                    <option value="ticket">Ticket Edge</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <FieldLabel isDark={isDark}>Accent</FieldLabel>
                            <ColorField value={config.accentColor ?? '#c9a84c'} onChange={(v) => onChange({ ...config, accentColor: v })} isDark={isDark} />
                        </div>

                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Accent Bar</p>
                            <SliderInput label="Height" value={accentSize} min={0} max={24} unit="px" onChange={setAccentSize} isDark={isDark} />
                            <div className={`mt-2 rounded overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
                                <div style={{ height: accentSize, background: config.accentColor ?? '#c9a84c', transition: 'height 0.1s' }} />
                                <div style={{ height: 10, background: config.color ?? '#f5f0e8' }} />
                                <div style={{ height: accentSize, background: config.accentColor ?? '#c9a84c', transition: 'height 0.1s' }} />
                            </div>
                            <p className="mt-1 text-center text-[10px] text-gray-400">preview</p>
                        </div>

                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Frame Size</p>
                            <p className={`mb-2 text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Drag the blue handles around the canvas, or enter values below.</p>
                            <div className="mb-2">
                                <WHFields w={canvasW} h={canvasH} onW={(v) => setCanvasDims(v, canvasH)} onH={(v) => setCanvasDims(canvasW, v)} isDark={isDark} />
                            </div>
                            <p className="mb-1 text-[10px] text-gray-400 font-medium">Presets</p>
                            <div className="space-y-1">
                                {FRAME_PRESETS.map((p) => (
                                    <button key={p.label} onClick={() => setCanvasDims(p.w, p.h)}
                                        className={`w-full flex items-center justify-between rounded border px-2 py-1 text-xs transition ${canvasW === p.w && canvasH === p.h ? (isDark ? 'bg-slate-400 text-slate-900 border-slate-400' : 'bg-gray-900 text-white border-gray-900') : (isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                                        <span>{p.label}</span>
                                        <span className="font-mono text-[10px] opacity-60">{p.w}×{p.h}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <FieldLabel isDark={isDark}>Description</FieldLabel>
                            <Input value={config.description ?? ''} onChange={(e) => onChange({ ...config, description: e.target.value })} placeholder="Short description" />
                        </div>

                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-400'}`}>Quick-add Sticker</p>
                            <p className={`mb-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Type any emoji or tap a quick pick below.</p>
                            <Input placeholder="Type or paste emoji…" className="flex-1 text-sm mb-2"
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { addSticker(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }} />
                            <EmojiPickerRow value="" onPick={addSticker} isDark={isDark} />
                        </div>
                    </div>
                )}

                {/* ── Single element selected ── */}
                {selected && selectedIds.size === 1 && (
                    <div className="space-y-3">
                        <AlignmentTools onAlign={alignSelected} isDark={isDark} />

                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <LayerControls
                                index={selectedLayerIdx}
                                total={elements.length}
                                onFront={() => bringToFront(selectedId!)}
                                onBack={() => sendToBack(selectedId!)}
                                onForward={() => bringForward(selectedId!)}
                                onBackward={() => sendBackward(selectedId!)}
                                isDark={isDark}
                            />
                        </div>

                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <SliderInput label="Opacity" value={Math.round(selectedOpacity * 100)} min={0} max={100} unit="%" isDark={isDark}
                                onChange={(v) => updateElement(selected.id, { opacity: v / 100 } as any)} />
                        </div>

                        {/* ── Photo properties ── */}
                        {selected.type === 'photo' && (() => {
                            const el = selected as FramePhotoElement;
                            const rot = (el as any).rotation ?? 0;
                            return (
                                <div className={`border-t pt-3 space-y-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <XYFields x={el.x} y={el.y} onX={(v) => updateElement(el.id, { x: v })} onY={(v) => updateElement(el.id, { y: v })} isDark={isDark} />
                                    <WHFields w={el.width} h={el.height} onW={(v) => updateElement(el.id, { width: v })} onH={(v) => updateElement(el.id, { height: v })} isDark={isDark} />
                                    <div><FieldLabel isDark={isDark}>Border Radius</FieldLabel><Input type="number" value={el.borderRadius} onChange={(e) => updateElement(el.id, { borderRadius: +e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FieldLabel isDark={isDark}>Border Color</FieldLabel>
                                            <ColorField value={el.borderColor || '#000000'} placeholder="None" onChange={(v) => updateElement(el.id, { borderColor: v } as any)} isDark={isDark} />
                                        </div>
                                        <div><FieldLabel isDark={isDark}>Border Width</FieldLabel><Input type="number" min={0} value={el.borderWidth || 0} onChange={(e) => updateElement(el.id, { borderWidth: +e.target.value } as any)} /></div>
                                        {el.borderStyle === 'ticket' && <div><FieldLabel isDark={isDark}>Ticket Hole Size</FieldLabel><Input type="number" min={2} value={el.ticketHoleSize ?? 14} onChange={(e) => updateElement(el.id, { ticketHoleSize: +e.target.value } as any)} /></div>}
                                    </div>
                                    <div>
                                        <FieldLabel isDark={isDark}>Border Style</FieldLabel>
                                        <select
                                            value={el.borderStyle || 'dashed'}
                                            onChange={(e) => updateElement(el.id, { borderStyle: e.target.value as any })}
                                            className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-gray-300 text-gray-900'}`}
                                        >
                                            <option value="solid">Solid</option>
                                            <option value="dashed">Dashed</option>
                                            <option value="dotted">Dotted</option>
                                            <option value="ticket">Ticket Edge</option>
                                        </select>
                                    </div>
                                    <div className={`border-t pt-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                        <RotationControl value={rot} onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Title properties ── */}
                        {selected.type === 'title' && (() => {
                            const el = selected as FrameTitleElement;
                            return (
                                <div className={`border-t pt-3 space-y-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <div><FieldLabel isDark={isDark}>Text</FieldLabel><Input value={el.text} onChange={(e) => updateElement(el.id, { text: e.target.value })} /></div>
                                    <div>
                                        <FieldLabel isDark={isDark}>Font</FieldLabel>
                                        <select value={el.font} onChange={(e) => updateElement(el.id, { font: e.target.value })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><FieldLabel isDark={isDark}>Size</FieldLabel><Input type="number" value={el.fontSize} onChange={(e) => updateElement(el.id, { fontSize: +e.target.value })} /></div>
                                        <div>
                                            <FieldLabel isDark={isDark}>Align</FieldLabel>
                                            <select value={el.align} onChange={(e) => updateElement(el.id, { align: e.target.value as 'left' | 'center' | 'right' })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <FieldLabel isDark={isDark}>Color</FieldLabel>
                                        <ColorField value={el.color} onChange={(v) => updateElement(el.id, { color: v })} isDark={isDark} />
                                    </div>
                                    <XYFields x={el.x} y={el.y} onX={(v) => updateElement(el.id, { x: v })} onY={(v) => updateElement(el.id, { y: v })} isDark={isDark} />
                                </div>
                            );
                        })()}

                        {/* ── Image properties ── */}
                        {selected.type === 'image' && (() => {
                            const el = selected as FrameImageElement;
                            return (
                                <div className={`border-t pt-3 space-y-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <div>
                                        <FieldLabel isDark={isDark}>Image</FieldLabel>
                                        {el.src ? (
                                            <div className="relative group">
                                                <div className="h-20 rounded border overflow-hidden flex items-center justify-center bg-gray-50"><img src={el.src} alt="" className="max-h-full max-w-full object-contain" /></div>
                                                <label className="absolute bottom-1 left-1 flex items-center justify-center gap-1 bg-white border border-gray-200 rounded text-[10px] px-1.5 py-0.5 cursor-pointer hover:bg-gray-50 transition text-gray-700">
                                                    <span>{uploadingIds.has(el.id) ? '...' : 'Change'}</span>
                                                    <input type="file" accept="image/*" className="hidden" disabled={uploadingIds.has(el.id)} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f, el.id); }} />
                                                </label>
                                                <button onClick={() => updateElement(el.id, { src: '' })} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                            </div>
                                        ) : (
                                            <label className="flex h-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 transition">
                                                {uploadingIds.has(el.id) ? 'Uploading...' : 'Click to upload'}
                                                <input type="file" accept="image/*" className="hidden" disabled={uploadingIds.has(el.id)} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f, el.id); }} />
                                            </label>
                                        )}
                                    </div>
                                    <div>
                                        <FieldLabel isDark={isDark}>Fit</FieldLabel>
                                        <select value={el.objectFit} onChange={(e) => updateElement(el.id, { objectFit: e.target.value as 'cover' | 'contain' })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                            <option value="contain">Contain</option><option value="cover">Cover</option>
                                        </select>
                                    </div>
                                    <WHFields w={el.width} h={el.height} onW={(v) => updateElement(el.id, { width: v })} onH={(v) => updateElement(el.id, { height: v })} isDark={isDark} />
                                </div>
                            );
                        })()}

                        {/* ── Emoji Row properties ── */}
                        {selected.type === 'emoji' && (() => {
                            const el = selected as FrameEmojiElement & { rotation?: number };
                            const rot = el.rotation ?? 0;
                            return (
                                <div className={`border-t pt-3 space-y-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <div>
                                        <FieldLabel isDark={isDark}>Emoji</FieldLabel>
                                        <Input value={el.emoji} onChange={(e) => updateElement(el.id, { emoji: e.target.value })} placeholder="Type or paste emoji…" className="text-sm mb-1" />
                                        <EmojiPickerRow value={el.emoji} onPick={(e) => updateElement(el.id, { emoji: e })} isDark={isDark} />
                                    </div>
                                    <div><FieldLabel isDark={isDark}>Spacing</FieldLabel><Input type="number" value={el.spacing} onChange={(e) => updateElement(el.id, { spacing: +e.target.value })} /></div>
                                    <div className={`border-t pt-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                        <RotationControl value={rot} onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                                    </div>
                                    <XYFields x={el.x} y={el.y} onX={(v) => updateElement(el.id, { x: v })} onY={(v) => updateElement(el.id, { y: v })} isDark={isDark} />
                                </div>
                            );
                        })()}

                        {/* ── Sticker properties ── */}
                        {selected.type === 'sticker' && (() => {
                            const el = selected as FrameStickerElement;
                            return (
                                <div className={`border-t pt-3 space-y-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <div className={`flex items-center justify-center rounded border h-16 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50'}`}>
                                        <span style={{ fontSize: 40, display: 'inline-block', transform: `rotate(${el.rotation}deg)`, transition: 'transform 0.1s', lineHeight: 1 }}>{el.emoji}</span>
                                    </div>
                                    <div>
                                        <FieldLabel isDark={isDark}>Emoji</FieldLabel>
                                        <Input value={el.emoji} onChange={(e) => updateElement(el.id, { emoji: e.target.value })} placeholder="Type or paste emoji…" className="text-sm mb-1" />
                                        <EmojiPickerRow value={el.emoji} onPick={(e) => updateElement(el.id, { emoji: e })} isDark={isDark} />
                                    </div>
                                    <div className={`border-t pt-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                        <RotationControl value={el.rotation} onChange={(v) => updateElement(el.id, { rotation: v })} isDark={isDark} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><FieldLabel isDark={isDark}>Size</FieldLabel><Input type="number" value={el.width} onChange={(e) => updateElement(el.id, { width: +e.target.value, height: +e.target.value })} /></div>
                                        <div><FieldLabel isDark={isDark}>X</FieldLabel><Input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: +e.target.value })} /></div>
                                        <div><FieldLabel isDark={isDark}>Y</FieldLabel><Input type="number" value={el.y} onChange={(e) => updateElement(el.id, { y: +e.target.value })} /></div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className={`border-t pt-3 space-y-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <Button onClick={onSave} className="w-full">{isEdit ? 'Save Changes' : 'Create Frame'}</Button>
                    <Button variant="outline" onClick={onCancel} className={`w-full ${isDark ? 'border-slate-600' : ''}`}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}