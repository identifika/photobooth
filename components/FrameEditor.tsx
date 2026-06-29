'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
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

const LAYOUT_PRESETS: { value: LayoutType; label: string; icon: string }[] = [
    { value: 'single', label: '1P', icon: '⬜' },
    { value: 'strip_2', label: '2P', icon: '▫️▫️' },
    { value: 'strip_3', label: '3P', icon: '▫️▫️▫️' },
    { value: 'strip_4', label: '4P', icon: '▫️▫️▫️▫️' },
    { value: 'grid_2x2', label: '2×2', icon: '▫️▫️\n▫️▫️' },
];

const ROTATION_PRESETS = [0, 45, 90, 135, -45, -90] as const;

// Common frame aspect ratios for the resize panel
const FRAME_PRESETS = [
    { label: 'Portrait 2:3', w: 400, h: 600 },
    { label: 'Square 1:1', w: 500, h: 500 },
    { label: 'Landscape 3:2', w: 600, h: 400 },
    { label: 'Story 9:16', w: 360, h: 640 },
    { label: 'Tall 3:4', w: 450, h: 600 },
] as const;

// ── Extended types ──

type AnyElement = FrameElement;

interface SnapGuide {
    axis: 'x' | 'y';
    value: number;
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

const EDGE_CURSORS: Record<ResizeEdge, string> = {
    n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
    ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
};

function CanvasResizeHandles({
    canvasW, canvasH,
    onEdgeDown,
}: {
    canvasW: number;
    canvasH: number;
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
                    style={{
                        position: 'absolute',
                        background: '#3b82f6',
                        borderRadius: 2,
                        zIndex: 300,
                        ...style,
                    }}
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

// ── RotationPresets ──

function RotationPresets({ value, onChange, isDark = false }: { value: number; onChange: (v: number) => void; isDark?: boolean }) {
    return (
        <div className="flex gap-1 mt-1 flex-wrap">
            {ROTATION_PRESETS.map((deg) => (
                <button key={deg} onClick={() => onChange(deg)}
                    className={`flex-1 rounded border text-[10px] py-0.5 transition min-w-[28px] ${value === deg ? (isDark ? 'bg-slate-400 text-slate-900 border-slate-400' : 'bg-gray-900 text-white border-gray-900') : (isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}>
                    {deg}°
                </button>
            ))}
        </div>
    );
}

// ── Helpers ──

function uid(): string { return Math.random().toString(36).slice(2, 10); }

// Theme-aware default colors (adapts to light/dark backgrounds)
function getDefaultTitleColor(): string { return '#1a1410'; } // Dark text - visible on light bg
function getDefaultBorderColor(): string { return '#1a1410'; }
function getDefaultAccentColor(): string { return '#c9a84c'; }
function getDefaultBgColor(): string { return '#f5f0e8'; }

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

function applyLayout(layout: LayoutType, existing: AnyElement[], canvasW: number, canvasH: number): AnyElement[] {
    const nonPhotos = existing.filter((e) => e.type !== 'photo');
    const pad = 20, gap = 8;
    let photos: FramePhotoElement[] = [];
    if (layout === 'single') {
        const w = canvasW - pad * 2, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h)];
    } else if (layout === 'strip_2') {
        const w = (canvasW - pad * 2 - gap) / 2, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h)];
    } else if (layout === 'strip_3') {
        const w = (canvasW - pad * 2 - gap * 2) / 3, h = Math.round(w * 3 / 4);
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h), makePhotoSlot(uid(), pad + (w + gap) * 2, pad + 60, w, h)];
    } else if (layout === 'strip_4') {
        const w = canvasW - pad * 2, h = Math.round((w * 3 / 4) * 0.4);
        photos = Array.from({ length: 4 }, (_, i) => makePhotoSlot(uid(), pad, pad + 60 + i * (h + gap), w, h));
    } else if (layout === 'grid_2x2') {
        const w = (canvasW - pad * 2 - gap) / 2, h = w;
        photos = [makePhotoSlot(uid(), pad, pad + 60, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60, w, h), makePhotoSlot(uid(), pad, pad + 60 + h + gap, w, h), makePhotoSlot(uid(), pad + w + gap, pad + 60 + h + gap, w, h)];
    }
    return [...nonPhotos, ...photos];
}

function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); });
}

function repeatEmoji(emoji: string, count: number, max = 40): string {
    return Array.from({ length: Math.min(Math.max(count, 0), max) }, () => emoji).join('');
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

export default function FrameEditor({
    config, onChange, frameName, onNameChange,
    categoryId, onCategoryChange, sortOrder, onSortOrderChange,
    categories, onSave, onCancel, isEdit,
}: Props) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const centerPanelRef = useRef<HTMLDivElement>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

    // ── Clipboard state ──
    const [clipboard, setClipboard] = useState<AnyElement | null>(null);

    // ── Undo/Redo history ──
    const historyRef = useRef<FrameConfig[]>([]);
    const futureRef = useRef<FrameConfig[]>([]);

    const pushHistory = useCallback(() => {
        historyRef.current.push(JSON.parse(JSON.stringify(config)));
        futureRef.current = []; // clear redo stack on new change
        // Cap history at 50 entries
        if (historyRef.current.length > 50) historyRef.current.shift();
    }, [config]);

    const undo = useCallback(() => {
        if (historyRef.current.length === 0) return;
        futureRef.current.push(JSON.parse(JSON.stringify(config)));
        const prev = historyRef.current.pop()!;
        onChange(prev);
    }, [config, onChange]);

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return;
        historyRef.current.push(JSON.parse(JSON.stringify(config)));
        const next = futureRef.current.pop()!;
        onChange(next);
    }, [config, onChange]);

    const [dragging, setDragging] = useState<{
        id: string; startX: number; startY: number; origX: number; origY: number;
    } | null>(null);

    const [resizing, setResizing] = useState<{
        id: string; startX: number; startY: number; origW: number; origH: number;
    } | null>(null);

    // Canvas frame resizing state
    const [frameResizing, setFrameResizing] = useState<{
        edge: ResizeEdge;
        startX: number; startY: number;
        origW: number; origH: number;
    } | null>(null);

    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
    const pointerDownOnElement = useRef(false);

    // ── Zoom state ──
    const [zoom, setZoom] = useState(1);
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 3;
    const ZOOM_STEP = 0.1;
    const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
    const zoomReset = useCallback(() => setZoom(1), []);

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
    const selected = elements.find((e) => e.id === selectedId) ?? null;

    // Frame dimensions
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

    // ── Element drag ──
    const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
        e.stopPropagation(); e.preventDefault();
        pointerDownOnElement.current = true;
        setSelectedId(id);
        const el = elements.find((x) => x.id === id);
        if (!el) return;
        pushHistory();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDragging({ id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
    }, [elements, pushHistory]);

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

    // ── Element resize handle ──
    const onResizeDown = useCallback((e: React.PointerEvent, id: string) => {
        e.stopPropagation(); e.preventDefault();
        pointerDownOnElement.current = true;
        const el = elements.find((x) => x.id === id);
        if (!el) return;
        pushHistory();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setResizing({ id, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height });
    }, [elements, pushHistory]);

    // ── Canvas background click → deselect ──
    const onCanvasClick = useCallback((e: React.MouseEvent) => {
        if (pointerDownOnElement.current) { pointerDownOnElement.current = false; return; }
        if (e.target === e.currentTarget) setSelectedId(null);
    }, []);

    // ── Center panel click → deselect ──
    const onCenterPanelMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setSelectedId(null);
        }
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

    // ── Keyboard: Escape, Delete, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Shift+Z ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            const mod = e.ctrlKey || e.metaKey;

            if (e.key === 'Escape') { setSelectedId(null); return; }

            // Undo — Ctrl+Z / Cmd+Z
            if (mod && e.key === 'z' && !e.shiftKey && !isTyping) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo — Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
            if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && !isTyping) {
                e.preventDefault();
                redo();
                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !isTyping) {
                pushHistory();
                updateElements(elements.filter((el) => el.id !== selectedId));
                setSelectedId(null);
                return;
            }

            // Copy — Ctrl+C / Cmd+C
            if (mod && e.key === 'c' && selectedId && !isTyping) {
                const el = elements.find((x) => x.id === selectedId);
                if (el) { setClipboard(el); e.preventDefault(); }
                return;
            }

            // Paste — Ctrl+V / Cmd+V
            if (mod && e.key === 'v' && clipboard && !isTyping) {
                e.preventDefault();
                pushHistory();
                const newEl: AnyElement = { ...clipboard, id: uid(), x: clipboard.x + 16, y: clipboard.y + 16 };
                updateElements([...elements, newEl]);
                setSelectedId(newEl.id);
                return;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedId, clipboard, elements, updateElements, undo, redo, pushHistory]);

    // ── Add element handlers ──
    const addPhoto = () => { pushHistory(); const el = makePhotoSlot(uid(), 50, 80, 150, 112); updateElements([...elements, el]); setSelectedId(el.id); };
    const addTitle = () => { pushHistory(); const el = makeTitleElement(uid(), 100, 20, 'Your Title'); updateElements([...elements, el]); setSelectedId(el.id); };
    const addImage = () => { pushHistory(); const el = makeImageElement(uid(), 50, 300); updateElements([...elements, el]); setSelectedId(el.id); };
    const addEmojiRow = () => { pushHistory(); const el = makeEmojiRowElement(uid(), 0, canvasH - 60, '✨'); updateElements([...elements, el]); setSelectedId(el.id); };
    const addSticker = (emoji = '✨') => {
        pushHistory();
        const el = makeStickerElement(uid(), canvasW / 2 - 24, canvasH / 2 - 24, emoji);
        updateElements([...elements, el]);
        setSelectedId(el.id);
    };
    const deleteSelected = () => { if (!selectedId) return; pushHistory(); updateElements(elements.filter((e) => e.id !== selectedId)); setSelectedId(null); };

    // ── Copy / Paste handlers ──
    const copySelected = () => {
        if (!selected) return;
        setClipboard(selected);
    };

    const pasteClipboard = () => {
        if (!clipboard) return;
        pushHistory();
        const newEl: AnyElement = { ...clipboard, id: uid(), x: clipboard.x + 16, y: clipboard.y + 16 };
        updateElements([...elements, newEl]);
        setSelectedId(newEl.id);
    };

    const handleLayoutPreset = (layout: LayoutType) => { pushHistory(); updateElements(applyLayout(layout, elements, canvasW, canvasH)); };
    const handleImageUpload = async (file: File, elementId: string) => {
        const dataUrl = await readAsDataURL(file);
        updateElement(elementId, { src: dataUrl } as any);
    };

    // ── Render element ──
    const renderElement = (el: AnyElement) => {
        const isSelected = el.id === selectedId;
        const elRotation = (el as any).rotation ?? 0;

        const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: el.x, top: el.y, width: el.width, height: el.height,
            cursor: dragging?.id === el.id ? 'grabbing' : 'grab',
            outline: isSelected ? '2px solid #3b82f6' : 'none',
            outlineOffset: 2,
            zIndex: isSelected ? 10 : 1,
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
            return (
                <div key={el.id} style={{
                    ...rotatedStyle,
                    background: `${config.borderColor ?? '#1a1410'}18`,
                    border: `1.5px dashed ${config.borderColor ?? '#1a1410'}60`,
                    borderRadius: (el as FramePhotoElement).borderRadius,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: config.borderColor ?? '#1a1410', opacity: 0.5,
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

    return (
        <div className="flex h-full">
            {/* ── Left: Toolbar ── */}
            <div className="w-48 border-r p-4 space-y-4 overflow-y-auto bg-surface-2">
                <div>
                    <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Frame Name</label>
                    <Input value={frameName} onChange={(e) => onNameChange(e.target.value)} placeholder="Frame name" />
                </div>
                <div>
                    <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Category</label>
                    <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input'}`}>
                        <option value="">None</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Sort</label>
                    <Input type="number" value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value)} className="w-20" />
                </div>

                <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <label className={`mb-2 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Add Elements</label>
                    <div className="space-y-1">
                        <Button variant="outline" size="sm" onClick={addPhoto} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>📷 Photo Slot</Button>
                        <Button variant="outline" size="sm" onClick={addTitle} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>✏️ Title Text</Button>
                        <Button variant="outline" size="sm" onClick={addImage} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>🖼 Image</Button>
                        <Button variant="outline" size="sm" onClick={addEmojiRow} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>✨ Emoji Row</Button>
                        <Button variant="outline" size="sm" onClick={() => addSticker('✨')} className={`w-full justify-start text-xs ${isDark ? 'border-slate-600 hover:bg-slate-700' : ''}`}>🌟 Emoji Sticker</Button>
                    </div>
                </div>

                <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <label className={`mb-2 block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Layout Presets</label>
                    <div className="grid grid-cols-3 gap-1">
                        {LAYOUT_PRESETS.map((p) => (
                            <button key={p.value} onClick={() => handleLayoutPreset(p.value)} className={`flex flex-col items-center rounded-md border py-1.5 text-xs transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <span className="text-sm">{p.icon}</span>
                                <span className="mt-0.5 font-medium">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Copy / Paste / Delete ── */}
                {selectedId && (
                    <div className={`border-t pt-3 space-y-1 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={copySelected}
                            className={`w-full justify-between text-xs ${isDark ? 'border-slate-600' : ''}`}
                        >
                            <span>📋 Copy</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌘C</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={deleteSelected}
                            className={`w-full justify-between text-xs text-red-600 ${isDark ? 'hover:bg-red-900/30 border-slate-600' : 'hover:bg-red-50'}`}
                        >
                            <span>🗑 Delete</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌫</span>
                        </Button>
                    </div>
                )}

                {/* Paste button — shown whenever clipboard has content */}
                {clipboard && (
                    <div className={selectedId ? '' : `border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={pasteClipboard}
                            className={`w-full justify-between text-xs ${isDark ? 'border-slate-600' : ''}`}
                        >
                            <span>📌 Paste <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>({clipboard.type})</span></span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>⌘V</span>
                        </Button>
                    </div>
                )}

                <p className={`text-[10px] text-center pt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Esc · click outside = deselect<br />⌘C / ⌘V = copy / paste</p>
            </div>

            {/* ── Center: Canvas + Rulers ── */}
            <div
                ref={centerPanelRef}
                className={`flex-1 flex flex-col overflow-auto ${isDark ? 'bg-slate-900' : 'bg-gray-100'}`}
                onMouseDown={onCenterPanelMouseDown}
            >
                {/* Zoom controls bar */}
                <div className={`flex items-center justify-center gap-2 py-2 px-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                    <button onClick={zoomOut} className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Zoom Out (Ctrl+-)">−</button>
                    <button onClick={zoomReset} className={`px-2 h-7 rounded border text-[11px] font-mono transition min-w-[48px] ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Reset Zoom (Ctrl+0)">
                        {Math.round(zoom * 100)}%
                    </button>
                    <button onClick={zoomIn} className={`w-7 h-7 rounded border flex items-center justify-center text-sm transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-100'}`} title="Zoom In (Ctrl++)">+</button>
                    <span className={`text-[10px] ml-2 ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Ctrl+scroll to zoom</span>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                <div
                    style={{ position: 'relative', width: (canvasW + RULER_SIZE) * zoom, height: (canvasH + RULER_SIZE) * zoom, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Corner square */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: RULER_SIZE, height: RULER_SIZE, background: '#f1f5f9', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', zIndex: 10 }} />
                    <div style={{ position: 'absolute', top: 0, left: RULER_SIZE }}><HRuler width={canvasW} cursorX={cursor?.x ?? null} /></div>
                    <div style={{ position: 'absolute', top: RULER_SIZE, left: 0 }}><VRuler height={canvasH} cursorY={cursor?.y ?? null} /></div>

                    {/* Frame size badge */}
                    <div style={{
                        position: 'absolute', top: -22, left: RULER_SIZE,
                        fontSize: 10, fontFamily: 'monospace', color: '#64748b', userSelect: 'none', pointerEvents: 'none',
                    }}>
                        {canvasW} × {canvasH}px {frameResizing ? '(resizing…)' : ''}
                    </div>

                    {/* Canvas wrapper — carries the 8 resize handles */}
                    <div style={{ position: 'absolute', top: RULER_SIZE, left: RULER_SIZE, width: canvasW, height: canvasH }}>
                        {/* 8-point frame resize handles */}
                        <CanvasResizeHandles canvasW={canvasW} canvasH={canvasH} onEdgeDown={onFrameEdgeDown} />

                        {/* The actual canvas */}
                        <div
                            ref={canvasRef}
                            className="relative shadow-lg"
                            style={{
                                width: canvasW, height: canvasH,
                                background: config.color ?? '#f5f0e8',
                                border: `3px solid ${config.borderColor ?? '#1a1410'}`,
                                borderRadius: 4, overflow: 'hidden',
                            }}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerLeave={onPointerLeave}
                            onClick={onCanvasClick}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {/* Accent top */}
                            <div className="absolute top-0 left-0 right-0" style={{ height: accentSize, background: config.accentColor ?? '#c9a84c' }} />

                            {/* Crosshair */}
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

                            {/* Accent bottom */}
                            <div className="absolute bottom-0 left-0 right-0" style={{ height: accentSize, background: config.accentColor ?? '#c9a84c' }} />
                        </div>
                    </div>
                </div>
                </div>
            </div>

            {/* ── Right: Properties Panel ── */}
            <div className="w-64 border-l p-4 space-y-4 overflow-y-auto bg-surface-2">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
                    {selected ? `${selected.type.charAt(0).toUpperCase() + selected.type.slice(1)} Properties` : 'Frame Style'}
                </h3>

                {/* ── Frame Style (nothing selected) ── */}
                {!selected && (
                    <div className="space-y-3">
                        <div>
                            <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-700'}`}>Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={config.color ?? '#f5f0e8'} onChange={(e) => onChange({ ...config, color: e.target.value })} className="h-7 w-7 cursor-pointer rounded border" />
                                <Input value={config.color ?? ''} onChange={(e) => onChange({ ...config, color: e.target.value })} className="w-24 text-xs" />
                            </div>
                        </div>
                        <div>
                            <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-700'}`}>Border</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={config.borderColor ?? '#1a1410'} onChange={(e) => onChange({ ...config, borderColor: e.target.value })} className="h-7 w-7 cursor-pointer rounded border" />
                                <Input value={config.borderColor ?? ''} onChange={(e) => onChange({ ...config, borderColor: e.target.value })} className="w-24 text-xs" />
                            </div>
                        </div>
                        <div>
                            <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-700'}`}>Accent</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={config.accentColor ?? '#c9a84c'} onChange={(e) => onChange({ ...config, accentColor: e.target.value })} className="h-7 w-7 cursor-pointer rounded border" />
                                <Input value={config.accentColor ?? ''} onChange={(e) => onChange({ ...config, accentColor: e.target.value })} className="w-24 text-xs" />
                            </div>
                        </div>

                        {/* Accent Bar Height */}
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

                        {/* ── Frame Size ── */}
                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Frame Size</p>
                            <p className={`mb-2 text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Drag the blue handles around the canvas, or enter values below.</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Width</label>
                                    <Input type="number" min={MIN_FRAME_SIZE} max={MAX_FRAME_SIZE} value={canvasW}
                                        onChange={(e) => setCanvasDims(+e.target.value, canvasH)} />
                                </div>
                                <div>
                                    <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Height</label>
                                    <Input type="number" min={MIN_FRAME_SIZE} max={MAX_FRAME_SIZE} value={canvasH}
                                        onChange={(e) => setCanvasDims(canvasW, +e.target.value)} />
                                </div>
                            </div>
                            {/* Aspect ratio presets */}
                            <p className="mb-1 text-[10px] text-gray-400 font-medium">Presets</p>
                            <div className="space-y-1">
                                {FRAME_PRESETS.map((p) => (
                                    <button
                                        key={p.label}
                                        onClick={() => setCanvasDims(p.w, p.h)}
                                        className={`w-full flex items-center justify-between rounded border px-2 py-1 text-xs transition ${canvasW === p.w && canvasH === p.h ? (isDark ? 'bg-slate-400 text-slate-900 border-slate-400' : 'bg-gray-900 text-white border-gray-900') : (isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50')}`}
                                    >
                                        <span>{p.label}</span>
                                        <span className="font-mono text-[10px] opacity-60">{p.w}×{p.h}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Description</label>
                            <Input value={config.description ?? ''} onChange={(e) => onChange({ ...config, description: e.target.value })} placeholder="Short description" />
                        </div>

                        {/* Quick-add sticker */}
                        <div className="border-t border-gray-100 pt-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Quick-add Sticker</p>
                            <p className="mb-2 text-[10px] text-gray-400">Type any emoji or tap a quick pick below.</p>
                            <div className="flex gap-1 mb-2">
                                <Input
                                    placeholder="Type or paste emoji…"
                                    className="flex-1 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            addSticker(e.currentTarget.value.trim());
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {POPULAR_EMOJIS.slice(0, 20).map((e) => (
                                    <button key={e} onClick={() => addSticker(e)} className="w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-100 transition">{e}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Photo properties ── */}
                {selected?.type === 'photo' && (() => {
                    const el = selected as FramePhotoElement;
                    const rot = (el as any).rotation ?? 0;
                    return (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="mb-0.5 block text-xs text-gray-500">X</label><Input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Y</label><Input type="number" value={el.y} onChange={(e) => updateElement(el.id, { y: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Width</label><Input type="number" value={el.width} onChange={(e) => updateElement(el.id, { width: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Height</label><Input type="number" value={el.height} onChange={(e) => updateElement(el.id, { height: +e.target.value })} /></div>
                            </div>
                            <div><label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Border Radius</label><Input type="number" value={el.borderRadius} onChange={(e) => updateElement(el.id, { borderRadius: +e.target.value })} /></div>
                            <div className={`border-t pt-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                <SliderInput label="Rotation" value={rot} min={-180} max={180} unit="°" onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                                <RotationPresets value={rot} onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                            </div>
                        </div>
                    );
                })()}

                {/* ── Title properties ── */}
                {selected?.type === 'title' && (() => {
                    const el = selected as FrameTitleElement;
                    return (
                        <div className="space-y-3">
                            <div><label className="mb-0.5 block text-xs text-gray-500">Text</label><Input value={el.text} onChange={(e) => updateElement(el.id, { text: e.target.value })} /></div>
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Font</label>
                                <select value={el.font} onChange={(e) => updateElement(el.id, { font: e.target.value })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="mb-0.5 block text-xs text-gray-500">Size</label><Input type="number" value={el.fontSize} onChange={(e) => updateElement(el.id, { fontSize: +e.target.value })} /></div>
                                <div>
                                    <label className="mb-0.5 block text-xs text-gray-500">Align</label>
                                    <select value={el.align} onChange={(e) => updateElement(el.id, { align: e.target.value as 'left' | 'center' | 'right' })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={el.color} onChange={(e) => updateElement(el.id, { color: e.target.value })} className="h-7 w-7 cursor-pointer rounded border" />
                                    <Input value={el.color} onChange={(e) => updateElement(el.id, { color: e.target.value })} className="w-24 text-xs" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="mb-0.5 block text-xs text-gray-500">X</label><Input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Y</label><Input type="number" value={el.y} onChange={(e) => updateElement(el.id, { y: +e.target.value })} /></div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Image properties ── */}
                {selected?.type === 'image' && (() => {
                    const el = selected as FrameImageElement;
                    return (
                        <div className="space-y-3">
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Image</label>
                                {el.src ? (
                                    <div className="relative group">
                                        <div className="h-20 rounded border overflow-hidden flex items-center justify-center bg-gray-50"><img src={el.src} alt="" className="max-h-full max-w-full object-contain" /></div>
                                        <button onClick={() => updateElement(el.id, { src: '' })} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                    </div>
                                ) : (
                                    <label className="flex h-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 transition">
                                        Click to upload
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f, el.id); }} />
                                    </label>
                                )}
                            </div>
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Fit</label>
                                <select value={el.objectFit} onChange={(e) => updateElement(el.id, { objectFit: e.target.value as 'cover' | 'contain' })} className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-transparent border-input text-gray-900'}`}>
                                    <option value="contain">Contain</option><option value="cover">Cover</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="mb-0.5 block text-xs text-gray-500">Width</label><Input type="number" value={el.width} onChange={(e) => updateElement(el.id, { width: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Height</label><Input type="number" value={el.height} onChange={(e) => updateElement(el.id, { height: +e.target.value })} /></div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Emoji Row properties ── */}
                {selected?.type === 'emoji' && (() => {
                    const el = selected as FrameEmojiElement & { rotation?: number };
                    const rot = el.rotation ?? 0;
                    return (
                        <div className="space-y-3">
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Emoji</label>
                                <Input
                                    value={el.emoji}
                                    onChange={(e) => updateElement(el.id, { emoji: e.target.value })}
                                    placeholder="Type or paste emoji…"
                                    className="text-sm mb-1"
                                />
                                <div className="flex flex-wrap gap-1">
                                    {POPULAR_EMOJIS.map((e) => (
                                        <button key={e} onClick={() => updateElement(el.id, { emoji: e })} className={`w-7 h-7 flex items-center justify-center rounded text-sm ${el.emoji === e ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>{e}</button>
                                    ))}
                                </div>
                            </div>
                            <div><label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Spacing</label><Input type="number" value={el.spacing} onChange={(e) => updateElement(el.id, { spacing: +e.target.value })} /></div>
                            <div className={`border-t pt-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                                <SliderInput label="Rotation" value={rot} min={-180} max={180} unit="°" onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                                <RotationPresets value={rot} onChange={(v) => updateElement(el.id, { rotation: v } as any)} isDark={isDark} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>X</label><Input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: +e.target.value })} /></div>
                                <div><label className={`mb-0.5 block text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Y</label><Input type="number" value={el.y} onChange={(e) => updateElement(el.id, { y: +e.target.value })} /></div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Sticker properties ── */}
                {selected?.type === 'sticker' && (() => {
                    const el = selected as FrameStickerElement;
                    return (
                        <div className="space-y-3">
                            <div className="flex items-center justify-center rounded border border-gray-100 bg-gray-50 h-16">
                                <span style={{ fontSize: 40, display: 'inline-block', transform: `rotate(${el.rotation}deg)`, transition: 'transform 0.1s', lineHeight: 1 }}>{el.emoji}</span>
                            </div>
                            <div>
                                <label className="mb-0.5 block text-xs text-gray-500">Emoji</label>
                                <Input
                                    value={el.emoji}
                                    onChange={(e) => updateElement(el.id, { emoji: e.target.value })}
                                    placeholder="Type or paste emoji…"
                                    className="text-sm mb-1"
                                />
                                <div className="flex flex-wrap gap-1">
                                    {POPULAR_EMOJIS.map((e) => (
                                        <button key={e} onClick={() => updateElement(el.id, { emoji: e })} className={`w-7 h-7 flex items-center justify-center rounded text-sm ${el.emoji === e ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>{e}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-gray-100 pt-2">
                                <SliderInput label="Rotation" value={el.rotation} min={-180} max={180} unit="°" onChange={(v) => updateElement(el.id, { rotation: v })} isDark={isDark} />
                                <RotationPresets value={el.rotation} onChange={(v) => updateElement(el.id, { rotation: v })} isDark={isDark} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="mb-0.5 block text-xs text-gray-500">Size</label><Input type="number" value={el.width} onChange={(e) => updateElement(el.id, { width: +e.target.value, height: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">X</label><Input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: +e.target.value })} /></div>
                                <div><label className="mb-0.5 block text-xs text-gray-500">Y</label><Input type="number" value={el.y} onChange={(e) => updateElement(el.id, { y: +e.target.value })} /></div>
                            </div>
                        </div>
                    );
                })()}

                <div className={`border-t pt-3 space-y-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <Button onClick={onSave} className="w-full">{isEdit ? 'Save Changes' : 'Create Frame'}</Button>
                    <Button variant="outline" onClick={onCancel} className={`w-full ${isDark ? 'border-slate-600' : ''}`}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}