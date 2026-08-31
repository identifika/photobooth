'use client';

import { useState, useRef, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useEvent } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDialog } from '@/components/ui/dialog-provider';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Sparkles,
  Palette,
  Layout,
  Share2,
  Wifi,
  ExternalLink,
  Sliders,
  Type,
  FileImage,
} from 'lucide-react';
import Link from 'next/link';

type QrTargetType = 'booth' | 'gallery' | 'kiosk' | 'wifi';
type StandeeTemplate = 'minimal' | 'wedding' | 'party' | 'vintage';
type StandeeSize = '4x6' | '5x7' | 'a4' | 'square';

export default function EventQrStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const { user, loading } = useAuth();
  const router = useRouter();
  const { alert } = useDialog();

  const { data: event, isLoading } = useEvent(eventId);

  // QR Settings
  const [targetType, setTargetType] = useState<QrTargetType>('booth');
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBgColor, setQrBgColor] = useState('#ffffff');
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('Q');
  const [includeCenterEmoji, setIncludeCenterEmoji] = useState(true);
  const [centerEmoji, setCenterEmoji] = useState('📷');

  // Standee Settings
  const [template, setTemplate] = useState<StandeeTemplate>('wedding');
  const [sizeFormat, setSizeFormat] = useState<StandeeSize>('4x6');
  const [standeeHeadline, setStandeeHeadline] = useState('');
  const [standeeSubtitle, setStandeeSubtitle] = useState('');
  const [showWifiOnStandee, setShowWifiOnStandee] = useState(true);
  const [showHashtagOnStandee, setShowHashtagOnStandee] = useState(true);

  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const standeeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (event) {
      if (event.themeColor) setQrColor(event.themeColor);
      setStandeeHeadline(event.name || 'Capture the Moment');
      setStandeeSubtitle(event.tagline || 'Scan with your phone camera to take photos & make memories');
    }
  }, [event]);

  if (loading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading QR Studio...</p>
      </main>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  if (!event) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 space-y-4">
        <p className="text-lg font-semibold">Event Not Found</p>
        <Button onClick={() => router.push('/events')}>Back to Events</Button>
      </main>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pikabooth.app';
  
  let targetUrl = `${origin}/e/${event.slug}`;
  if (targetType === 'gallery') targetUrl = `${origin}/e/${event.slug}/gallery`;
  if (targetType === 'kiosk') targetUrl = `${origin}/e/${event.slug}?mode=kiosk`;
  if (targetType === 'wifi') {
    const ssid = event.wifiSsid || 'Pikabooth-WiFi';
    const pass = event.wifiPassword || '';
    targetUrl = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download raw QR code PNG
  const handleDownloadQrPng = () => {
    const canvas = document.getElementById('qr-canvas-element') as HTMLCanvasElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${event.slug}-qr.png`;
    a.click();
  };

  // Render & Export High-Res Standee / Table Tent
  const handleDownloadStandee = async () => {
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Define dimensions based on size format (300 DPI for print quality)
      let W = 1200; // 4x6" at 300DPI = 1200x1800
      let H = 1800;
      if (sizeFormat === '5x7') { W = 1500; H = 2100; }
      if (sizeFormat === 'a4') { W = 2480; H = 3508; }
      if (sizeFormat === 'square') { W = 1800; H = 1800; }

      canvas.width = W;
      canvas.height = H;

      // 1. Background styling based on template
      if (template === 'minimal') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 16;
        ctx.strokeRect(32, 32, W - 64, H - 64);
      } else if (template === 'wedding') {
        // Elegant Cream & Gold
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#fdfbf7');
        grad.addColorStop(1, '#f7f2e7');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Gold border
        ctx.strokeStyle = event.themeColor || '#c9a84c';
        ctx.lineWidth = 14;
        ctx.strokeRect(40, 40, W - 80, H - 80);
        ctx.lineWidth = 4;
        ctx.strokeRect(56, 56, W - 112, H - 112);
      } else if (template === 'party') {
        // Dark neon party
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#ec489930');
        grad.addColorStop(1, '#8b5cf630');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 12;
        ctx.strokeRect(36, 36, W - 72, H - 72);
      } else if (template === 'vintage') {
        // Vintage paper
        ctx.fillStyle = '#f4ede4';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 18;
        ctx.strokeRect(40, 40, W - 80, H - 80);
      }

      // 2. Top Header Branding
      ctx.textAlign = 'center';
      const isDark = template === 'party';
      const textColor = isDark ? '#ffffff' : '#1e293b';
      const subColor = isDark ? '#94a3b8' : '#64748b';
      const accentColor = event.themeColor || '#e11d48';

      // Studio/Event Badge
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.fillStyle = accentColor;
      ctx.fillText('✨ PHOTO BOOTH', W / 2, 140);

      // Event Title
      ctx.font = template === 'wedding' ? 'bold 68px "Playfair Display", serif' : 'bold 64px "Inter", sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText(standeeHeadline || event.name, W / 2, 230);

      // Subtitle
      if (standeeSubtitle) {
        ctx.font = '32px "Inter", sans-serif';
        ctx.fillStyle = subColor;
        ctx.fillText(standeeSubtitle, W / 2, 290);
      }

      // 3. Draw QR Code into Canvas Center
      const qrCanvas = document.getElementById('qr-canvas-element') as HTMLCanvasElement;
      if (qrCanvas) {
        const qrSize = Math.min(W * 0.55, 700);
        const qrX = (W - qrSize) / 2;
        const qrY = H * 0.36;

        // White card backing behind QR
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.beginPath();
        ctx.roundRect(qrX - 30, qrY - 30, qrSize + 60, qrSize + 60, 32);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
      }

      // 4. Instructions below QR
      const instructY = H * 0.78;
      ctx.font = 'bold 38px "Inter", sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText('📱 SCAN WITH PHONE CAMERA TO SNAP', W / 2, instructY);

      ctx.font = '28px "Inter", sans-serif';
      ctx.fillStyle = subColor;
      ctx.fillText('No app download needed · Instant photo strip & live GIF', W / 2, instructY + 48);

      // 5. Bottom Metadata (Hashtag & Wi-Fi)
      const bottomY = H - 120;
      if (showHashtagOnStandee && event.hashtag) {
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = accentColor;
        ctx.fillText(event.hashtag, W / 2, bottomY - 40);
      }

      if (showWifiOnStandee && event.wifiSsid) {
        ctx.font = '24px "Inter", sans-serif';
        ctx.fillStyle = subColor;
        ctx.fillText(`📶 Wi-Fi: ${event.wifiSsid} ${event.wifiPassword ? `· Password: ${event.wifiPassword}` : ''}`, W / 2, bottomY);
      }

      // Download standee image
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${event.slug}-table-tent-${sizeFormat}.png`;
      a.click();
    } catch (err) {
      console.error('Standee export failed:', err);
      alert('Failed to generate standee image.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link href="/events" className="hover:text-foreground flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/events/${eventId}`)}
              className="gap-1.5 rounded-full text-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              Event Settings
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/e/${event.slug}`)}
              className="gap-1.5 rounded-full text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Booth
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <QrCode className="w-4 h-4" />
            </span>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              QR & Standee Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            QR Generator for {event.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate high-resolution QR codes, custom printable table tents, and signage standees for your event tables and venue booth.
          </p>
        </div>

        {/* Studio Layout: Left Controls, Right Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Left Column: Controls (5 cols) ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Target Selector */}
            <div className="bg-[var(--surface-2)] p-5 rounded-3xl border border-border space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Share2 className="w-4 h-4 text-primary" />
                1. QR Code Target Action
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('booth')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    targetType === 'booth'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="text-sm">📸 Mobile Booth</div>
                  <div className="text-[10px] opacity-70">Guest takes photo</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('gallery')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    targetType === 'gallery'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="text-sm">🖼 Live Gallery</div>
                  <div className="text-[10px] opacity-70">View live guestbook</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('kiosk')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    targetType === 'kiosk'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="text-sm">🖥 Kiosk Mode</div>
                  <div className="text-[10px] opacity-70">Dedicated station</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('wifi')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    targetType === 'wifi'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="text-sm">📶 Venue Wi-Fi</div>
                  <div className="text-[10px] opacity-70">Instant connect</div>
                </button>
              </div>

              {/* Target Link preview */}
              <div className="p-3 bg-background rounded-2xl border border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Encoded URL</div>
                  <div className="text-xs font-mono text-foreground truncate">{targetUrl}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="shrink-0 h-8 px-2.5 rounded-xl gap-1 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* QR Styling Controls */}
            <div className="bg-[var(--surface-2)] p-5 rounded-3xl border border-border space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Palette className="w-4 h-4 text-primary" />
                2. QR Styling & Branding
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Dark Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                    />
                    <Input
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={qrBgColor}
                      onChange={(e) => setQrBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                    />
                    <Input
                      value={qrBgColor}
                      onChange={(e) => setQrBgColor(e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Error correction & emoji */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">Center Emoji Icon</label>
                <div className="flex items-center gap-1.5">
                  {['📷', '💍', '🎉', '✨', '💖', '🍿'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setCenterEmoji(em);
                        setIncludeCenterEmoji(true);
                      }}
                      className={`w-7 h-7 rounded-lg text-sm transition ${
                        centerEmoji === em && includeCenterEmoji
                          ? 'bg-primary/20 scale-110'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIncludeCenterEmoji(!includeCenterEmoji)}
                    className={`px-2 py-1 rounded-lg text-[10px] border font-medium ${
                      !includeCenterEmoji ? 'bg-muted border-foreground' : 'border-border opacity-60'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
            </div>

            {/* Standee Template Controls */}
            <div className="bg-[var(--surface-2)] p-5 rounded-3xl border border-border space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Layout className="w-4 h-4 text-primary" />
                3. Printable Table-Tent Standee
              </h2>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Template Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'wedding', label: '👑 Royal Gold', desc: 'Serif & Gold Borders' },
                    { id: 'minimal', label: '🌟 Modern Clean', desc: 'Crisp Monochrome' },
                    { id: 'party', label: '🪩 Dark Party', desc: 'Neon Glowing Glow' },
                    { id: 'vintage', label: '🎞 Vintage Film', desc: 'Retro Paper Frame' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id as StandeeTemplate)}
                      className={`p-2.5 rounded-2xl border text-left transition ${
                        template === t.id
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] opacity-70">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Preset */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Print Paper Size</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: '4x6', label: '4" × 6"' },
                    { id: '5x7', label: '5" × 7"' },
                    { id: 'a4', label: 'A4 / A5' },
                    { id: 'square', label: '1:1 Square' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSizeFormat(s.id as StandeeSize)}
                      className={`py-1.5 rounded-xl border text-xs font-medium transition ${
                        sizeFormat === s.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standee Custom Text */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Headline Text</label>
                <Input
                  value={standeeHeadline}
                  onChange={(e) => setStandeeHeadline(e.target.value)}
                  placeholder="Sarah & Liam's Wedding"
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Subtitle / Instruction</label>
                <Input
                  value={standeeSubtitle}
                  onChange={(e) => setStandeeSubtitle(e.target.value)}
                  placeholder="Scan to take photos with our custom frame"
                  className="bg-background text-xs"
                />
              </div>
            </div>
          </div>

          {/* ── Right Column: Live Standee Preview (7 cols) ── */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[var(--surface-2)] p-6 sm:p-8 rounded-3xl border border-border flex flex-col items-center space-y-6">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Live Standee Preview</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{sizeFormat.toUpperCase()} Print Ready</span>
              </div>

              {/* Standee Container (Simulating Print Card) */}
              <div
                className={`relative w-full max-w-sm rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-2xl transition-all ${
                  template === 'minimal'
                    ? 'bg-white text-slate-900 border-4 border-slate-200'
                    : template === 'wedding'
                    ? 'bg-[#fdfbf7] text-[#1e293b] border-4 border-[#c9a84c]'
                    : template === 'party'
                    ? 'bg-slate-900 text-white border-4 border-pink-500 shadow-pink-500/10'
                    : 'bg-[#f4ede4] text-[#3e2723] border-4 border-[#3e2723]'
                }`}
                style={{
                  minHeight: sizeFormat === 'square' ? 380 : 500,
                  borderColor: template === 'wedding' ? event.themeColor || '#c9a84c' : undefined,
                }}
              >
                {/* Decorative Top Accent */}
                <div className="space-y-2 w-full">
                  <div
                    className="text-[11px] font-bold tracking-[0.2em] uppercase"
                    style={{ color: event.themeColor || '#e11d48' }}
                  >
                    ✨ PHOTO BOOTH
                  </div>
                  <h3
                    className={`font-bold leading-tight ${
                      template === 'wedding' ? 'font-serif text-2xl' : 'text-xl'
                    }`}
                  >
                    {standeeHeadline || event.name}
                  </h3>
                  {standeeSubtitle && (
                    <p className="text-xs opacity-75 max-w-xs mx-auto line-clamp-2">
                      {standeeSubtitle}
                    </p>
                  )}
                </div>

                {/* Center QR Display */}
                <div className="my-6 p-4 bg-white rounded-2xl shadow-md inline-block relative border border-black/5">
                  <QRCodeCanvas
                    id="qr-canvas-element"
                    value={targetUrl}
                    size={160}
                    fgColor={qrColor}
                    bgColor={qrBgColor}
                    level={errorLevel}
                    imageSettings={
                      includeCenterEmoji
                        ? undefined
                        : undefined
                    }
                  />

                  {/* Optional center emoji badge */}
                  {includeCenterEmoji && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-lg border border-black/5">
                        {centerEmoji}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Call to Action */}
                <div className="space-y-2 w-full">
                  <p className="text-xs font-bold tracking-wider uppercase">
                    📱 Scan With Phone Camera
                  </p>
                  <p className="text-[11px] opacity-70">
                    Take photos & create your custom photo strip
                  </p>

                  {(event.hashtag || event.wifiSsid) && (
                    <div className="pt-2 border-t border-current/10 text-[10px] space-y-0.5 opacity-80 font-mono">
                      {event.hashtag && <div>{event.hashtag}</div>}
                      {event.wifiSsid && (
                        <div>
                          📶 Wi-Fi: {event.wifiSsid} {event.wifiPassword ? `(${event.wifiPassword})` : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  onClick={handleDownloadStandee}
                  disabled={exporting}
                  className="w-full sm:w-auto gap-2 rounded-full px-6 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Generating...' : 'Download Standee Card (PNG)'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDownloadQrPng}
                  className="w-full sm:w-auto gap-2 rounded-full px-5"
                >
                  <QrCode className="w-4 h-4" />
                  Download QR Code Only
                </Button>

                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="w-full sm:w-auto gap-2 rounded-full px-5"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
