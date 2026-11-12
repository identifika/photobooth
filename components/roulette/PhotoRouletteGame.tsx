"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ALL_ROULETTE_POSES,
  getRandomRoulettePoses,
  RoulettePose,
} from "./roulettePoses";
import {
  playRouletteTick,
  playPoseSelected,
  playCountdownBeep,
  playCameraShutter,
  playFanfare,
} from "./soundEffects";
import { useDatePeerConnection, ConnectionStatus } from "@/lib/useDatePeerConnection";
import {
  Camera,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RotateCcw,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Wifi,
  ChevronLeft,
  ArrowRight,
  MessageCircle,
  Dices,
  Layers,
  Heart,
  Palette,
  Eye,
} from "lucide-react";
import Link from "next/link";

type GameStage = "setup" | "roulette-spin" | "countdown" | "flash" | "preview-round" | "result";
type FrameTheme = "noir" | "cream" | "pink" | "lavender";

const FRAME_THEMES: Record<
  FrameTheme,
  { name: string; bg: string; text: string; subtext: string; border: string; accent: string }
> = {
  noir: {
    name: "Classic Noir",
    bg: "#121215",
    text: "#FFFFFF",
    subtext: "#A1A1AA",
    border: "#27272A",
    accent: "#F43F5E",
  },
  cream: {
    name: "Vintage Cream",
    bg: "#FAF7F2",
    text: "#1C1917",
    subtext: "#78716C",
    border: "#E7E5E4",
    accent: "#D97706",
  },
  pink: {
    name: "Bubblegum Pink",
    bg: "#FFF1F2",
    text: "#881337",
    subtext: "#BE123C",
    border: "#FECDD3",
    accent: "#E11D48",
  },
  lavender: {
    name: "Y2K Lavender",
    bg: "#F5F3FF",
    text: "#2E1065",
    subtext: "#6D28D9",
    border: "#DDD6FE",
    accent: "#7C3AED",
  },
};

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL ?? "ws://localhost:8787";

function generateShortId() {
  return Math.random().toString(36).slice(2, 8);
}

export interface PhotoRouletteSyncPayload {
  kind:
    | "player-name"
    | "start-roulette"
    | "provide-snapshot"
    | "next-round"
    | "restart-roulette";
  name?: string;
  role?: "host" | "guest";
  poses?: RoulettePose[];
  roundIndex?: number;
  from?: "left" | "right";
  dataUrl?: string;
}

export default function PhotoRouletteGame() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  const isHost = !roomParam;
  const isMe: "left" | "right" = isHost ? "left" : "right";

  const [roomId] = useState<string>(() => roomParam || `roulette-${generateShortId()}`);
  const [peerId] = useState<string>(() => (isHost ? `host-${generateShortId()}` : `guest-${generateShortId()}`));

  // Player Names
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");

  const p1Display = player1.trim() || (isHost ? "Aku" : "Pasangan");
  const p2Display = player2.trim() || (!isHost ? "Aku" : "Pasangan");

  // Mode: Duo (WebRTC) vs Solo (Latihan Sendiri)
  const [isSoloMode, setIsSoloMode] = useState(false);

  // Audio / Video Mute state
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  // Game Progress
  const [stage, setStage] = useState<GameStage>("setup");
  const [currentRound, setCurrentRound] = useState(0); // 0..3 (4 rounds)
  const [roulettePoses, setRoulettePoses] = useState<RoulettePose[]>(() => getRandomRoulettePoses(4));
  
  // Roulette spin visual animation
  const [spinningPose, setSpinningPose] = useState<RoulettePose>(roulettePoses[0]);
  const [isSpinning, setIsSpinning] = useState(false);

  // Countdown timer
  const [countdown, setCountdown] = useState<number>(10);

  // Captured photos: 4 composite photo snapshots
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const pendingSnapshotsRef = useRef<{ left?: string; right?: string }>({});

  // Frame Styling for 4-Grid Strip
  const [selectedTheme, setSelectedTheme] = useState<FrameTheme>("noir");
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripPreviewRef = useRef<HTMLDivElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  // --- WebRTC Peer Connection ---
  const handleSyncMessage = useCallback(
    (payload: unknown) => {
      const p = payload as PhotoRouletteSyncPayload;
      if (!p || !p.kind) return;

      switch (p.kind) {
        case "player-name": {
          if (p.role === "guest") {
            setPlayer2(p.name || "");
            showToast(`${p.name || "Pasangan"} bergabung! 🎉`);
          } else if (p.role === "host") {
            setPlayer1(p.name || "");
            showToast(`Terhubung dengan ${p.name || "Host"}! ✨`);
          }
          break;
        }

        case "start-roulette": {
          if (p.poses && p.poses.length > 0) {
            setRoulettePoses(p.poses);
          }
          setCurrentRound(0);
          setCapturedPhotos([]);
          pendingSnapshotsRef.current = {};
          startRouletteSpinRound(0, p.poses || roulettePoses);
          break;
        }

        case "provide-snapshot": {
          if (p.from && p.dataUrl && p.roundIndex !== undefined) {
            handleReceivedSnapshot(p.roundIndex, p.from, p.dataUrl);
          }
          break;
        }

        case "next-round": {
          if (p.roundIndex !== undefined) {
            startRouletteSpinRound(p.roundIndex, roulettePoses);
          }
          break;
        }

        case "restart-roulette": {
          if (p.poses) setRoulettePoses(p.poses);
          setCapturedPhotos([]);
          setCurrentRound(0);
          pendingSnapshotsRef.current = {};
          setStage("setup");
          showToast("Game diulang dari awal! 🔄");
          break;
        }
      }
    },
    [roulettePoses]
  );

  const { status, localStream, remoteStream, sendSync } = useDatePeerConnection({
    signalUrl: SIGNAL_URL,
    roomId,
    peerId,
    isInitiator: isHost,
    onSync: handleSyncMessage,
  });

  const partnerConnected = status === "connected";

  // Attach local media stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, stage]);

  // Attach remote media stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, stage]);

  // Sync names on connection
  useEffect(() => {
    if (partnerConnected && (player1.trim() || player2.trim())) {
      sendSync({
        kind: "player-name",
        role: isHost ? "host" : "guest",
        name: isHost ? player1.trim() : player2.trim(),
      });
    }
  }, [partnerConnected, player1, player2, isHost, sendSync]);

  // Toggle Mute / Video
  function toggleMic() {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setMicMuted(!track.enabled);
      });
    }
  }

  function toggleCamera() {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setCameraOff(!track.enabled);
      });
    }
  }

  // --- Snapshot Capture Helpers ---
  function captureVideoFrame(video: HTMLVideoElement): string {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.videoWidth || !video.videoHeight) return "";

    const W = 1600;
    const H = 1200;
    canvas.width = W;
    canvas.height = H;

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
    ctx.scale(-1, 1); // unmirror for authentic photo feel
    ctx.translate(-(sx + sw / 2), -(sy + sh / 2));

    ctx.drawImage(video, sx, sy, sw, sh);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // Stitch left + right into 1 seamless composite (center split with seam)
  function stitchDuoSnapshot(leftDataUrl: string, rightDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current || document.createElement("canvas");
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
          // Left half
          ctx.drawImage(imgL, W / 4, 0, W / 2, H, 0, 0, W / 2, H);
          // Right half
          ctx.drawImage(imgR, W / 4, 0, W / 2, H, W / 2, 0, W / 2, H);

          // Subtle glowing seam guide
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(W / 2, 0);
          ctx.lineTo(W / 2, H);
          ctx.stroke();

          resolve(canvas.toDataURL("image/jpeg", 0.9));
        }
      };

      imgL.onload = draw;
      imgR.onload = draw;
      imgL.src = leftDataUrl;
      imgR.src = rightDataUrl;
    });
  }

  // Handle incoming remote snapshot
  async function handleReceivedSnapshot(roundIdx: number, from: "left" | "right", dataUrl: string) {
    pendingSnapshotsRef.current[from] = dataUrl;
    checkAndFinalizeRound(roundIdx);
  }

  async function checkAndFinalizeRound(roundIdx: number) {
    const { left, right } = pendingSnapshotsRef.current;
    if (left && right) {
      const merged = await stitchDuoSnapshot(left, right);
      setCapturedPhotos((prev) => {
        const next = [...prev];
        next[roundIdx] = merged;
        return next;
      });

      pendingSnapshotsRef.current = {};
      setStage("preview-round");

      // Auto advance to next round or result
      setTimeout(() => {
        if (roundIdx + 1 < 4) {
          const nextR = roundIdx + 1;
          setCurrentRound(nextR);
          if (isHost) {
            sendSync({ kind: "next-round", roundIndex: nextR });
          }
          startRouletteSpinRound(nextR, roulettePoses);
        } else {
          playFanfare();
          setStage("result");
          showToast("Photo Strip 4-Grid kalian sudah jadi! 💖");
        }
      }, 2600);
    }
  }

  // Trigger local snapshot capture
  async function performSnap(roundIdx: number) {
    setStage("flash");
    playCameraShutter();

    let localSnap = "";
    if (localVideoRef.current) {
      localSnap = captureVideoFrame(localVideoRef.current);
    }

    setTimeout(async () => {
      if (isSoloMode || !partnerConnected) {
        // In solo mode, just save the single camera snapshot
        setCapturedPhotos((prev) => {
          const next = [...prev];
          next[roundIdx] = localSnap;
          return next;
        });
        setStage("preview-round");

        setTimeout(() => {
          if (roundIdx + 1 < 4) {
            const nextR = roundIdx + 1;
            setCurrentRound(nextR);
            startRouletteSpinRound(nextR, roulettePoses);
          } else {
            playFanfare();
            setStage("result");
          }
        }, 2200);
      } else {
        // In Duo WebRTC mode, send local snapshot to partner
        pendingSnapshotsRef.current[isMe] = localSnap;
        sendSync({
          kind: "provide-snapshot",
          roundIndex: roundIdx,
          from: isMe,
          dataUrl: localSnap,
        });

        checkAndFinalizeRound(roundIdx);
      }
    }, 150);
  }

  // Run 10-second countdown
  const startCountdown = useCallback(
    (roundIdx: number) => {
      setStage("countdown");
      setCountdown(10);

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      let currentSec = 10;
      countdownIntervalRef.current = setInterval(() => {
        currentSec -= 1;
        setCountdown(currentSec);
        playCountdownBeep(currentSec);

        if (currentSec <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          performSnap(roundIdx);
        }
      }, 1000);
    },
    [isSoloMode, partnerConnected, isMe, sendSync]
  );

  // Roulette spin sequence
  const startRouletteSpinRound = useCallback(
    (roundIdx: number, poses: RoulettePose[]) => {
      setStage("roulette-spin");
      setIsSpinning(true);

      const targetPose = poses[roundIdx] || poses[0];
      let spinCounter = 0;
      const totalTicks = 18;
      const intervalMs = 90;

      const timer = setInterval(() => {
        spinCounter++;
        const randPose = ALL_ROULETTE_POSES[Math.floor(Math.random() * ALL_ROULETTE_POSES.length)];
        setSpinningPose(randPose);
        playRouletteTick();

        if (spinCounter >= totalTicks) {
          clearInterval(timer);
          setSpinningPose(targetPose);
          setIsSpinning(false);
          playPoseSelected();

          // Wait 1.6s so both players can read the pose challenge, then start countdown!
          setTimeout(() => {
            startCountdown(roundIdx);
          }, 1600);
        }
      }, intervalMs);
    },
    [startCountdown]
  );

  function handleStartRoulette() {
    const poses = getRandomRoulettePoses(4);
    setRoulettePoses(poses);
    setCurrentRound(0);
    setCapturedPhotos([]);
    pendingSnapshotsRef.current = {};

    if (!isSoloMode && partnerConnected) {
      sendSync({
        kind: "start-roulette",
        poses,
      });
    }

    startRouletteSpinRound(0, poses);
  }

  function handleRestart() {
    const poses = getRandomRoulettePoses(4);
    setRoulettePoses(poses);
    setCurrentRound(0);
    setCapturedPhotos([]);
    pendingSnapshotsRef.current = {};

    if (!isSoloMode && partnerConnected) {
      sendSync({
        kind: "restart-roulette",
        poses,
      });
    }

    setStage("setup");
  }

  // --- Invite Links ---
  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/roulette?room=${roomId}`;
  }, [roomId]);

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      showToast("Link room Roulette disalin! Kirim ke pasanganmu ✨");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast("Gagal menyalin link");
    }
  }

  async function handleShareWhatsApp() {
    const text = `Sayang! Yuk masuk ke call "Reaction Photo Roulette" buat photobooth bareng pas call:\n${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  // --- High-Resolution Photo Strip Generator (Canvas) ---
  async function handleSavePhotoStrip() {
    try {
      showToast("Menyiapkan Strip Foto 4-Grid...");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Photo strip proportions (Vertical 4-Grid Photobooth Strip): 1080 x 2400
      const stripW = 1080;
      const stripH = 2500;
      canvas.width = stripW;
      canvas.height = stripH;

      const theme = FRAME_THEMES[selectedTheme];

      // Draw background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, stripW, stripH);

      // Top Header text
      ctx.fillStyle = theme.text;
      ctx.font = "900 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("REACTION PHOTO ROULETTE", stripW / 2, 110);

      ctx.fillStyle = theme.subtext;
      ctx.font = "600 28px sans-serif";
      ctx.fillText("LDR DATE NIGHT SPECIAL", stripW / 2, 155);

      // Load all 4 photos
      const photoImgs = await Promise.all(
        capturedPhotos.map((src) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = src;
          });
        })
      );

      // Draw 4 photos vertically
      const photoW = 920;
      const photoH = 500;
      const startX = 80;
      let startY = 200;

      for (let i = 0; i < photoImgs.length; i++) {
        const img = photoImgs[i];
        const pose = roulettePoses[i] || ALL_ROULETTE_POSES[i];

        // Draw photo frame border
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(startX, startY, photoW, photoH, 20);
        ctx.fill();

        // Draw photo image cropped
        if (img && img.width > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(startX + 6, startY + 6, photoW - 12, photoH - 12, 16);
          ctx.clip();
          ctx.drawImage(img, startX + 6, startY + 6, photoW - 12, photoH - 12);
          ctx.restore();
        }

        // Draw small challenge label on bottom-left of photo
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(startX + 20, startY + photoH - 52, 420, 38, 19);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`★ #${i + 1} ${pose.title}`, startX + 36, startY + photoH - 26);

        startY += photoH + 28;
      }

      // Footer: Date & Names
      const today = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      ctx.textAlign = "center";
      ctx.fillStyle = theme.text;
      ctx.font = "800 36px sans-serif";
      ctx.fillText(`${p1Display}  ❤️  ${p2Display}`, stripW / 2, startY + 50);

      ctx.fillStyle = theme.subtext;
      ctx.font = "500 24px sans-serif";
      ctx.fillText(`${today} · Photobooth Spontan LDR`, stripW / 2, startY + 90);

      // Aesthetic Barcode
      const barY = startY + 120;
      ctx.fillStyle = theme.subtext;
      const bars = [8, 4, 12, 6, 16, 4, 8, 10, 6, 14, 8, 4, 12, 6, 8, 10, 4, 14, 6, 8];
      let curX = stripW / 2 - 180;
      for (const b of bars) {
        ctx.fillRect(curX, barY, b, 32);
        curX += b + 8;
      }

      // Trigger download
      const link = document.createElement("a");
      link.download = `photo-roulette-${p1Display}-${p2Display}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Strip foto berhasil disimpan! 📸");
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan strip foto");
    }
  }

  async function handleShareStrip() {
    const text = `Hasil Reaction Photo Roulette kita malam ini! 4 ronde pose spontan bareng ${p2Display} ❤️`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Reaction Photo Roulette",
          text,
          url: window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.href}`);
      showToast("Link berhasil disalin!");
    }
  }

  const currentPose = roulettePoses[currentRound] || roulettePoses[0];

  return (
    <div className="min-h-screen bg-[#090A10] text-slate-100 flex items-center justify-center p-0 md:p-6 font-['Poppins',sans-serif] selection:bg-[#FF2E93]">
      <canvas ref={canvasRef} className="hidden" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#181824] text-white px-5 py-3 rounded-full text-xs md:text-sm font-semibold shadow-2xl border border-white/20 animate-fade-in flex items-center gap-2 max-w-[90%] text-center">
          <span>📸</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile / Screen Frame */}
      <div className="w-full max-w-[480px] min-h-screen md:min-h-[860px] md:max-h-[920px] md:rounded-[42px] overflow-hidden shadow-2xl relative flex flex-col justify-between bg-[#12131C] border border-white/10">

        {/* ======================================================== */}
        {/* STAGE 1: SETUP & LOBBY */}
        {/* ======================================================== */}
        {stage === "setup" && (
          <div className="flex-1 flex flex-col justify-between p-5 relative select-none">
            {/* Top Bar Header */}
            <div className="flex items-center justify-between z-10 pt-1">
              <Link
                href="/date"
                className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </Link>
              <div className="bg-gradient-to-r from-[#FF2E93]/20 to-[#8B5CF6]/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-white border border-white/15 flex items-center gap-1.5">
                <Dices className="w-3.5 h-3.5 text-[#FF2E93]" />
                <span>Reaction Photo Roulette</span>
              </div>
            </div>

            {/* Camera Preview Box with WebRTC Controls */}
            <div className="my-auto py-2 space-y-3">
              <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-black/60 border-2 border-white/10 shadow-xl flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    cameraOff ? "hidden" : "block"
                  }`}
                />
                {cameraOff && (
                  <div className="flex flex-col items-center gap-2 text-white/50 text-xs">
                    <VideoOff className="w-8 h-8" />
                    <span>Kamera dimatikan</span>
                  </div>
                )}

                {/* Bottom Overlay Controls */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{isHost ? "Kameramu (Kiri)" : "Kameramu (Kanan)"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMic}
                      className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                        micMuted ? "bg-red-500 text-white border-red-400" : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                      }`}
                    >
                      {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={toggleCamera}
                      className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                        cameraOff ? "bg-red-500 text-white border-red-400" : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                      }`}
                    >
                      {cameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode Toggle: Duo Call vs Solo Test */}
              <div className="bg-white/5 p-1 rounded-2xl flex items-center border border-white/10">
                <button
                  onClick={() => setIsSoloMode(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !isSoloMode ? "bg-[#FF2E93] text-white shadow-md" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Call Berdua (WebRTC)</span>
                </button>
                <button
                  onClick={() => setIsSoloMode(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSoloMode ? "bg-[#FF2E93] text-white shadow-md" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Latihan Solo</span>
                </button>
              </div>

              {/* Call Room Link Sharing (Only in Duo Mode) */}
              {!isSoloMode && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          partnerConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-pulse"
                        }`}
                      />
                      <span>{partnerConnected ? "Pasangan Sudah Terhubung! 🎉" : "Menunggu Pasangan Bergabung..."}</span>
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">Room: {roomId.slice(0, 8)}</span>
                  </div>

                  {!partnerConnected && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleCopyInvite}
                        className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? "Link Tersalin!" : "Salin Link"}</span>
                      </button>
                      <button
                        onClick={handleShareWhatsApp}
                        className="bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>Kirim WA</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Name Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60 uppercase px-1">Namamu</label>
                  <input
                    type="text"
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="Contoh: Rama"
                    maxLength={15}
                    className="w-full bg-white/10 text-white font-bold text-sm px-3.5 py-2.5 rounded-xl outline-none border border-white/10 focus:border-[#FF2E93] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60 uppercase px-1">Nama Pasangan</label>
                  <input
                    type="text"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="Contoh: Putri"
                    maxLength={15}
                    className="w-full bg-white/10 text-white font-bold text-sm px-3.5 py-2.5 rounded-xl outline-none border border-white/10 focus:border-[#FF2E93] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleStartRoulette}
                disabled={!isSoloMode && !partnerConnected}
                className={`w-full font-black text-base py-4 px-6 rounded-2xl shadow-xl flex items-center justify-between transition-all cursor-pointer ${
                  isSoloMode || partnerConnected
                    ? "bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] text-white hover:opacity-95 active:scale-[0.98]"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Dices className="w-5 h-5 animate-spin-slow" />
                  <span>{isSoloMode || partnerConnected ? "Mulai Photo Roulette (4 Ronde)!" : "Menunggu Pasangan Masuk..."}</span>
                </div>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 2: ROULETTE SPIN VISUAL ANIMATION */}
        {/* ======================================================== */}
        {stage === "roulette-spin" && (
          <div className="flex-1 bg-gradient-to-b from-[#1E112A] via-[#12131C] to-[#0A0713] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in text-center">
            {/* Top Indicator */}
            <div className="flex items-center justify-center pt-2">
              <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1.5 border border-white/15">
                <Layers className="w-3.5 h-3.5 text-[#FF2E93]" />
                <span>Ronde {currentRound + 1} dari 4</span>
              </div>
            </div>

            {/* Roulette Wheel Slot Card */}
            <div className="my-auto flex flex-col items-center justify-center">
              <div className="text-xs uppercase font-extrabold tracking-widest text-white/50 mb-3">
                {isSpinning ? "Memutar Tantangan Pose..." : "Tantangan Terpilih! 🎯"}
              </div>

              {/* Animated Slot Box */}
              <div
                className={`w-full max-w-sm p-6 rounded-3xl border-2 transition-all duration-200 shadow-2xl relative overflow-hidden ${
                  isSpinning
                    ? "bg-white/10 border-white/20 scale-95"
                    : "bg-gradient-to-b from-[#FF2E93]/20 to-[#8B5CF6]/20 border-[#FF2E93] scale-100 ring-4 ring-[#FF2E93]/30"
                }`}
              >
                <span className="text-6xl block mb-2 animate-bounce">
                  {spinningPose.emoji}
                </span>

                <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white mb-2">
                  {spinningPose.badge}
                </div>

                <h2 className="text-2xl font-black text-white leading-tight mb-2">
                  {spinningPose.title}
                </h2>

                <p className="text-xs text-white/80 leading-relaxed max-w-xs mx-auto">
                  {spinningPose.subtitle}
                </p>
              </div>

              {/* Bottom hint */}
              <div className="mt-6 text-xs text-amber-300 font-semibold animate-pulse">
                {isSpinning ? "🎰 Bersiap strike a pose..." : "⏳ Memulai countdown 10 detik..."}
              </div>
            </div>

            <div className="text-[11px] text-white/40 pb-2">
              Kamera kedua HP akan otomatis menjepret berbarengan!
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 3: LIVE COUNTDOWN WITH CENTER SEAM GUIDE */}
        {/* ======================================================== */}
        {(stage === "countdown" || stage === "flash") && (
          <div className="flex-1 bg-black flex flex-col justify-between relative select-none overflow-hidden">
            {/* White Flash Effect on Snap */}
            {stage === "flash" && (
              <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none" />
            )}

            {/* Split Video Container */}
            <div className="absolute inset-0 flex">
              {/* Left Video (Host / Local) */}
              <div className="flex-1 h-full relative overflow-hidden bg-slate-900 border-r border-white/20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-[10px] font-bold text-white backdrop-blur-md">
                  {p1Display}
                </div>
              </div>

              {/* Right Video (Partner or Mock Partner) */}
              <div className="flex-1 h-full relative overflow-hidden bg-slate-950">
                {!isSoloMode && remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full relative overflow-hidden">
                    {/* In Solo Mode, mirror the camera for fun pose alignment */}
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform scale-x-100 opacity-80"
                    />
                    <div className="absolute inset-0 bg-purple-900/20 backdrop-blur-[1px]" />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-[10px] font-bold text-white backdrop-blur-md">
                  {p2Display}
                </div>
              </div>

              {/* Center Seam Guide (Crucial for "Half-Heart" alignment) */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-dashed border-l-2 border-dashed border-[#FF2E93] z-20 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#FF2E93] text-white flex items-center justify-center shadow-lg -translate-x-[15px] animate-pulse">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
              </div>
            </div>

            {/* Top Prompt Banner */}
            <div className="relative z-30 p-4 pt-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-center">
              <div className="inline-flex items-center gap-1.5 bg-[#FF2E93] text-white px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide mb-1.5 shadow-md">
                <span>Ronde {currentRound + 1}/4: {currentPose.title}</span>
              </div>
              <p className="text-xs md:text-sm font-extrabold text-white drop-shadow-md max-w-xs mx-auto">
                {currentPose.subtitle}
              </p>
            </div>

            {/* Giant Countdown Ring & Number */}
            <div className="relative z-30 my-auto flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 rounded-full bg-black/60 backdrop-blur-md border-4 border-[#FF2E93] flex items-center justify-center shadow-2xl animate-scale-up">
                <span className="text-5xl font-black text-white leading-none">
                  {countdown}
                </span>
              </div>
            </div>

            {/* Bottom Center Seam Reminder */}
            <div className="relative z-30 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-center">
              <div className="inline-block bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[11px] font-bold text-yellow-300 border border-white/15">
                💡 {currentPose.hint}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 4: QUICK ROUND SNAPSHOT PREVIEW */}
        {/* ======================================================== */}
        {stage === "preview-round" && (
          <div className="flex-1 bg-[#12131C] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in text-center">
            <div className="flex items-center justify-center pt-2">
              <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Ronde {currentRound + 1} Berhasil Dijepret!</span>
              </div>
            </div>

            <div className="my-auto flex flex-col items-center justify-center">
              <div className="relative w-full max-w-xs aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 mb-3 bg-black">
                {capturedPhotos[currentRound] ? (
                  <img
                    src={capturedPhotos[currentRound]}
                    alt={`Ronde ${currentRound + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xs text-white/50">
                    Memproses foto...
                  </div>
                )}
              </div>

              <h3 className="text-lg font-black text-white">
                {currentPose.emoji} {currentPose.title}
              </h3>
              <p className="text-xs text-white/70 mt-1">
                {currentRound + 1 < 4
                  ? "Bagus banget! Siap-siap pose di ronde berikutnya..."
                  : "Semua ronde selesai! Menyiapkan Strip Foto... 🎉"}
              </p>
            </div>

            <div className="text-[11px] text-white/40 pb-2">
              Lanjut otomatis dalam 2 detik...
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 5: FINAL RESULT 4-GRID PHOTO STRIP */}
        {/* ======================================================== */}
        {stage === "result" && (
          <div className="flex-1 bg-[#090A10] flex flex-col justify-between p-4 relative select-none overflow-y-auto">
            {/* Top Bar */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <div className="flex items-center gap-1.5 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-bold text-white border border-white/15">
                <Sparkles className="w-3.5 h-3.5 text-[#FF2E93]" />
                <span>Photo Strip 4-Grid Selesai!</span>
              </div>

              {/* Theme Picker Pills */}
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/10">
                {(Object.keys(FRAME_THEMES) as FrameTheme[]).map((thm) => (
                  <button
                    key={thm}
                    onClick={() => setSelectedTheme(thm)}
                    title={FRAME_THEMES[thm].name}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer border ${
                      selectedTheme === thm ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: FRAME_THEMES[thm].bg, borderColor: FRAME_THEMES[thm].border }}
                  />
                ))}
              </div>
            </div>

            {/* The Photobooth Strip Preview */}
            <div
              ref={stripPreviewRef}
              className="my-auto mx-auto w-full max-w-[340px] rounded-3xl p-4 shadow-2xl border transition-all duration-300"
              style={{
                backgroundColor: FRAME_THEMES[selectedTheme].bg,
                borderColor: FRAME_THEMES[selectedTheme].border,
              }}
            >
              {/* Strip Header */}
              <div className="text-center pb-3">
                <h4
                  className="text-xs font-black uppercase tracking-wider leading-tight"
                  style={{ color: FRAME_THEMES[selectedTheme].text }}
                >
                  Reaction Photo Roulette
                </h4>
                <p
                  className="text-[10px] font-bold opacity-60 tracking-widest mt-0.5"
                  style={{ color: FRAME_THEMES[selectedTheme].subtext }}
                >
                  LDR DATE NIGHT SPECIAL
                </p>
              </div>

              {/* 4 Photo Grids */}
              <div className="space-y-2.5">
                {capturedPhotos.map((photoUrl, idx) => {
                  const pose = roulettePoses[idx] || ALL_ROULETTE_POSES[idx];
                  return (
                    <div
                      key={idx}
                      className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-black/40 shadow-sm border border-white/10 group"
                    >
                      <img
                        src={photoUrl}
                        alt={`Ronde ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Label on bottom left */}
                      <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-extrabold text-white flex items-center gap-1">
                        <span>{pose.emoji}</span>
                        <span>#{idx + 1} {pose.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Strip Footer */}
              <div className="text-center pt-4 pb-1">
                <div
                  className="text-sm font-black tracking-tight"
                  style={{ color: FRAME_THEMES[selectedTheme].text }}
                >
                  {p1Display} ❤️ {p2Display}
                </div>
                <div
                  className="text-[10px] font-semibold opacity-60 mt-0.5"
                  style={{ color: FRAME_THEMES[selectedTheme].subtext }}
                >
                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })} · Photobooth Spontan
                </div>

                {/* Mini Barcode */}
                <div className="flex items-center justify-center gap-1 pt-2 opacity-30">
                  <span className="w-1.5 h-4 bg-current" />
                  <span className="w-1 h-4 bg-current" />
                  <span className="w-3 h-4 bg-current" />
                  <span className="w-1 h-4 bg-current" />
                  <span className="w-2 h-4 bg-current" />
                  <span className="w-1.5 h-4 bg-current" />
                  <span className="w-3 h-4 bg-current" />
                  <span className="w-1 h-4 bg-current" />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="grid grid-cols-3 gap-2 pt-3 pb-1">
              <button
                onClick={handleRestart}
                className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[11px]">Main Lagi</span>
              </button>

              <button
                onClick={handleSavePhotoStrip}
                className="bg-[#FF2E93] hover:bg-[#E11D74] text-white font-extrabold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="text-[11px]">Simpan Strip</span>
              </button>

              <button
                onClick={handleShareStrip}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-[11px]">Bagikan</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
