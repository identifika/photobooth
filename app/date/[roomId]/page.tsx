"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrJoinRoomSession, inviteLinkFor, RoomSession } from "@/lib/roomSession";
import DatePhotobooth from "@/components/DatePhotobooth";
import { useStudioSettings } from "@/hooks/useStudioSettings";
import { ThemeToggle } from "@/hooks/useTheme";

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL ?? "ws://localhost:8787";

export default function DateRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const router = useRouter();

  const { settings, isLoaded } = useStudioSettings();
  const [session, setSession] = useState<RoomSession | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSession(getOrJoinRoomSession(roomId));
    setInviteLink(inviteLinkFor(roomId));
  }, [roomId]);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!session || !isLoaded) return null; // avoids SSR/localStorage mismatch flash

  const studioName = settings?.studioName || 'Photobooth';
  const studioLogo = settings?.studioLogo || '📷';
  const tagline = settings?.tagline || 'Capture the moment';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>

          {/* Logo */}
          <button onClick={() => router.push('/')} className="flex items-center gap-3 group" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <div className="flex items-center justify-center group-hover:rotate-12 transition-transform"
              style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand)', fontSize: 18 }}>
              {studioLogo}
            </div>
            <div className="text-left">
              <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.3px', margin: 0 }}>{studioName}</h1>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>{tagline}</div>
            </div>
          </button>
          
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-6 py-12" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {session.role === "host" && (
          <div className="w-full max-w-3xl font-mono text-sm border border-[var(--border)] bg-[var(--surface-1)] rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="truncate">
              <div className="opacity-50 text-xs mb-1">invite link</div>
              <div className="truncate text-[var(--text-primary)]">{inviteLink}</div>
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
        )}

        <DatePhotobooth
          signalUrl={SIGNAL_URL}
          roomId={session.roomId}
          peerId={session.peerId}
          isMe={session.role === "host" ? "left" : "right"}
          initialFrame={session.frame}
        />
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
