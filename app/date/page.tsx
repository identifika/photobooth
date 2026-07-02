"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRoomSession } from "@/lib/roomSession";
import { useAuth } from "@/hooks/useAuth";
import FrameSelector from "@/components/FrameSelector";
import { type Frame } from "@/lib/frames";
import { listUserFrames, type UserFrame } from "@/lib/user-frames";
import { useStudioSettings } from "@/hooks/useStudioSettings";
import { ThemeToggle } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/useIsMobile";

function userFrameToFrame(f: UserFrame): Frame {
  const photoCount = Math.max(1, f.config.elements?.filter((e) => e.type === "photo").length || 4);
  return {
    id: `user-${f.id}`,
    name: f.name || "My Frame",
    description: f.config.description || "Custom frame",
    photoCount,
    layout: photoCount <= 2 ? "strip-2" : photoCount === 3 ? "strip-3" : "grid-2x2",
    aspectRatio: 4 / 3,
    color: f.config.color || "#f5f0e8",
    borderColor: f.config.borderColor || "#1a1410",
    accentColor: f.config.accentColor || "#c9a84c",
    emoji: f.emoji || "✨",
    config: f.config,
    width: f.config.width,
    height: f.config.height,
  };
}

export default function StartDatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings, isLoaded } = useStudioSettings();
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [userFrames, setUserFrames] = useState<UserFrame[]>([]);
  const [captureMode, setCaptureMode] = useState<"merged" | "alternating">("merged");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user) { setUserFrames([]); return; }
    listUserFrames(user.uid)
      .then(setUserFrames)
      .catch(console.error);
  }, [user]);

  function handleStart() {
    if (!selectedFrame) return;
    const session = createRoomSession(selectedFrame, captureMode);
    router.push(`/date/${session.roomId}`);
  }

  if (!isLoaded) return null;

  const studioName = settings?.studioName || 'Photobooth';
  const studioLogo = settings?.studioLogo || '📷';
  const tagline = settings?.tagline || 'Capture the moment';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '0 12px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: isMobile ? 56 : 64, gap: isMobile ? 8 : 16 }}>

          {/* Logo */}
          <button onClick={() => router.push('/')} className="flex items-center gap-2 group" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <div className="flex items-center justify-center group-hover:rotate-12 transition-transform"
              style={{ width: isMobile ? 32 : 38, height: isMobile ? 32 : 38, borderRadius: isMobile ? 8 : 10, background: 'var(--brand)', fontSize: isMobile ? 16 : 18 }}>
              {studioLogo}
            </div>
            <div className={`text-left ${isMobile ? 'hidden sm:block' : ''}`}>
              <h1 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.3px', margin: 0 }}>{studioName}</h1>
              {!isMobile && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>{tagline}</div>}
            </div>
          </button>
          
          <div className="flex items-center" style={{ flexShrink: 0, gap: isMobile ? 4 : 8 }}>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col" style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px 80px' : '32px 24px 80px', width: '100%' }}>
        <div className="text-center max-w-md mx-auto mb-12">
          <h1 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Photobooth for Two</h1>
          <p className={`opacity-60 mt-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Pick a frame, start a session, send your date the link, and take a photo together — wherever you both are.
          </p>
        </div>
        
        <FrameSelector
          selected={selectedFrame}
          onSelect={setSelectedFrame}
          userFrames={userFrames.map(userFrameToFrame)}
        />

        {selectedFrame && (
          <div className={`fixed z-50 animate-fadeIn bg-[var(--surface-2)]/90 backdrop-blur-md border border-[var(--border)] shadow-xl ${isMobile ? 'bottom-6 left-4 right-4' : ''}`} style={isMobile ? {} : { bottom: '80px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px' }}>
              <button className={`begin-btn w-full justify-center ${isMobile ? '!rounded-lg' : ''}`} onClick={handleStart} style={{ boxShadow: 'var(--shadow-md)', ...(isMobile ? { display: 'flex', width: '100%', padding: '0 16px' } : {}) }}>
                Start session
                <span className="arrow">→</span>
              </button>
          </div>
        )}
      </main>

      {/* Ticker */}
      <div className="ticker mt-auto" role="marquee">
        <div className="ticker-track">
          <span className="ticker-text">
            {'🎞 PHOTOBOOTH STUDIO · 📷 CAPTURE THE MOMENT · ✨ MAKE MEMORIES · 🎭 STRIKE A POSE · 💫 SAY CHEESE · '.repeat(6)}
          </span>
        </div>
      </div>
    </div>
  );
}
