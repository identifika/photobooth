"use client";

import { useEffect, useRef, useState } from "react";
import { useDatePeerConnection } from "@/lib/useDatePeerConnection";
import { Frame, FRAMES, layoutToConfig } from "@/lib/frames";
import FinalStrip from "@/components/FinalStrip";
import { useIsMobile } from "@/hooks/useIsMobile";

export type CaptureMode = "merged" | "left" | "right";

  type SyncPayload =
  | { kind: "sync-frame"; frame: Frame; mode: CaptureMode }
  | { kind: "sync-mode"; mode: CaptureMode }
  | { kind: "capture-countdown"; startAt: number; duration: number; index: number; mode: CaptureMode }
  | { kind: "provide-snapshot"; index: number; dataUrl: string; from: "left" | "right" }
  | { kind: "chat-message"; message: string; from: "left" | "right"; timestamp: number }
  | { kind: "restart-session" };

  const DEFAULT_FRAME = FRAMES.find((f) => f.layout === "strip-2") || FRAMES[1];

  export default function DatePhotobooth({
    signalUrl,
    roomId,
    peerId,
    isMe,
    initialFrame,
  }: {
    signalUrl: string;
    roomId: string;
    peerId: string;
    isMe: "left" | "right";
    initialFrame?: Frame;
  }) {
    const [frame, setFrame] = useState<Frame | null>(initialFrame || null);
    const [captureMode, setCaptureMode] = useState<CaptureMode>("merged");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [completed, setCompleted] = useState(false);
    
    // Chat state
    const [messages, setMessages] = useState<{message: string, from: "left" | "right", timestamp: number}[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [unreadChat, setUnreadChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Hold pending snapshots from both sides for the current photo index
    const pendingSnapshots = useRef<{ left?: string, right?: string }>({});

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const activeFrame = frame || { ...DEFAULT_FRAME, config: layoutToConfig(DEFAULT_FRAME.layout, DEFAULT_FRAME.photoCount) };
    const isMobile = useIsMobile();

    const { status, localStream, remoteStream, sendSync } = useDatePeerConnection({
      signalUrl,
      roomId,
      peerId,
      isInitiator: isMe === "left",
      onSync: (payload) => {
        const p = payload as SyncPayload;
        if (p.kind === "sync-frame") {
          if (isMe === "right") {
            setFrame(p.frame);
            setCaptureMode(p.mode);
          }
        } else if (p.kind === "sync-mode") {
          if (isMe === "right") {
            setCaptureMode(p.mode);
          }
        } else if (p.kind === "capture-countdown") {
          if (!isCapturing) {
            setIsCapturing(true);
          }
          setCaptureMode(p.mode);
          runCountdown(p.startAt, p.duration, p.index, p.mode);
        } else if (p.kind === "provide-snapshot") {
          handleReceivedSnapshot(p.index, p.from, p.dataUrl);
        } else if (p.kind === "chat-message") {
          setMessages(prev => [...prev, p]);
          setUnreadChat(prev => chatOpen ? false : true);
        } else if (p.kind === "restart-session") {
          setPhotos([]);
          setCompleted(false);
          setCaptureMode("merged");
          setCountdown(null);
          setIsCapturing(false);
          pendingSnapshots.current = {};
        }
      },
    });

    // Sync frame to guest when connected
    useEffect(() => {
      if (status === "connected" && isMe === "left" && frame) {
        sendSync({ kind: "sync-frame", frame, mode: captureMode });
      }
    }, [status, isMe, frame, sendSync]);

    useEffect(() => {
      if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    }, [localStream, completed]);

    useEffect(() => {
      if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    }, [remoteStream, completed]);

    useEffect(() => {
      if (chatOpen && chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [messages, chatOpen]);

    useEffect(() => {
      if (chatOpen) setUnreadChat(false);
    }, [chatOpen]);

    function sendMessage(e: React.FormEvent) {
      e.preventDefault();
      if (!chatInput.trim()) return;
      const msg = { kind: "chat-message" as const, message: chatInput, from: isMe, timestamp: Date.now() };
      setMessages(prev => [...prev, msg]);
      sendSync(msg);
      setChatInput("");
    }

    function handleModeChange(mode: CaptureMode) {
      if (isMe === "left") {
        setCaptureMode(mode);
        sendSync({ kind: "sync-mode", mode });
      }
    }

    // Capture the local video stream in high resolution
    function captureLocalHighResSnapshot(): Promise<string> {
      return new Promise((resolve) => {
        const video = localVideoRef.current;
        if (!video || !canvasRef.current) return resolve("");
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("");

        // 4:3 high res snapshot
        const W = 1600;
        const H = 1200;
        canvas.width = W;
        canvas.height = H;

        // Crop to fill WxH
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();

        const vRatio = video.videoWidth / video.videoHeight;
        const sRatio = W / H;
        let sw = W, sh = H, sx = 0, sy = 0;
        if (vRatio > sRatio) {
          sh = H; sw = H * vRatio; sx = -(sw - W) / 2;
        } else {
          sw = W; sh = W / vRatio; sy = -(sh - H) / 2;
        }

        ctx.translate(sx + sw / 2, sy + sh / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + sw / 2), -(sy + sh / 2));

        ctx.drawImage(video, sx, sy, sw, sh);
        ctx.restore();

        // 0.8 quality keeps the JPEG small enough for rapid WebRTC transfer (usually ~60KB)
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      });
    }

    function stitchCompositeSnapshot(leftDataUrl: string, rightDataUrl: string): Promise<string> {
      return new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve("");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("");

        const W = 1600;
        const H = 1200;
        canvas.width = W;
        canvas.height = H;

        let loaded = 0;
        const imgL = new Image();
        const imgR = new Image();
        
        const draw = () => {
          loaded++;
          if (loaded === 2) {
            // Draw left image cropped to left half
            ctx.drawImage(imgL, W/4, 0, W/2, H, 0, 0, W/2, H);
            // Draw right image cropped to right half
            ctx.drawImage(imgR, W/4, 0, W/2, H, W/2, 0, W/2, H);
            resolve(canvas.toDataURL("image/jpeg", 0.9));
          }
        };

        imgL.onload = draw;
        imgR.onload = draw;
        imgL.src = leftDataUrl;
        imgR.src = rightDataUrl;
      });
    }

    async function handleReceivedSnapshot(index: number, from: "left" | "right", dataUrl: string) {
      pendingSnapshots.current[from] = dataUrl;
      checkAndFinalizeSnapshot(index);
    }

    async function checkAndFinalizeSnapshot(index: number) {
      const { left, right } = pendingSnapshots.current;
      let finalSnapshotUrl = "";

      if (captureMode === "merged") {
        if (!left || !right) return; // Wait for both
        finalSnapshotUrl = await stitchCompositeSnapshot(left, right);
      } else {
        if (captureMode === "left" && !left) return;
        if (captureMode === "right" && !right) return;
        finalSnapshotUrl = captureMode === "left" ? left! : right!;
      }

      // Reset pending for next photo
      pendingSnapshots.current = {};

      setPhotos(prev => {
        const next = [...prev];
        next[index] = finalSnapshotUrl;
        if (next.length >= activeFrame.photoCount) {
          setCompleted(true);
          setIsCapturing(false);
        } else {
          setIsCapturing(false);
        }
        return next;
      });
    }

    function runCountdown(startAt: number, duration: number, index: number, mode: CaptureMode): Promise<void> {
      return new Promise((resolve) => {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = setInterval(async () => {
          const remaining = Math.ceil((startAt + duration - Date.now()) / 1000);
          if (remaining <= 0) {
            clearInterval(countdownTimerRef.current!);
            setCountdown(null);

            // Time's up! Capture our own local high-res camera
            const localDataUrl = await captureLocalHighResSnapshot();
            
            // Send it to the other peer
            sendSync({ kind: "provide-snapshot", index, dataUrl: localDataUrl, from: isMe });
            
            // Register our own snapshot locally
            pendingSnapshots.current[isMe] = localDataUrl;
            
            // Trigger check
            checkAndFinalizeSnapshot(index);
            
            resolve();
          } else {
            setCountdown(remaining);
          }
        }, 100);
      });
    }

  async function triggerSharedCapture() {
    if (!activeFrame) return;
    if (photos.length >= activeFrame.photoCount) return;
    setIsCapturing(true);

    const currentIndex = photos.length;
    const duration = 3000;
    const startAt = Date.now();
    sendSync({ kind: "capture-countdown", startAt, duration, index: currentIndex, mode: captureMode });
    await runCountdown(startAt, duration, currentIndex, captureMode);
  }

  const statusMessage: Record<string, string> = {
    idle: "getting your camera ready…",
    "waiting-for-peer": "waiting for your date to join…",
    connecting: "connecting…",
    connected: "connected",
    "room-full": "this session already has two people in it",
    "peer-left": "your date left the session",
    error: "something went wrong — check camera/mic permissions",
  };

  const chatUI = status === "connected" ? (
    <div className={`fixed z-50 flex flex-col items-end ${isMobile ? 'bottom-0 left-0 right-0 px-3 pb-3' : 'bottom-6 right-6'}`}>
      {chatOpen ? (
        <div className={`bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 ${isMobile ? 'w-full h-[22rem]' : 'w-80 h-[28rem]'}`}>
          <div className="p-3 border-b border-border flex justify-between items-center bg-surface-2">
            <span className="font-mono text-xs font-bold tracking-widest uppercase text-foreground">Chat Session</span>
            <button onClick={() => setChatOpen(false)} className="opacity-50 hover:opacity-100 text-lg leading-none text-foreground">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.length === 0 ? (
              <div className="text-center opacity-50 text-xs mt-4 text-foreground">No messages yet. Say hi!</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.from === isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-1.5 text-sm max-w-[85%] break-words ${
                    m.from === isMe ? 'bg-foreground text-background rounded-2xl rounded-br-sm' : 'bg-surface-0 text-foreground rounded-2xl rounded-bl-sm border border-border'
                  }`}>
                    {m.message}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="p-2 border-t border-border flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-2 border border-border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-foreground text-foreground"
            />
            <button type="submit" disabled={!chatInput.trim()} className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 transition-opacity">
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="w-12 h-12 bg-surface-1 border border-border rounded-full shadow-lg flex items-center justify-center hover:bg-surface-2 transition-colors relative text-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          {unreadChat && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-surface-1"></span>
          )}
        </button>
      )}
    </div>
  ) : null;

  if (completed) {
    return (
      <div className="w-full max-w-3xl mx-auto relative">
        <FinalStrip
          photos={photos}
          frame={activeFrame}
          onRestart={() => {
            setPhotos([]);
            setCompleted(false);
            setCaptureMode("merged");
            sendSync({ kind: "restart-session" });
          }}
        />
        {chatUI}
      </div>
    );
  }

  const currentAspectRatio = activeFrame.layout === 'grid-2x2' ? 1 : 4 / 3;

  return (
    <div className="w-full animate-fadeIn max-w-3xl mx-auto flex flex-col items-center">
      <div className="text-center mb-8">
        <p className={`tracking-[0.25em] uppercase opacity-50 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          Date Session
        </p>
        <h2 className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
          {photos.length > 0 ? (
            <>Photo {photos.length + 1} <span className="opacity-40">of {activeFrame.photoCount}</span></>
          ) : (
            <>Ready</>
          )}
        </h2>
        <p className="mt-2 opacity-60 text-sm">{activeFrame.emoji} {activeFrame.name}</p>
        <p className="mt-1 opacity-40 text-xs">{statusMessage[status] ?? status}</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-3 mb-8">
        {Array.from({ length: activeFrame.photoCount }).map((_, i) => (
          <div key={i} style={{
            width: i === photos.length ? 24 : 10,
            height: 10,
            borderRadius: 5,
            background: i < photos.length ? activeFrame.accentColor : i === photos.length ? activeFrame.borderColor : `${activeFrame.borderColor}30`,
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* Camera viewfinder */}
      <div className="relative overflow-hidden rounded-sm shadow-2xl transition-all duration-300 flex"
        style={{
          aspectRatio: String(currentAspectRatio),
          width: '100%',
          maxWidth: isMobile ? `min(100%, 60vh * ${currentAspectRatio})` : `min(32rem, 55vh * ${currentAspectRatio})`,
          border: `4px solid ${activeFrame.borderColor}`,
          boxShadow: `0 20px 60px ${activeFrame.borderColor}30`,
          background: activeFrame.color,
        }}
      >
        <div className="w-1/2 h-full relative" style={{ display: captureMode === 'right' ? 'none' : 'block', width: captureMode === 'merged' ? '50%' : '100%' }}>
          <video
            ref={isMe === "left" ? localVideoRef : remoteVideoRef}
            autoPlay
            muted={isMe === "left"}
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)', display: 'block' }}
          />
          <div className="absolute bottom-2 left-2 text-[10px] font-mono opacity-50 text-white bg-black/30 px-2 py-0.5 rounded">
            {isMe === "left" ? "YOU" : "DATE"}
          </div>
        </div>
        <div className="w-1/2 h-full relative" style={{ display: captureMode === 'left' ? 'none' : 'block', width: captureMode === 'merged' ? '50%' : '100%', borderLeft: captureMode === 'merged' ? `2px solid ${activeFrame.borderColor}` : 'none' }}>
          <video
            ref={isMe === "left" ? remoteVideoRef : localVideoRef}
            autoPlay
            muted={isMe !== "left"}
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)', display: 'block' }}
          />
          <div className="absolute bottom-2 left-2 text-[10px] font-mono opacity-50 text-white bg-black/30 px-2 py-0.5 rounded">
            {isMe === "left" ? "DATE" : "YOU"}
          </div>
        </div>

        {/* Live / Capturing indicator */}
        {countdown !== null && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-[10px] font-medium tracking-wide">LIVE</span>
          </div>
        )}
        {isCapturing && countdown === null && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(251,191,36,0.3)', border: '1px solid rgba(251,191,36,0.6)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-200 text-[10px] font-medium tracking-wide">RECORDING</span>
          </div>
        )}

        {/* Viewfinder corners */}
        {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-6 h-6`} style={{
            borderTop: i < 2 ? `3px solid ${activeFrame.accentColor}` : 'none',
            borderBottom: i >= 2 ? `3px solid ${activeFrame.accentColor}` : 'none',
            borderLeft: i % 2 === 0 ? `3px solid ${activeFrame.accentColor}` : 'none',
            borderRight: i % 2 === 1 ? `3px solid ${activeFrame.accentColor}` : 'none',
          }} />
        ))}

        {/* Countdown */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className={`text-white font-display font-black ${isMobile ? 'text-6xl' : 'text-9xl'}`}
              style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              {countdown}
            </div>
          </div>
        )}

        {/* Photo label */}
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-xs px-3 py-1 rounded-full"
            style={{ background: `${activeFrame.borderColor}cc`, color: activeFrame.color, letterSpacing: '0.15em' }}>
            PHOTO {Math.min(photos.length + 1, activeFrame.photoCount)}/{activeFrame.photoCount}
          </span>
        </div>
      </div>

      {/* Controls & Shutter */}
      <div className="flex flex-col items-center mt-8 gap-4">
        {isMe === "left" && status === "connected" && countdown === null && !isCapturing && (
          <div className="flex bg-[var(--surface-3)] rounded-full p-1 gap-1 border border-[var(--border)] mb-2 shadow-sm">
            <button
              onClick={() => handleModeChange("left")}
              className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${
                captureMode === "left" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              You
            </button>
            <button
              onClick={() => handleModeChange("merged")}
              className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${
                captureMode === "merged" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Both
            </button>
            <button
              onClick={() => handleModeChange("right")}
              className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${
                captureMode === "right" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Date
            </button>
          </div>
        )}

        {isMe === "left" ? (
          <button
            onClick={triggerSharedCapture}
            disabled={status !== "connected" || countdown !== null || isCapturing}
            className="relative"
            style={{ cursor: status === "connected" && countdown === null && !isCapturing ? 'pointer' : 'not-allowed' }}
          >
            <div style={{
              width: 80, height: 80,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: `4px solid ${activeFrame.borderColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: status === "connected" && countdown === null && !isCapturing ? 1 : 0.5,
              boxShadow: `0 4px 20px ${activeFrame.borderColor}30`,
            }}>
              <div style={{
                width: 44, height: 44,
                borderRadius: '50%',
                background: countdown !== null || isCapturing ? 'var(--accent)' : activeFrame.borderColor,
                transition: 'background 0.3s',
              }} />
            </div>

            {/* Pulse rings when counting or capturing */}
            {(countdown !== null || isCapturing) && (
              <>
                {[1, 2].map(r => (
                  <div key={r} style={{
                    position: 'absolute',
                    inset: -r * 12,
                    borderRadius: '50%',
                    border: `2px solid ${activeFrame.accentColor}`,
                    animation: `pulse-ring 1s ease-out ${r * 0.2}s infinite`,
                  }} />
                ))}
              </>
            )}
          </button>
        ) : (
          <div className="px-6 py-3 border border-[var(--border)] rounded-full font-mono text-sm tracking-wide opacity-50">
            waiting for host...
          </div>
        )}
        <p className="text-xs opacity-40 tracking-widest uppercase">
          {isCapturing && countdown === null ? 'Recording motion...' : countdown !== null ? `Shooting in ${countdown}...` : isMe === "left" && status === "connected" ? 'Press to take next photo' : ''}
        </p>

        {isMe === "left" && status === "connected" && photos.length > 0 && countdown === null && !isCapturing && (
          <button
            onClick={() => {
              setPhotos([]);
              setCaptureMode("merged");
              sendSync({ kind: "restart-session" });
            }}
            className="mt-4 px-4 py-2 border border-[var(--border)] rounded-full text-xs opacity-60 hover:opacity-100 hover:bg-[var(--surface-2)] transition-all"
          >
            ↺ Restart session
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {chatUI}
    </div>
  );
}
