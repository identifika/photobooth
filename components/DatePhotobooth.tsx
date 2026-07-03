"use client";

import { useEffect, useRef, useState } from "react";
import { useDatePeerConnection } from "@/lib/useDatePeerConnection";
import { Frame, FRAMES, layoutToConfig } from "@/lib/frames";
import FinalStrip from "@/components/FinalStrip";
import StripPreview from "@/components/StripPreview";
import BackgroundSelector, { EditorSyncData } from "@/components/BackgroundSelector";
import { useIsMobile } from "@/hooks/useIsMobile";
import PhotoReview from "./PhotoReview";
import ChatPanel, { ChatMessage } from "./ChatPanel";
import DualCameraView from "./DualCameraView";

export type CaptureMode = "left" | "right" | "merged";

  type SyncPayload =
  | { kind: "sync-frame"; frame: Frame; mode: CaptureMode }
  | { kind: "sync-mode"; mode: CaptureMode }
  | { kind: "sync-step"; step: "capture" | "photo-review" | "review" | "enhance" | "final"; filter?: string; compositedPhotos?: string[] }
  | { kind: "photo-decision"; action: "accept" | "retry"; photoUrl?: string }
  | { kind: "sync-filter"; filter: string }
  | { kind: "sync-editor"; data: EditorSyncData }
  | { kind: "sync-upload"; url: string }
  | { kind: "retake-photo"; index: number }
  | { kind: "capture-countdown"; startAt: number; duration: number; index: number; mode: CaptureMode }
  | { kind: "provide-snapshot"; index: number; dataUrl: string; from: "left" | "right" }
  | { kind: "chat-message"; message: string; from: "left" | "right"; timestamp: number }
  | { kind: "restart-session" }
  | { kind: "session-ended" };

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
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [step, setStep] = useState<"capture" | "photo-review" | "review" | "enhance" | "final">("capture");
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>();
  const [editorSyncData, setEditorSyncData] = useState<EditorSyncData | undefined>();
  const [compositedPhotos, setCompositedPhotos] = useState<string[] | undefined>();
  
  const [sessionEndedByHost, setSessionEndedByHost] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);

  // Hold pending snapshots from both sides for the current photo index
  const pendingSnapshots = useRef<{ left?: string, right?: string }>({});

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFrame = frame || { ...DEFAULT_FRAME, config: layoutToConfig(DEFAULT_FRAME.layout, DEFAULT_FRAME.photoCount) };
  const isMobile = useIsMobile();

  const { status, localStream, remoteStream, sendSync, credentialExpiresAt } = useDatePeerConnection({
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
        setCompositedPhotos(undefined);
        setEditorSyncData(undefined);
        setStep("capture");
        setRetakeIndex(null);
        setSelectedFilter("");
        setUploadedUrl(undefined);
        setCaptureMode("merged");
        setCountdown(null);
        setIsCapturing(false);
        pendingSnapshots.current = {};
      } else if (p.kind === "sync-step") {
        setStep(p.step);
        if (p.filter !== undefined) setSelectedFilter(p.filter);
        if (p.compositedPhotos !== undefined) setPhotos(p.compositedPhotos);
      } else if (p.kind === "photo-decision") {
        handlePhotoDecision(p.action, p.photoUrl, false);
      } else if (p.kind === "retake-photo") {
        setRetakeIndex(p.index);
        setStep("capture");
      } else if (p.kind === "sync-filter") {
        setSelectedFilter(p.filter);
      } else if (p.kind === "sync-editor") {
        setEditorSyncData(p.data);
      } else if (p.kind === "sync-upload") {
        setUploadedUrl(p.url);
      } else if (p.kind === "session-ended") {
        setSessionEndedByHost(true);
      }
    },
  });

  useEffect(() => {
    const handleRequestEnd = () => {
      sendSync({ kind: "session-ended" });
    };
    window.addEventListener('request-end-session', handleRequestEnd);
    return () => window.removeEventListener('request-end-session', handleRequestEnd);
  }, [sendSync]);

  // Sync frame to guest when connected
  useEffect(() => {
    if (status === "connected" && isMe === "left" && frame) {
      sendSync({ kind: "sync-frame", frame, mode: captureMode });
    }
  }, [status, isMe, frame, sendSync]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, step]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    // Always attach stream to the persistent audio element so voice continues across steps
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, step]);

  // Live countdown of ICE credential TTL — visible only while waiting for guest
  const [credentialSecondsLeft, setCredentialSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!credentialExpiresAt || status !== "waiting-for-peer") {
      setCredentialSecondsLeft(null);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.round((credentialExpiresAt.getTime() - Date.now()) / 1000));
      setCredentialSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [credentialExpiresAt, status]);

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
          ctx.drawImage(imgL, W / 4, 0, W / 2, H, 0, 0, W / 2, H);
          // Draw right image cropped to right half
          ctx.drawImage(imgR, W / 4, 0, W / 2, H, W / 2, 0, W / 2, H);
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

    setPendingPhoto(finalSnapshotUrl);
    setStep("photo-review");
    setIsCapturing(false);
  }

  function handlePhotoDecision(action: "accept" | "retry", photoUrl?: string, broadcast = true) {
    if (broadcast) {
      sendSync({ kind: "photo-decision", action, photoUrl });
    }

    if (action === "retry") {
      setPendingPhoto(null);
      setStep("capture");
    } else if (action === "accept" && photoUrl) {
      setPhotos(prev => {
        const next = [...prev];
        const targetIndex = retakeIndex !== null ? retakeIndex : next.length;
        next[targetIndex] = photoUrl;
        
        if (retakeIndex !== null) {
          if (isMe === "left" && broadcast) sendSync({ kind: "sync-step", step: "review" });
          setStep("review");
          setRetakeIndex(null);
        } else if (next.length >= activeFrame.photoCount) {
          setStep("review");
          if (isMe === "left" && broadcast) sendSync({ kind: "sync-step", step: "review" });
        } else {
          setStep("capture");
          if (isMe === "left" && broadcast) sendSync({ kind: "sync-step", step: "capture" });
        }
        return next;
      });
      setPendingPhoto(null);
    }
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
    const targetIndex = retakeIndex !== null ? retakeIndex : photos.length;
    if (targetIndex >= activeFrame.photoCount) return;

    const startAt = Date.now() + 1000;
    const duration = 3000;

    sendSync({ kind: "capture-countdown", startAt, duration, index: targetIndex, mode: captureMode });
    runCountdown(startAt, duration, targetIndex, captureMode);
  }

  const statusMessage: Record<string, string> = {
    "idle": "initializing…",
    "waiting-for-peer": "waiting for your partner to join…",
    "connecting": "connecting to your partner…",
    "connected": "connected",
    "room-full": "room is full",
    "peer-left": "your partner disconnected — waiting for reconnect…",
    "error": "connection error",
  };

  const chatUI = status === "connected" ? (
    <ChatPanel
      isMobile={isMobile}
      messages={messages}
      isMe={isMe}
      chatOpen={chatOpen}
      setChatOpen={setChatOpen}
      unreadChat={unreadChat}
      onSendMessage={(text) => {
        sendSync({ kind: "chat-message", message: text, from: isMe, timestamp: Date.now() });
        setMessages(prev => [...prev, { message: text, from: isMe, timestamp: Date.now() }]);
      }}
    />
  ) : null;

  let mainContent;

  if (sessionEndedByHost) {
    mainContent = (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full">
        <div className="bg-surface-1 border border-border p-8 rounded-2xl shadow-xl max-w-sm w-full text-center animate-in zoom-in fade-in duration-300">
          <h2 className="text-xl font-semibold text-foreground mb-3">Session Ended</h2>
          <p className="text-foreground/70 mb-8">
            The host has ended this date session. You can safely return to the home screen.
          </p>
          <button 
            onClick={() => window.location.href = '/date'} 
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  } else if (step === "photo-review" && pendingPhoto) {
    mainContent = (
      <div className="w-full max-w-3xl mx-auto relative">
        <PhotoReview
          photoUrl={pendingPhoto}
          photoIndex={retakeIndex !== null ? retakeIndex : photos.length}
          totalPhotos={activeFrame.photoCount}
          frame={activeFrame}
          onAccept={(url) => handlePhotoDecision("accept", url)}
          onRetry={() => handlePhotoDecision("retry")}
        />
        {chatUI}
      </div>
    );
  } else if (step === "review") {
    mainContent = (
      <div className="w-full max-w-3xl mx-auto relative">
        <StripPreview
          photos={photos}
          frame={activeFrame}
          onRetakePhoto={(index) => {
            setRetakeIndex(index);
            setStep("capture");
            sendSync({ kind: "retake-photo", index });
          }}
          onConfirm={() => {
            setStep("enhance");
            sendSync({ kind: "sync-step", step: "enhance" });
          }}
        />
        {chatUI}
      </div>
    );
  } else if (step === "enhance") {
    mainContent = (
      <div className="w-full relative">
        <BackgroundSelector
          photos={photos}
          frame={activeFrame}
          syncData={editorSyncData}
          onSync={(data) => {
            setEditorSyncData(data);
            sendSync({ kind: "sync-editor", data });
          }}
          onComplete={(newCompositedPhotos) => {
            setCompositedPhotos(newCompositedPhotos);
            setStep("final");
            sendSync({ kind: "sync-step", step: "final", compositedPhotos: newCompositedPhotos });
          }}
        />
        {chatUI}
      </div>
    );
  } else if (step === "final") {
    mainContent = (
      <div className="w-full max-w-3xl mx-auto relative">
        <FinalStrip
          photos={compositedPhotos || photos}
          frame={activeFrame}
          filter={selectedFilter}
          uploadedUrl={uploadedUrl}
          onUploadComplete={(url) => {
            setUploadedUrl(url);
            sendSync({ kind: "sync-upload", url });
          }}
          onRestart={() => {
            setPhotos([]);
            setCompositedPhotos(undefined);
            setEditorSyncData(undefined);
            setStep("capture");
            setRetakeIndex(null);
            setSelectedFilter("");
            setUploadedUrl(undefined);
            setCaptureMode("merged");
            sendSync({ kind: "restart-session" });
          }}
        />
        {chatUI}
      </div>
    );
  } else {
    const currentAspectRatio = activeFrame.layout === 'grid-2x2' ? 1 : 4 / 3;
    mainContent = (
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

        {/* ICE credential countdown — host only, while waiting for guest */}
        {isMe === "left" && status === "waiting-for-peer" && credentialSecondsLeft !== null && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono mb-2 transition-colors ${
            credentialSecondsLeft <= 30
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${credentialSecondsLeft <= 30 ? 'bg-red-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
            <span>
              Link valid for{' '}
              <span className={`font-bold tabular-nums ${credentialSecondsLeft <= 30 ? 'text-red-300' : 'text-[var(--text-primary)]'}`}>
                {String(Math.floor(credentialSecondsLeft / 60)).padStart(2, '0')}:{String(credentialSecondsLeft % 60).padStart(2, '0')}
              </span>
            </span>
            {credentialSecondsLeft === 0 && (
              <span className="ml-1 text-red-400">— refresh the page to reconnect</span>
            )}
          </div>
        )}

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
        <DualCameraView
          currentAspectRatio={currentAspectRatio}
          isMobile={isMobile}
          activeFrame={activeFrame}
          captureMode={captureMode}
          isMe={isMe}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          countdown={countdown}
          isCapturing={isCapturing}
          photoCount={photos.length}
        />

        {/* Controls & Shutter */}
        <div className="flex flex-col items-center mt-8 gap-4">
          {isMe === "left" && status === "connected" && countdown === null && !isCapturing && (
            <div className="flex bg-[var(--surface-3)] rounded-full p-1 gap-1 border border-[var(--border)] mb-2 shadow-sm">
              <button
                onClick={() => handleModeChange("left")}
                className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${captureMode === "left" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
              >
                You
              </button>
              <button
                onClick={() => handleModeChange("merged")}
                className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${captureMode === "merged" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
              >
                Both
              </button>
              <button
                onClick={() => handleModeChange("right")}
                className={`py-1.5 px-4 rounded-full text-xs font-mono transition-colors ${captureMode === "right" ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                setCompositedPhotos(undefined);
                setEditorSyncData(undefined);
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

  return (
    <>
      {/* Persistent remote audio to ensure conversation continues across steps */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      {mainContent}
    </>
  );
}
