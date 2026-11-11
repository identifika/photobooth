"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  YellowEgg,
  PinkFlower,
  GreenCircle,
  PurpleArch,
  OrangeSquare,
  SparkleStar,
} from "./ShapeCharacters";
import {
  DEFAULT_QUESTIONS,
  calculateCoupleResult,
} from "./quizData";
import {
  ChevronLeft,
  ArrowRight,
  RotateCcw,
  Download,
  Share2,
  Eye,
  Copy,
  Check,
  Smartphone,
  Wifi,
  Sparkles,
  Users,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useTebakKitaRelay, GameSyncMessage } from "./useTebakKitaRelay";

type GameMode = "pass-phone" | "online";
type GameStage = "start" | "lobby-waiting" | "playing" | "pass-phone" | "result";

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL ?? "ws://localhost:8787";

function generateShortId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function TebakKitaGame() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  // Mode: 1 HP (pass-phone) or 2 HP (online)
  const [mode, setMode] = useState<GameMode>(roomParam ? "online" : "pass-phone");
  const isHost = !roomParam;

  // Session Identifiers for Online Mode
  const [roomId, setRoomId] = useState<string>(() => roomParam || `tk-${generateShortId()}`);
  const [peerId] = useState<string>(() => (isHost ? `host-${generateShortId()}` : `guest-${generateShortId()}`));

  // Player Names
  const [player1, setPlayer1] = useState(isHost ? "Dinda" : "Pasangan"); // Host name
  const [player2, setPlayer2] = useState(isHost ? "Raka" : "Aku"); // Guest name

  const myRole = isHost ? "host" : "guest";
  const myName = myRole === "host" ? player1 : player2;
  const partnerName = myRole === "host" ? player2 : player1;

  // Game Progress
  const [stage, setStage] = useState<GameStage>(roomParam ? "lobby-waiting" : "start");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"player1" | "player2">("player1");

  // Answers store: qId -> { player1?: 'player1'|'player2', player2?: 'player1'|'player2' }
  const [answers, setAnswers] = useState<
    Record<number, { player1?: "player1" | "player2"; player2?: "player1" | "player2" }>
  >({});

  // Online Synchronization States
  const [myChoice, setMyChoice] = useState<"player1" | "player2" | null>(null);
  const [myLocked, setMyLocked] = useState(false);
  const [partnerLocked, setPartnerLocked] = useState(false);
  const [revealPopup, setRevealPopup] = useState<{
    matched: boolean;
    p1ChoiceName: string;
    p2ChoiceName: string;
  } | null>(null);

  // UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);

  const currentQ = DEFAULT_QUESTIONS[currentQIndex];

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  // --- Realtime Relay Hook Setup ---
  const handleRelayMessage = useCallback(
    (msg: GameSyncMessage) => {
      console.log("[TebakKita Game] Handling relay message:", msg);
      switch (msg.type) {
        case "player-info": {
          if (msg.role === "guest") {
            setPlayer2(msg.name);
            showToast(`${msg.name} bergabung ke room! 🎉`);
          } else if (msg.role === "host") {
            setPlayer1(msg.name);
            showToast(`Terhubung dengan ${msg.name}! ✨`);
          }
          break;
        }

        case "start-game": {
          console.log("[TebakKita Game] start-game received! Transitioning to playing...");
          setPlayer1(msg.hostName);
          setPlayer2(msg.guestName);
          setAnswers({});
          setCurrentQIndex(0);
          setMyLocked(false);
          setPartnerLocked(false);
          setMyChoice(null);
          setRevealPopup(null);
          setStage("playing");
          showToast("Game dimulai! Selamat bermain berdua ✨");
          break;
        }

        case "lock-answer": {
          setPartnerLocked(true);
          showToast(`${partnerName} sudah mengunci jawaban! ⚡`);
          break;
        }

        case "reveal-answer": {
          const targetQ = DEFAULT_QUESTIONS[msg.questionIndex];
          if (targetQ) {
            const partnerRole = msg.fromRole;
            const partnerAnswer = msg.choice;

            setAnswers((prev) => {
              const qId = targetQ.id;
              const cur = prev[qId] || {};
              const updated = {
                ...cur,
                [partnerRole === "host" ? "player1" : "player2"]: partnerAnswer,
              };
              return { ...prev, [qId]: updated };
            });
          }
          break;
        }

        case "restart-game": {
          setAnswers({});
          setCurrentQIndex(0);
          setMyLocked(false);
          setPartnerLocked(false);
          setMyChoice(null);
          setRevealPopup(null);
          setShowBreakdown(false);
          setStage("playing");
          showToast("Game diulang kembali! 🚀");
          break;
        }
      }
    },
    [partnerName]
  );

  const { status: relayStatus, partnerConnected, sendMessage } = useTebakKitaRelay({
    signalUrl: SIGNAL_URL,
    roomId: mode === "online" ? roomId : "",
    peerId: mode === "online" ? peerId : "",
    isHost,
    onMessage: handleRelayMessage,
    onPartnerJoined: () => {
      // Exchange names upon partner connection
      sendMessage({
        type: "player-info",
        name: myName,
        role: myRole,
      });
      showToast("Pasangan terhubung! Siap main ✨");
    },
    onPartnerLeft: () => {
      showToast("Pasangan terputus dari room ⚠️");
    },
  });

  // Re-broadcast player name when partner connects or when name changes in lobby
  useEffect(() => {
    if (mode === "online" && partnerConnected && myName.trim()) {
      sendMessage({
        type: "player-info",
        name: myName,
        role: myRole,
      });
    }
  }, [mode, partnerConnected, myName, myRole, sendMessage]);

  // Check if both players have answered in online mode to trigger reveal
  useEffect(() => {
    if (mode !== "online" || stage !== "playing" || !currentQ) return;

    const qAns = answers[currentQ.id];
    if (qAns && qAns.player1 && qAns.player2 && !revealPopup) {
      const isMatch = qAns.player1 === qAns.player2;
      const p1ChoiceName = qAns.player1 === "player1" ? player1 : player2;
      const p2ChoiceName = qAns.player2 === "player1" ? player1 : player2;

      setRevealPopup({
        matched: isMatch,
        p1ChoiceName,
        p2ChoiceName,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(isMatch ? [40, 60, 40] : 30);
      }

      // Auto advance to next question after 2 seconds
      const timer = setTimeout(() => {
        setRevealPopup(null);
        setMyLocked(false);
        setPartnerLocked(false);
        setMyChoice(null);

        if (currentQIndex < DEFAULT_QUESTIONS.length - 1) {
          setCurrentQIndex((prev) => prev + 1);
        } else {
          setStage("result");
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [answers, currentQ, currentQIndex, mode, player1, player2, revealPopup, stage]);

  // --- Handlers ---

  function handleStartPassPhone() {
    if (!player1.trim() || !player2.trim()) {
      showToast("Tulis nama kalian berdua dulu ya!");
      return;
    }
    setAnswers({});
    setCurrentQIndex(0);
    setCurrentTurn("player1");
    setStage("playing");
  }

  function handleStartOnlineHost() {
    if (!player1.trim()) {
      showToast("Tulis namamu dulu!");
      return;
    }
    if (!partnerConnected) {
      showToast("Tunggu pasangan join room dulu ya!");
      return;
    }
    const finalPlayer2 = player2.trim() || "Pasangan";
    sendMessage({
      type: "start-game",
      hostName: player1.trim(),
      guestName: finalPlayer2,
    });
    setAnswers({});
    setCurrentQIndex(0);
    setMyLocked(false);
    setPartnerLocked(false);
    setMyChoice(null);
    setRevealPopup(null);
    setStage("playing");
  }

  function handleSelect(choice: "player1" | "player2") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }

    const qId = currentQ.id;

    if (mode === "pass-phone") {
      const currentQAnswers = answers[qId] || {};
      if (currentTurn === "player1") {
        setAnswers({
          ...answers,
          [qId]: { ...currentQAnswers, player1: choice },
        });
        setStage("pass-phone");
      } else {
        const updatedAnswers = {
          ...answers,
          [qId]: { ...currentQAnswers, player2: choice },
        };
        setAnswers(updatedAnswers);

        if (currentQIndex < DEFAULT_QUESTIONS.length - 1) {
          setCurrentQIndex((prev) => prev + 1);
          setCurrentTurn("player1");
          setStage("playing");
        } else {
          setStage("result");
        }
      }
    } else {
      // Online mode: record local choice and lock
      if (myLocked) return;

      setMyLocked(true);
      setMyChoice(choice);

      // Save own answer into state
      setAnswers((prev) => ({
        ...prev,
        [qId]: {
          ...(prev[qId] || {}),
          [myRole === "host" ? "player1" : "player2"]: choice,
        },
      }));

      // Notify partner that answer is locked
      sendMessage({
        type: "lock-answer",
        questionIndex: currentQIndex,
        fromRole: myRole,
      });

      // Also send the choice to exchange
      sendMessage({
        type: "reveal-answer",
        questionIndex: currentQIndex,
        fromRole: myRole,
        choice,
      });
    }
  }

  function handlePassPhoneConfirm() {
    setCurrentTurn("player2");
    setStage("playing");
  }

  function handleReset() {
    if (mode === "online") {
      sendMessage({ type: "restart-game" });
      setAnswers({});
      setCurrentQIndex(0);
      setMyLocked(false);
      setPartnerLocked(false);
      setMyChoice(null);
      setRevealPopup(null);
      setShowBreakdown(false);
      setStage("playing");
    } else {
      setAnswers({});
      setCurrentQIndex(0);
      setCurrentTurn("player1");
      setShowBreakdown(false);
      setStage("start");
    }
  }

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/tebak-kita?room=${roomId}`;
  }, [roomId]);

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      showToast("Link room disalin! Kirim ke pasanganmu ✨");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast("Gagal menyalin link");
    }
  }

  async function handleShareWhatsApp() {
    const text = `Hai! Yuk main game "Tebak Kita" bareng aku buat cek seberapa kenal kita! Klik link ini ya:\n${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  const resultData = calculateCoupleResult(DEFAULT_QUESTIONS, answers);

  async function handleShare() {
    const text = `Hasil Tebak Kita: ${player1} & ${player2} cocok ${resultData.score}%! Tipe couple: "${resultData.coupleType.title}". Coba sekarang yuk!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hasil Tebak Kita",
          text,
          url: inviteUrl || window.location.href,
        });
      } catch {
        // Cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${text} ${inviteUrl || window.location.href}`);
      showToast("Link dan hasil berhasil disalin ke clipboard!");
    }
  }

  async function handleSaveImage() {
    try {
      showToast("Menyiapkan kartu hasil...");
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background Sky Blue
      const grad = ctx.createLinearGradient(0, 0, 0, 1600);
      grad.addColorStop(0, "#48A8FC");
      grad.addColorStop(1, "#2C8DF4");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1600);

      // Cute dots & stars
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.beginPath();
      ctx.arc(140, 240, 14, 0, Math.PI * 2);
      ctx.arc(920, 290, 18, 0, Math.PI * 2);
      ctx.arc(220, 720, 10, 0, Math.PI * 2);
      ctx.arc(880, 800, 12, 0, Math.PI * 2);
      ctx.fill();

      // Top pill: Hasil kalian
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(420, 110, 240, 64, 32);
      ctx.fill();
      ctx.fillStyle = "#0D226A";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hasil kalian", 540, 154);

      // Big Percentage
      ctx.fillStyle = "#0B1D5C";
      ctx.font = "900 190px sans-serif";
      ctx.fillText(`${resultData.score}%`, 540, 360);

      // Tagline
      ctx.fillStyle = "#0B1D5C";
      ctx.font = "bold 56px sans-serif";
      ctx.fillText("cocok banget!", 540, 440);

      // Player names subhead
      ctx.fillStyle = "rgba(11, 29, 92, 0.75)";
      ctx.font = "500 36px sans-serif";
      ctx.fillText(`${player1}  ❤️  ${player2}`, 540, 510);

      // White Card
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(80, 680, 920, 780, 48);
      ctx.fill();

      // Card Pill: Tipe couple kalian
      ctx.fillStyle = "#FFE785";
      ctx.beginPath();
      ctx.roundRect(390, 740, 300, 56, 28);
      ctx.fill();
      ctx.fillStyle = "#6F4500";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("Tipe couple kalian", 540, 778);

      // Title
      ctx.fillStyle = "#111827";
      ctx.font = "bold 68px sans-serif";
      ctx.fillText(resultData.coupleType.title, 540, 875);

      // Description
      ctx.fillStyle = "#4B5563";
      ctx.font = "400 34px sans-serif";
      wrapText(ctx, resultData.coupleType.description, 540, 950, 780, 50);

      // Highlight Pills
      // Chip Kompak (Green)
      ctx.fillStyle = "#DCFCE7";
      ctx.beginPath();
      ctx.roundRect(140, 1130, 380, 110, 28);
      ctx.fill();
      ctx.fillStyle = "#15803D";
      ctx.font = "500 24px sans-serif";
      ctx.fillText("Paling kompak", 330, 1172);
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(resultData.coupleType.palingKompak, 330, 1212);

      // Chip Beda (Pink)
      ctx.fillStyle = "#FFE4E6";
      ctx.beginPath();
      ctx.roundRect(560, 1130, 380, 110, 28);
      ctx.fill();
      ctx.fillStyle = "#BE123C";
      ctx.font = "500 24px sans-serif";
      ctx.fillText("Paling beda", 750, 1172);
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(resultData.coupleType.palingBeda, 750, 1212);

      // Footer branding
      ctx.fillStyle = "#6B7280";
      ctx.font = "500 28px sans-serif";
      ctx.fillText("tebak kita · photobooth", 540, 1370);

      // Trigger download
      const link = document.createElement("a");
      link.download = `tebak-kita-${player1}-${player2}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Kartu hasil tersimpan!");
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan gambar");
    }
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    let line = "";
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  return (
    <div className="min-h-screen bg-[#110D20] text-slate-800 flex items-center justify-center p-0 md:p-6 font-['Poppins',sans-serif] selection:bg-[#FFD138]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1C1827] text-white px-5 py-3 rounded-full text-xs md:text-sm font-semibold shadow-2xl border border-white/20 animate-fade-in flex items-center gap-2 max-w-[90%] text-center">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile-app Container Frame */}
      <div className="w-full max-w-[430px] min-h-screen md:min-h-[844px] md:max-h-[900px] md:rounded-[42px] overflow-hidden shadow-2xl relative flex flex-col justify-between transition-all duration-300">
        
        {/* ======================================================== */}
        {/* SCREEN 1: START SCREEN */}
        {/* ======================================================== */}
        {stage === "start" && (
          <div className="flex-1 bg-[#5334E6] text-white flex flex-col justify-between p-6 relative overflow-hidden select-none">
            {/* Background Cute Accents */}
            <div className="absolute top-10 left-6 text-white/30">
              <SparkleStar className="w-4 h-4 text-white/50 animate-pulse" />
            </div>
            <div className="absolute top-24 right-10 text-white/30">
              <SparkleStar className="w-5 h-5 text-white/60 animate-bounce" />
            </div>
            <div className="absolute bottom-40 left-4 text-white/20">
              <SparkleStar className="w-4 h-4 text-white/40" />
            </div>

            {/* Top Bar Header */}
            <div className="flex items-center justify-between z-10 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white font-['Poppins']">
                  tebak kita
                </span>
              </div>
              <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/90 border border-white/20 shadow-sm">
                10 soal · 5 menit
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="z-10 mt-3 bg-black/20 p-1 rounded-2xl flex items-center border border-white/10 backdrop-blur-sm">
              <button
                onClick={() => setMode("pass-phone")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === "pass-phone"
                    ? "bg-[#FFD138] text-[#1C1827] shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>1 HP (Oper HP)</span>
              </button>
              <button
                onClick={() => setMode("online")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === "online"
                    ? "bg-[#FFD138] text-[#1C1827] shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>2 HP (Online Relay)</span>
              </button>
            </div>

            {/* Shape Friends Character Group (Center Illustration) */}
            <div className="my-auto py-4 flex flex-col items-center justify-center relative z-10">
              <div className="relative w-64 h-52 flex items-center justify-center">
                {/* Green Circle (Top Left) */}
                <div className="absolute -top-2 left-6 transform -rotate-12 hover:scale-110 transition-transform">
                  <GreenCircle className="w-16 h-16" />
                </div>

                {/* Orange Square (Top Right) */}
                <div className="absolute top-0 right-8 transform rotate-6 hover:scale-110 transition-transform">
                  <OrangeSquare className="w-15 h-15" />
                </div>

                {/* Big Yellow Egg (Center Star) */}
                <div className="absolute top-8 left-14 z-20 hover:scale-105 transition-transform animate-float">
                  <YellowEgg className="w-28 h-32" />
                </div>

                {/* Purple Arch (Bottom Left) */}
                <div className="absolute bottom-1 -left-2 z-10 transform -rotate-6 hover:scale-110 transition-transform">
                  <PurpleArch className="w-18 h-20" />
                </div>

                {/* Pink Flower (Bottom Right) */}
                <div className="absolute bottom-0 right-4 z-20 transform rotate-12 hover:scale-110 transition-transform">
                  <PinkFlower className="w-24 h-24" />
                </div>
              </div>

              {/* Title & Headline */}
              <div className="text-center mt-2 px-2">
                <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
                  Seberapa <span className="text-[#FFD138]">kenal</span> kamu sama dia?
                </h1>
                <p className="text-xs md:text-sm text-white/80 font-normal mt-2 max-w-xs mx-auto leading-relaxed">
                  {mode === "online"
                    ? "Main bareng di HP masing-masing secara realtime lewat link invite!"
                    : "Jawab diam-diam, buka bareng. Lihat siapa yang paling hafal kebiasaan pasangannya."}
                </p>
              </div>
            </div>

            {/* Form Inputs & CTA Button */}
            <div className="space-y-3.5 z-10 pb-3">
              {mode === "pass-phone" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 tracking-wide uppercase px-1">
                        Namamu
                      </label>
                      <input
                        type="text"
                        value={player1}
                        onChange={(e) => setPlayer1(e.target.value)}
                        placeholder="Dinda"
                        maxLength={15}
                        className="w-full bg-white text-[#1C1827] font-bold text-base px-4 py-3 rounded-2xl outline-none shadow-md border-2 border-transparent focus:border-[#FFD138] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 tracking-wide uppercase px-1">
                        Nama Pasangan
                      </label>
                      <input
                        type="text"
                        value={player2}
                        onChange={(e) => setPlayer2(e.target.value)}
                        placeholder="Raka"
                        maxLength={15}
                        className="w-full bg-white text-[#1C1827] font-bold text-base px-4 py-3 rounded-2xl outline-none shadow-md border-2 border-transparent focus:border-[#FFD138] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleStartPassPhone}
                    className="w-full bg-[#FFD138] hover:bg-[#FFE066] active:scale-[0.98] text-[#1C1827] font-extrabold text-base md:text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all group"
                  >
                    <span>Mulai main di 1 HP</span>
                    <span className="w-9 h-9 rounded-full bg-[#1C1827] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/80 tracking-wide uppercase px-1">
                      Namamu
                    </label>
                    <input
                      type="text"
                      value={player1}
                      onChange={(e) => setPlayer1(e.target.value)}
                      placeholder="Dinda"
                      maxLength={15}
                      className="w-full bg-white text-[#1C1827] font-bold text-base px-4 py-3 rounded-2xl outline-none shadow-md border-2 border-transparent focus:border-[#FFD138] transition-all"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!player1.trim()) {
                        showToast("Tulis namamu dulu ya!");
                        return;
                      }
                      setStage("lobby-waiting");
                    }}
                    className="w-full bg-[#FFD138] hover:bg-[#FFE066] active:scale-[0.98] text-[#1C1827] font-extrabold text-base md:text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all group"
                  >
                    <span>Buat Room & Ajak Pasangan</span>
                    <span className="w-9 h-9 rounded-full bg-[#1C1827] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </span>
                  </button>
                </>
              )}

              <div className="text-center pt-1">
                <Link
                  href="/"
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  ← Kembali ke Photobooth
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1B: ONLINE LOBBY / WAITING SCREEN */}
        {/* ======================================================== */}
        {stage === "lobby-waiting" && (
          <div className="flex-1 bg-[#5334E6] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in">
            {/* Top Bar Header */}
            <div className="flex items-center justify-between z-10 pt-2">
              <button
                onClick={() => setStage("start")}
                className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/90 border border-white/20">
                <span
                  className={`w-2 h-2 rounded-full ${
                    partnerConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span>{partnerConnected ? "Terhubung" : "Menunggu Pasangan"}</span>
              </div>
            </div>

            {/* Waiting Characters Illustration */}
            <div className="my-auto py-4 flex flex-col items-center justify-center text-center">
              <div className="relative mb-5 flex items-center justify-center gap-3">
                <YellowEgg className="w-20 h-22 animate-bounce" />
                <SparkleStar className="w-6 h-6 text-[#FFD138] animate-pulse" />
                <PinkFlower className="w-20 h-20 animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>

              <h2 className="text-2xl font-black text-white mb-1">
                {partnerConnected ? "Pasangan Sudah Siap! 🎉" : "Ajak Pasangan Masuk"}
              </h2>
              <p className="text-xs md:text-sm text-white/80 max-w-xs leading-relaxed">
                {partnerConnected
                  ? `${player1} & ${player2} sudah berada di dalam room yang sama.`
                  : "Kirim link di bawah ke WhatsApp atau DM pasanganmu untuk mulai main bareng."}
              </p>

              {/* Guest name edit if joined via link */}
              {!isHost && (
                <div className="mt-4 w-full max-w-xs text-left">
                  <label className="text-xs font-bold text-white/80 block mb-1">
                    Nama Kamu:
                  </label>
                  <input
                    type="text"
                    value={player2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayer2(val);
                      if (val.trim()) {
                        sendMessage({
                          type: "player-info",
                          name: val.trim(),
                          role: "guest",
                        });
                      }
                    }}
                    placeholder="Nama kamu"
                    maxLength={15}
                    className="w-full bg-white text-[#1C1827] font-bold text-sm px-4 py-2.5 rounded-xl outline-none shadow-md"
                  />
                </div>
              )}

              {/* Share Box for Host */}
              {isHost && (
                <div className="mt-5 w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Link Invite Room:</span>
                    <span className="font-mono text-[10px] bg-black/20 px-2 py-0.5 rounded">
                      Kode: {roomId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-xs text-white/90 font-mono truncate outline-none select-all"
                    />
                    <button
                      onClick={handleCopyInvite}
                      className="bg-[#FFD138] hover:bg-[#FFE066] text-[#1C1827] p-2.5 rounded-xl font-bold flex items-center justify-center transition-transform active:scale-95"
                      title="Salin Link"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    onClick={handleShareWhatsApp}
                    className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Kirim Link via WhatsApp</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-3 pb-3">
              {isHost ? (
                <button
                  onClick={handleStartOnlineHost}
                  disabled={!partnerConnected}
                  className={`w-full font-extrabold text-base md:text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all ${
                    partnerConnected
                      ? "bg-[#FFD138] hover:bg-[#FFE066] text-[#1C1827] active:scale-[0.98] group"
                      : "bg-white/20 text-white/40 cursor-not-allowed"
                  }`}
                >
                  <span>{partnerConnected ? "Mulai Main Sekarang!" : "Menunggu Pasangan Masuk..."}</span>
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      partnerConnected ? "bg-[#1C1827] text-white group-hover:translate-x-1" : "bg-white/10 text-white/40"
                    } transition-transform`}
                  >
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </span>
                </button>
              ) : (
                <div className="bg-white/15 border border-white/20 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-white mb-1">
                    <Sparkles className="w-4 h-4 text-[#FFD138]" />
                    <span>Kamu sudah bergabung!</span>
                  </div>
                  <p className="text-xs text-white/80">
                    Tunggu <strong>{player1}</strong> menekan tombol mulai di HP-nya ya...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: QUESTION SCREEN (ANSWERING) */}
        {/* ======================================================== */}
        {stage === "playing" && (
          <div className="flex-1 bg-[#F5F6FC] flex flex-col justify-between p-5 relative select-none">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => {
                  if (mode === "online") {
                    if (confirm("Keluar dari room game?")) {
                      setStage("start");
                    }
                  } else {
                    if (currentQIndex > 0) {
                      setCurrentQIndex((prev) => prev - 1);
                      setCurrentTurn("player1");
                    } else {
                      setStage("start");
                    }
                  }
                }}
                className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>

              {/* Progress Dots */}
              <div className="flex items-center gap-1.5 flex-1 justify-center max-w-[210px]">
                {DEFAULT_QUESTIONS.map((_, idx) => {
                  const isCurrent = idx === currentQIndex;
                  const isPassed = idx < currentQIndex;
                  return (
                    <div
                      key={idx}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        isCurrent
                          ? "w-6 bg-[#FFD138]"
                          : isPassed
                          ? "w-2.5 bg-[#5334E6]"
                          : "w-2.5 bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Counter & Online Badge */}
              <div className="flex items-center gap-1.5 text-base font-black text-slate-800 pr-1">
                {mode === "online" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online Relay" />
                )}
                <span>
                  {currentQIndex + 1}/{DEFAULT_QUESTIONS.length}
                </span>
              </div>
            </div>

            {/* Main Question Card with Peeking Shape Friends */}
            <div className="my-auto py-2">
              {/* Peeking Characters Top Layer */}
              <div className="relative h-14 -mb-2 flex justify-between px-10 pointer-events-none z-10">
                <div className="animate-bounce" style={{ animationDuration: "3s" }}>
                  <YellowEgg className="w-16 h-16" />
                </div>
                <div
                  className="animate-bounce"
                  style={{ animationDuration: "2.5s", animationDelay: "0.4s" }}
                >
                  <PinkFlower className="w-16 h-16" />
                </div>
              </div>

              {/* Deep Purple Card */}
              <div className="bg-[#5334E6] text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden text-center min-h-[220px] flex flex-col justify-center items-center">
                {/* Pill Tag */}
                <div className="inline-block bg-[#FFD138] text-[#1C1827] text-xs font-black px-4 py-1.5 rounded-full mb-3.5 tracking-tight shadow-sm">
                  {currentQ.tag}
                </div>

                {/* Big Question Text */}
                <h2 className="text-2xl md:text-3xl font-black text-white leading-snug tracking-tight max-w-[280px]">
                  {currentQ.text}
                </h2>
              </div>

              {/* Turn / Status Indicator Banner */}
              <div className="mt-4 flex items-center justify-center gap-2 text-slate-700 text-xs md:text-sm font-semibold bg-white/80 backdrop-blur-sm py-2 px-4 rounded-full border border-slate-200 shadow-sm mx-auto w-fit">
                {mode === "pass-phone" ? (
                  <>
                    <span>{currentTurn === "player1" ? "😊" : "🤫"}</span>
                    <span>
                      Giliran <strong className="text-[#5334E6]">{currentTurn === "player1" ? player1 : player2}</strong>.{" "}
                      {currentTurn === "player1" ? player2 : player1}, jangan ngintip!
                    </span>
                  </>
                ) : (
                  <>
                    <span>{partnerLocked ? "⚡" : "👀"}</span>
                    <span>
                      {partnerLocked
                        ? `${partnerName} sudah mengunci jawaban!`
                        : `Menunggu jawaban dari ${partnerName}...`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Answer Choice Cards: Aku vs Kamu */}
            <div className="space-y-3 pb-2 relative">
              {/* Online Reveal Animation Pop */}
              {revealPopup && (
                <div className="absolute inset-0 bg-[#5334E6]/95 backdrop-blur-md rounded-[30px] z-30 flex flex-col items-center justify-center text-white p-6 animate-scale-up text-center border-2 border-[#FFD138]">
                  <span className="text-4xl mb-2">{revealPopup.matched ? "🎉" : "👀"}</span>
                  <div className="text-2xl font-black text-[#FFD138] mb-1">
                    {revealPopup.matched ? "Kompak Banget!" : "Beda Pilihan!"}
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed mb-3">
                    {player1} pilih <strong>{revealPopup.p1ChoiceName}</strong>
                    <br />
                    {player2} pilih <strong>{revealPopup.p2ChoiceName}</strong>
                  </p>
                  <div className="text-[11px] text-white/60 font-medium">
                    Lanjut ke soal berikutnya... ✨
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                {/* Left Choice Card: Aku */}
                <button
                  disabled={mode === "online" && myLocked}
                  onClick={() =>
                    handleSelect(
                      mode === "pass-phone"
                        ? currentTurn
                        : myRole === "host"
                        ? "player1"
                        : "player2"
                    )
                  }
                  className={`rounded-[30px] p-5 flex flex-col items-center justify-center text-center shadow-md transition-all group border-2 ${
                    mode === "online" && myChoice === (myRole === "host" ? "player1" : "player2")
                      ? "bg-[#FFAEC7] border-slate-900 scale-[1.02] ring-4 ring-[#FFD138]"
                      : "bg-[#FFAEC7] hover:bg-[#FF9BB9] active:scale-[0.97] border-transparent hover:border-white"
                  }`}
                >
                  <div className="transform group-hover:scale-110 transition-transform mb-2">
                    <YellowEgg className="w-20 h-20" />
                  </div>
                  <span className="text-2xl font-black text-[#1C1827] leading-none mb-1">
                    Aku
                  </span>
                  <span className="text-xs font-bold text-[#1C1827]/70">
                    {mode === "pass-phone"
                      ? currentTurn === "player1"
                        ? player1
                        : player2
                      : myName}
                  </span>
                </button>

                {/* Right Choice Card: Kamu */}
                <button
                  disabled={mode === "online" && myLocked}
                  onClick={() =>
                    handleSelect(
                      mode === "pass-phone"
                        ? currentTurn === "player1"
                          ? "player2"
                          : "player1"
                        : myRole === "host"
                        ? "player2"
                        : "player1"
                    )
                  }
                  className={`rounded-[30px] p-5 flex flex-col items-center justify-center text-center shadow-md transition-all group border-2 ${
                    mode === "online" && myChoice === (myRole === "host" ? "player2" : "player1")
                      ? "bg-[#C5B7FD] border-slate-900 scale-[1.02] ring-4 ring-[#FFD138]"
                      : "bg-[#C5B7FD] hover:bg-[#B7A5FD] active:scale-[0.97] border-transparent hover:border-white"
                  }`}
                >
                  <div className="transform group-hover:scale-110 transition-transform mb-2">
                    <GreenCircle className="w-20 h-20" />
                  </div>
                  <span className="text-2xl font-black text-[#1C1827] leading-none mb-1">
                    Kamu
                  </span>
                  <span className="text-xs font-bold text-[#1C1827]/70">
                    {mode === "pass-phone"
                      ? currentTurn === "player1"
                        ? player2
                        : player1
                      : partnerName}
                  </span>
                </button>
              </div>

              {/* Bottom Notice */}
              <div className="text-center text-[11px] text-slate-500 font-medium pt-1 flex items-center justify-center gap-1.5">
                <span>🔒</span>
                <span>
                  {mode === "online" && myLocked
                    ? "Jawabanmu sudah terkunci! Menunggu pasangan... ⏳"
                    : "Jawaban dirahasiakan sampai kalian berdua selesai memilih"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* INTERSTITIAL: PASS PHONE MODAL / STAGE (1 HP MODE) */}
        {/* ======================================================== */}
        {stage === "pass-phone" && (
          <div className="flex-1 bg-[#5334E6] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in text-center">
            {/* Top Bar */}
            <div className="flex items-center justify-center pt-2">
              <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide">
                Soal {currentQIndex + 1} dari {DEFAULT_QUESTIONS.length}
              </span>
            </div>

            {/* Pass Phone Illustration */}
            <div className="my-auto flex flex-col items-center justify-center">
              <div className="relative mb-6">
                <PurpleArch className="w-24 h-24 animate-bounce" />
                <div className="absolute -top-3 -right-2">
                  <SparkleStar className="w-6 h-6 text-[#FFD138]" />
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 max-w-xs shadow-xl">
                <span className="text-3xl mb-2 block">🔒</span>
                <h3 className="text-xl font-black text-white mb-2">
                  Jawaban {player1} Dikunci!
                </h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  Sekarang giliran <strong>{player2}</strong> yang menjawab. Oper HP ini ke {player2} ya!
                </p>
              </div>
            </div>

            {/* Confirm Pass CTA */}
            <div className="space-y-3 pb-3">
              <button
                onClick={handlePassPhoneConfirm}
                className="w-full bg-[#FFD138] hover:bg-[#FFE066] active:scale-[0.98] text-[#1C1827] font-extrabold text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all group"
              >
                <span>Siap! Giliran {player2}</span>
                <span className="w-9 h-9 rounded-full bg-[#1C1827] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 3: RESULT SCREEN */}
        {/* ======================================================== */}
        {stage === "result" && (
          <div
            ref={resultCardRef}
            className="flex-1 bg-[#4BA3F5] text-slate-800 flex flex-col justify-between p-5 relative select-none overflow-y-auto"
          >
            {/* Background Cute Accents */}
            <div className="absolute top-10 left-6 text-white/40">
              <SparkleStar className="w-4 h-4 text-white" />
            </div>
            <div className="absolute top-28 right-8 text-white/40">
              <SparkleStar className="w-5 h-5 text-white" />
            </div>
            <div className="absolute top-72 left-4 text-white/30">
              <SparkleStar className="w-4 h-4 text-white" />
            </div>

            {/* Top Pill: Hasil kalian */}
            <div className="flex items-center justify-center pt-2 z-10">
              <div className="bg-white text-[#0B1D5C] px-5 py-2 rounded-full text-sm font-extrabold shadow-sm">
                Hasil kalian
              </div>
            </div>

            {/* Score & Tagline */}
            <div className="text-center my-3 z-10">
              <div className="text-7xl md:text-8xl font-black text-[#0B1D5C] tracking-tighter leading-none mb-1">
                {resultData.score}%
              </div>
              <div className="text-xl md:text-2xl font-black text-[#0B1D5C]">
                cocok banget!
              </div>
              <div className="text-xs font-semibold text-[#0B1D5C]/80 mt-1">
                {player1} ❤️ {player2}
              </div>
            </div>

            {/* Shape Friends Celebrating Group */}
            <div className="relative h-24 my-1 flex items-end justify-center z-10">
              <div className="flex items-end justify-center gap-1">
                <div className="transform -rotate-12 translate-y-2">
                  <PurpleArch className="w-13 h-14" />
                </div>
                <div className="transform -rotate-6">
                  <OrangeSquare className="w-13 h-14" />
                </div>
                <div className="z-20 transform -translate-y-2 scale-110">
                  <YellowEgg className="w-20 h-22" />
                </div>
                <div className="transform rotate-6">
                  <PinkFlower className="w-15 h-16" />
                </div>
                <div className="transform rotate-12 translate-y-1">
                  <GreenCircle className="w-13 h-14" />
                </div>
              </div>
            </div>

            {/* White Result Card Container */}
            <div className="bg-white rounded-[32px] p-5 shadow-xl text-center z-10 space-y-3.5 my-2">
              {/* Pill Tag */}
              <div className="inline-block bg-[#FFE483] text-[#714600] text-xs font-black px-4 py-1.5 rounded-full tracking-tight">
                {resultData.coupleType.badge}
              </div>

              {/* Couple Type Name */}
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {resultData.coupleType.title}
              </h3>

              {/* Description */}
              <p className="text-xs md:text-sm text-slate-600 font-normal leading-relaxed px-2">
                {resultData.coupleType.description}
              </p>

              {/* Highlights Summary Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-[#E6F8EE] border border-[#2AC06D]/20 p-2.5 rounded-2xl text-left">
                  <span className="text-[10px] font-bold text-[#1F8E4F] uppercase tracking-wider block">
                    Paling kompak
                  </span>
                  <span className="text-xs font-extrabold text-[#111827] block truncate mt-0.5">
                    {resultData.coupleType.palingKompak}
                  </span>
                </div>

                <div className="bg-[#FFEBF1] border border-[#FF7AA2]/20 p-2.5 rounded-2xl text-left">
                  <span className="text-[10px] font-bold text-[#D0285C] uppercase tracking-wider block">
                    Paling beda
                  </span>
                  <span className="text-xs font-extrabold text-[#111827] block truncate mt-0.5">
                    {resultData.coupleType.palingBeda}
                  </span>
                </div>
              </div>

              {/* Toggle Answers Breakdown */}
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full text-xs font-bold text-[#5334E6] hover:text-[#3B1FB8] flex items-center justify-center gap-1 pt-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showBreakdown ? "Sembunyikan detail jawaban" : "Lihat 10 jawaban kalian"}</span>
              </button>

              {/* Expanded Breakdown */}
              {showBreakdown && (
                <div className="max-h-48 overflow-y-auto text-left space-y-2 pt-2 border-t border-slate-100 pr-1 text-xs">
                  {DEFAULT_QUESTIONS.map((q, idx) => {
                    const ans = answers[q.id];
                    const isMatch = ans && ans.player1 && ans.player2 && ans.player1 === ans.player2;
                    return (
                      <div
                        key={q.id}
                        className={`p-2.5 rounded-xl border ${
                          isMatch ? "bg-emerald-50/70 border-emerald-200" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 flex-1">
                            {idx + 1}. {q.text}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isMatch ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-900"
                            }`}
                          >
                            {isMatch ? "Kompak!" : "Beda"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex gap-3">
                          <span>
                            {player1}: <strong className="text-slate-700">{ans?.player1 === "player1" ? player1 : player2}</strong>
                          </span>
                          <span>
                            {player2}: <strong className="text-slate-700">{ans?.player2 === "player2" ? player2 : player1}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions: Main lagi, Simpan, Bagikan */}
            <div className="grid grid-cols-3 gap-2.5 z-10 pt-2 pb-1">
              <button
                onClick={handleReset}
                className="bg-[#FFE483] hover:bg-[#FFDC66] active:scale-95 text-[#1C1827] font-extrabold py-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 transition-all"
              >
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs">Main lagi</span>
              </button>

              <button
                onClick={handleSaveImage}
                className="bg-[#FFAEC7] hover:bg-[#FF9BB9] active:scale-95 text-[#1C1827] font-extrabold py-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs">Simpan</span>
              </button>

              <button
                onClick={handleShare}
                className="bg-[#C5B7FD] hover:bg-[#B7A5FD] active:scale-95 text-[#1C1827] font-extrabold py-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Share2 className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs">Bagikan</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
