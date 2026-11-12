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
} from "@/components/tebak-kita/ShapeCharacters";
import {
  DEFAULT_PLANS,
  calculatePlanResult,
  DatePlanItem,
  DateOption,
} from "./plansData";
import {
  ChevronLeft,
  ArrowRight,
  RotateCcw,
  Download,
  Share2,
  Copy,
  Check,
  Smartphone,
  Wifi,
  Sparkles,
  Ticket,
  CalendarHeart,
  MessageCircle,
  HeartHandshake,
  CheckCircle2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useRencanaKitaRelay, PlanSyncMessage } from "./useRencanaKitaRelay";

type GameMode = "pass-phone" | "online";
type GameStage = "start" | "lobby-waiting" | "playing" | "pass-phone" | "result";

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL ?? "ws://localhost:8787";

function generateShortId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function RencanaKitaGame() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  // Mode: 1 HP (pass-phone) or 2 HP (online)
  const [mode, setMode] = useState<GameMode>(roomParam ? "online" : "pass-phone");
  const isHost = !roomParam;

  // Session Identifiers for Online Mode
  const [roomId, setRoomId] = useState<string>(() => roomParam || `plan-${generateShortId()}`);
  const [peerId] = useState<string>(() => (isHost ? `host-${generateShortId()}` : `guest-${generateShortId()}`));

  // Player Names
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");

  const myRole = isHost ? "host" : "guest";
  const myName = myRole === "host" ? player1 : player2;
  const partnerName = myRole === "host" ? (player2.trim() || "Pasangan") : (player1.trim() || "Pasangan");
  const p1Display = player1.trim() || (isHost ? "Aku" : "Pasangan");
  const p2Display = player2.trim() || (!isHost ? "Aku" : "Pasangan");

  // Game Progress
  const [stage, setStage] = useState<GameStage>(roomParam ? "lobby-waiting" : "start");
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"player1" | "player2">("player1");

  // Answers store: planId -> { player1?: 'A'|'B', player2?: 'A'|'B' }
  const [answers, setAnswers] = useState<
    Record<number, { player1?: "A" | "B"; player2?: "A" | "B" }>
  >({});

  // Online Synchronization States
  const [myChoice, setMyChoice] = useState<"A" | "B" | null>(null);
  const [myLocked, setMyLocked] = useState(false);
  const [partnerLocked, setPartnerLocked] = useState(false);
  const [revealPopup, setRevealPopup] = useState<{
    matched: boolean;
    choiceA: DateOption;
    choiceB: DateOption;
    p1Chosen: "A" | "B";
    p2Chosen: "A" | "B";
  } | null>(null);

  // UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPlan: DatePlanItem = DEFAULT_PLANS[currentPlanIndex];

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  const advanceToNextPlan = useCallback((nextIdx: number) => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setRevealPopup(null);
    setMyLocked(false);
    setPartnerLocked(false);
    setMyChoice(null);

    if (nextIdx < DEFAULT_PLANS.length) {
      setCurrentPlanIndex(nextIdx);
    } else {
      setStage("result");
    }
  }, []);

  const handleNextPlan = useCallback(() => {
    const nextIdx = currentPlanIndex + 1;
    sendMessage({
      type: "next-question",
      questionIndex: nextIdx,
    });
    advanceToNextPlan(nextIdx);
  }, [currentPlanIndex, advanceToNextPlan]);

  // --- Realtime Relay Hook Setup ---
  const handleRelayMessage = useCallback(
    (msg: PlanSyncMessage) => {
      console.log("[RencanaKita Game] Relay message received:", msg);
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
          setPlayer1(msg.hostName);
          setPlayer2(msg.guestName);
          setAnswers({});
          setCurrentPlanIndex(0);
          setMyLocked(false);
          setPartnerLocked(false);
          setMyChoice(null);
          setRevealPopup(null);
          setStage("playing");
          showToast("Rencana kencan dimulai! 🚀");
          break;
        }

        case "lock-answer": {
          setPartnerLocked(true);
          showToast(`${partnerName} sudah memilih rencananya! ⚡`);
          break;
        }

        case "reveal-answer": {
          const targetPlan = DEFAULT_PLANS[msg.questionIndex];
          if (targetPlan) {
            const partnerRole = msg.fromRole;
            const partnerAnswer = msg.choice;

            setAnswers((prev) => {
              const qId = targetPlan.id;
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

        case "next-question": {
          advanceToNextPlan(msg.questionIndex);
          break;
        }

        case "restart-game": {
          setAnswers({});
          setCurrentPlanIndex(0);
          setMyLocked(false);
          setPartnerLocked(false);
          setMyChoice(null);
          setRevealPopup(null);
          setShowAllPlans(false);
          setStage("playing");
          showToast("Kuis rencana kencan diulang! 🔄");
          break;
        }
      }
    },
    [partnerName, advanceToNextPlan]
  );

  const { status: relayStatus, partnerConnected, sendMessage } = useRencanaKitaRelay({
    signalUrl: SIGNAL_URL,
    roomId: mode === "online" ? roomId : "",
    peerId: mode === "online" ? peerId : "",
    isHost,
    onMessage: handleRelayMessage,
    onPartnerJoined: () => {
      sendMessage({
        type: "player-info",
        name: myName.trim(),
        role: myRole,
      });
      showToast("Pasangan terhubung! Siap bikin rencana kencan ✨");
    },
    onPartnerLeft: () => {
      showToast("Pasangan terputus dari room ⚠️");
    },
  });

  // Re-broadcast player name when partner connects or changes
  useEffect(() => {
    if (mode === "online" && partnerConnected && myName.trim()) {
      sendMessage({
        type: "player-info",
        name: myName.trim(),
        role: myRole,
      });
    }
  }, [mode, partnerConnected, myName, myRole, sendMessage]);

  // Check if both players have answered in online mode to trigger reveal
  useEffect(() => {
    if (mode !== "online" || stage !== "playing" || !currentPlan) return;

    const qAns = answers[currentPlan.id];
    if (qAns && qAns.player1 && qAns.player2 && !revealPopup) {
      const isMatch = qAns.player1 === qAns.player2;

      setRevealPopup({
        matched: isMatch,
        choiceA: currentPlan.optionA,
        choiceB: currentPlan.optionB,
        p1Chosen: qAns.player1,
        p2Chosen: qAns.player2,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(isMatch ? [50, 70, 50] : 30);
      }

      // 3-second auto-advance timer, skippable with button
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        handleNextPlan();
      }, 3200);
    }
  }, [answers, currentPlan, mode, revealPopup, stage, handleNextPlan]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // --- Handlers ---

  function handleStartPassPhone() {
    if (!player1.trim() || !player2.trim()) {
      showToast("Tulis nama kalian berdua dulu ya!");
      return;
    }
    setAnswers({});
    setCurrentPlanIndex(0);
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
    setCurrentPlanIndex(0);
    setMyLocked(false);
    setPartnerLocked(false);
    setMyChoice(null);
    setRevealPopup(null);
    setStage("playing");
  }

  function handleSelect(choice: "A" | "B") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }

    const planId = currentPlan.id;

    if (mode === "pass-phone") {
      const currentQAnswers = answers[planId] || {};
      if (currentTurn === "player1") {
        setAnswers({
          ...answers,
          [planId]: { ...currentQAnswers, player1: choice },
        });
        setStage("pass-phone");
      } else {
        const updatedAnswers = {
          ...answers,
          [planId]: { ...currentQAnswers, player2: choice },
        };
        setAnswers(updatedAnswers);

        if (currentPlanIndex < DEFAULT_PLANS.length - 1) {
          setCurrentPlanIndex((prev) => prev + 1);
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

      setAnswers((prev) => ({
        ...prev,
        [planId]: {
          ...(prev[planId] || {}),
          [myRole === "host" ? "player1" : "player2"]: choice,
        },
      }));

      sendMessage({
        type: "lock-answer",
        questionIndex: currentPlanIndex,
        fromRole: myRole,
      });

      sendMessage({
        type: "reveal-answer",
        questionIndex: currentPlanIndex,
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
      setCurrentPlanIndex(0);
      setMyLocked(false);
      setPartnerLocked(false);
      setMyChoice(null);
      setRevealPopup(null);
      setShowAllPlans(false);
      setStage("playing");
    } else {
      setAnswers({});
      setCurrentPlanIndex(0);
      setCurrentTurn("player1");
      setShowAllPlans(false);
      setStage("start");
    }
  }

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/rencana-kita?room=${roomId}`;
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
    const text = `Hai sayang! Yuk cocokin rencana kencan pas kita ketemu nanti lewat "Rencana Kita":\n${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  const resultData = calculatePlanResult(DEFAULT_PLANS, answers);

  async function handleShareResult() {
    const text = `Rencana Kencan ${p1Display} & ${p2Display}: Cocok ${resultData.score}%! Kami punya ${resultData.matchedCount} rencana seru pas ketemu nanti! Cek & buat kencan impianmu di:`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tiket Kencan Reunion Kita",
          text,
          url: inviteUrl || window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text} ${inviteUrl || window.location.href}`);
      showToast("Hasil dan link berhasil disalin!");
    }
  }

  // Generate beautiful High-Res Date Boarding Pass / Ticket Image
  async function handleSaveTicketImage() {
    try {
      showToast("Menyiapkan Tiket Kencan...");
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1680;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Romantic gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, 1680);
      grad.addColorStop(0, "#FF7BA3");
      grad.addColorStop(0.5, "#8B5CF6");
      grad.addColorStop(1, "#3B82F6");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1680);

      // Star accents
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(120, 200, 16, 0, Math.PI * 2);
      ctx.arc(960, 260, 20, 0, Math.PI * 2);
      ctx.arc(180, 1480, 14, 0, Math.PI * 2);
      ctx.arc(900, 1520, 18, 0, Math.PI * 2);
      ctx.fill();

      // Top Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(360, 90, 360, 60, 30);
      ctx.fill();
      ctx.fillStyle = "#1E1B4B";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TIKET KENCAN REUNION", 540, 132);

      // Big Header Text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 68px sans-serif";
      ctx.fillText("Rencana Kencan Kita", 540, 230);

      ctx.font = "600 36px sans-serif";
      ctx.fillText(`${p1Display}  ❤️  ${p2Display}`, 540, 290);

      // Main Ticket Boarding Pass Card
      const cardX = 90;
      const cardY = 360;
      const cardW = 900;
      const cardH = 1180;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 48);
      ctx.fill();

      // Ticket Top Pill
      ctx.fillStyle = "#FEF08A";
      ctx.beginPath();
      ctx.roundRect(340, cardY + 40, 400, 64, 32);
      ctx.fill();
      ctx.fillStyle = "#713F12";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(resultData.type.badge, 540, cardY + 83);

      // Match Score
      ctx.fillStyle = "#111827";
      ctx.font = "900 90px sans-serif";
      ctx.fillText(`${resultData.score}% Sehati!`, 540, cardY + 210);

      ctx.fillStyle = "#4B5563";
      ctx.font = "500 32px sans-serif";
      ctx.fillText(resultData.type.title, 540, cardY + 265);

      // Dashed separator line
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(cardX + 40, cardY + 320);
      ctx.lineTo(cardX + cardW - 40, cardY + 320);
      ctx.stroke();
      ctx.setLineDash([]);

      // Section Title: Bucket List Matched
      ctx.fillStyle = "#16A34A";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`🎟️ DAFTAR KENCAN DISEPAKATI (${resultData.matchedPlans.length} Rencana):`, cardX + 60, cardY + 380);

      // Render up to 6 matched items
      let itemY = cardY + 450;
      const maxShow = Math.min(6, resultData.matchedPlans.length);
      for (let i = 0; i < maxShow; i++) {
        const item = resultData.matchedPlans[i];
        ctx.fillStyle = "#F3F4F6";
        ctx.beginPath();
        ctx.roundRect(cardX + 60, itemY - 35, cardW - 120, 70, 20);
        ctx.fill();

        ctx.fillStyle = "#15803D";
        ctx.font = "bold 34px sans-serif";
        ctx.fillText("✓", cardX + 85, itemY + 12);

        ctx.fillStyle = "#111827";
        ctx.font = "bold 30px sans-serif";
        ctx.fillText(`${item.chosen.emoji} ${item.chosen.title}`, cardX + 135, itemY + 10);

        itemY += 88;
      }

      if (resultData.matchedPlans.length === 0) {
        ctx.fillStyle = "#6B7280";
        ctx.font = "italic 28px sans-serif";
        ctx.fillText("Kalian punya selera berbeda yang seru untuk dicoba bergantian!", cardX + 60, cardY + 460);
      }

      // Footer branding
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("rencana kita · photobooth ldr date edition", 540, cardY + cardH - 50);

      // Trigger download
      const link = document.createElement("a");
      link.download = `tiket-kencan-${p1Display}-${p2Display}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Tiket kencan berhasil disimpan!");
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan tiket kencan");
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0C20] text-slate-800 flex items-center justify-center p-0 md:p-6 font-['Poppins',sans-serif] selection:bg-[#FFD138]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1C1827] text-white px-5 py-3 rounded-full text-xs md:text-sm font-semibold shadow-2xl border border-white/20 animate-fade-in flex items-center gap-2 max-w-[90%] text-center">
          <span>🎟️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile-app Container Frame */}
      <div className="w-full max-w-[430px] min-h-screen md:min-h-[844px] md:max-h-[920px] md:rounded-[42px] overflow-hidden shadow-2xl relative flex flex-col justify-between transition-all duration-300">
        
        {/* ======================================================== */}
        {/* SCREEN 1: START SCREEN */}
        {/* ======================================================== */}
        {stage === "start" && (
          <div className="flex-1 bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] text-white flex flex-col justify-between p-6 relative overflow-hidden select-none">
            {/* Background Cute Accents */}
            <div className="absolute top-10 left-6 text-white/30">
              <SparkleStar className="w-4 h-4 text-white/50 animate-pulse" />
            </div>
            <div className="absolute top-24 right-10 text-white/30">
              <SparkleStar className="w-5 h-5 text-white/60 animate-bounce" />
            </div>

            {/* Top Bar Header */}
            <div className="flex items-center justify-between z-10 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white">
                  rencana kita
                </span>
              </div>
              <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/90 border border-white/20 shadow-sm flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-[#FFD138]" />
                <span>10 Ide Kencan</span>
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
                <span>2 HP (Online Bareng)</span>
              </button>
            </div>

            {/* Character Group Illustration */}
            <div className="my-auto py-3 flex flex-col items-center justify-center relative z-10">
              <div className="relative w-64 h-48 flex items-center justify-center">
                <div className="absolute -top-2 left-6 transform -rotate-12 hover:scale-110 transition-transform">
                  <GreenCircle className="w-16 h-16" />
                </div>
                <div className="absolute top-0 right-8 transform rotate-6 hover:scale-110 transition-transform">
                  <OrangeSquare className="w-15 h-15" />
                </div>
                <div className="absolute top-6 left-14 z-20 hover:scale-105 transition-transform animate-float">
                  <YellowEgg className="w-28 h-32" />
                </div>
                <div className="absolute bottom-0 right-4 z-20 transform rotate-12 hover:scale-110 transition-transform">
                  <PinkFlower className="w-24 h-24" />
                </div>
              </div>

              {/* Title & Headline */}
              <div className="text-center mt-2 px-2">
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">
                  Rencana Kencan <span className="text-[#FFD138]">Pas Ketemu</span>
                </h1>
                <p className="text-xs md:text-sm text-white/80 font-normal mt-2 max-w-xs mx-auto leading-relaxed">
                  Pilih kencan impian kalian secara diam-diam. Cocokkan seleranya dan dapatkan <strong className="text-[#FFD138]">Tiket Kencan Pertama</strong> berdua!
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
                        placeholder="Contoh: Rama"
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
                        placeholder="Contoh: Putri"
                        maxLength={15}
                        className="w-full bg-white text-[#1C1827] font-bold text-base px-4 py-3 rounded-2xl outline-none shadow-md border-2 border-transparent focus:border-[#FFD138] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleStartPassPhone}
                    className="w-full bg-[#FFD138] hover:bg-[#FFE066] active:scale-[0.98] text-[#1C1827] font-extrabold text-base md:text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all group"
                  >
                    <span>Mulai Pilih Rencana</span>
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
                      placeholder="Contoh: Rama"
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

              <div className="text-center pt-1 flex items-center justify-center gap-4 text-xs text-white/60">
                <Link href="/tebak-kita" className="hover:text-white transition-colors">
                  ← Coba Game Tebak Kita
                </Link>
                <span>·</span>
                <Link href="/" className="hover:text-white transition-colors">
                  Photobooth
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1B: ONLINE LOBBY / WAITING SCREEN */}
        {/* ======================================================== */}
        {stage === "lobby-waiting" && (
          <div className="flex-1 bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in">
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
                {partnerConnected ? "Pasangan Sudah Masuk! 🎉" : "Kirim Undangan ke Dia"}
              </h2>
              <p className="text-xs md:text-sm text-white/80 max-w-xs leading-relaxed">
                {partnerConnected
                  ? `${p1Display} & ${p2Display} sudah siap memilih rencana kencan.`
                  : "Kirim link di bawah ke WhatsApp pasanganmu untuk mulai memilih kencan bareng!"}
              </p>

              {/* Guest name input if joined via link */}
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
                    placeholder="Contoh: Putri"
                    maxLength={15}
                    className="w-full bg-white text-[#1C1827] font-bold text-sm px-4 py-2.5 rounded-xl outline-none shadow-md"
                  />
                </div>
              )}

              {/* Share Box for Host */}
              {isHost && (
                <div className="mt-5 w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Link Room Kencan:</span>
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
                    <span>Ajak Pasangan via WhatsApp</span>
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
                  <span>{partnerConnected ? "Mulai Rencanakan Kencan!" : "Menunggu Pasangan Bergabung..."}</span>
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
                    Tunggu <strong>{player1.trim() || "Host"}</strong> memulai permainan ya...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: THIS OR THAT SELECTION (PLAYING) */}
        {/* ======================================================== */}
        {stage === "playing" && (
          <div className="flex-1 bg-[#F7F8FC] flex flex-col justify-between p-4 md:p-5 relative select-none">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => {
                  if (mode === "online") {
                    if (confirm("Keluar dari room kencan?")) setStage("start");
                  } else {
                    if (currentPlanIndex > 0) {
                      setCurrentPlanIndex((prev) => prev - 1);
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
                {DEFAULT_PLANS.map((_, idx) => {
                  const isCurrent = idx === currentPlanIndex;
                  const isPassed = idx < currentPlanIndex;
                  return (
                    <div
                      key={idx}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        isCurrent
                          ? "w-6 bg-[#8B5CF6]"
                          : isPassed
                          ? "w-2.5 bg-[#6D28D9]"
                          : "w-2.5 bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Counter */}
              <div className="flex items-center gap-1.5 text-base font-black text-slate-800 pr-1">
                {mode === "online" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online Relay" />
                )}
                <span>
                  {currentPlanIndex + 1}/{DEFAULT_PLANS.length}
                </span>
              </div>
            </div>

            {/* Category Banner & Prompt */}
            <div className="text-center my-auto py-1">
              <div className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 text-[#6D28D9] border border-[#8B5CF6]/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide mb-2">
                <CalendarHeart className="w-3.5 h-3.5" />
                <span>{currentPlan.category}</span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-snug tracking-tight px-2 max-w-xs mx-auto">
                {currentPlan.subtitle}
              </h2>

              {/* Turn / Status Badge */}
              <div className="mt-3 flex items-center justify-center gap-2 text-slate-700 text-xs font-semibold bg-white/90 backdrop-blur-sm py-1.5 px-4 rounded-full border border-slate-200 shadow-sm mx-auto w-fit">
                {mode === "pass-phone" ? (
                  <>
                    <span>{currentTurn === "player1" ? "😊" : "🤫"}</span>
                    <span>
                      Giliran <strong className="text-[#8B5CF6]">{currentTurn === "player1" ? p1Display : p2Display}</strong> memilih
                    </span>
                  </>
                ) : (
                  <>
                    <span>{partnerLocked ? "⚡" : "👀"}</span>
                    <span>
                      {partnerLocked
                        ? `${partnerName} sudah memilih rencananya!`
                        : `Menunggu pilihan dari ${partnerName}...`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* This or That Two Cards Options */}
            <div className="space-y-3 pb-2 relative">
              {/* Online Match / Reveal Animation Popup */}
              {revealPopup && (
                <div className="absolute inset-0 bg-[#1C1827]/95 backdrop-blur-md rounded-[32px] z-30 flex flex-col items-center justify-center text-white p-5 animate-scale-up text-center border-2 border-[#FFD138]">
                  <span className="text-4xl mb-1">{revealPopup.matched ? "🎉" : "💡"}</span>
                  <div className="text-2xl font-black text-[#FFD138] mb-1">
                    {revealPopup.matched ? "IT'S A MATCH!" : "Pilihan Berbeda!"}
                  </div>

                  {revealPopup.matched ? (
                    <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-2xl p-3 my-2 max-w-xs">
                      <span className="text-xs text-emerald-300 font-bold block mb-0.5">
                        ✓ Masuk ke Bucket List Kencan:
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {revealPopup.p1Chosen === "A" ? revealPopup.choiceA.emoji : revealPopup.choiceB.emoji}{" "}
                        {revealPopup.p1Chosen === "A" ? revealPopup.choiceA.title : revealPopup.choiceB.title}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-2xl p-3 my-2 text-xs text-white/90 space-y-1 max-w-xs">
                      <div>
                        {p1Display}: <strong>{revealPopup.p1Chosen === "A" ? revealPopup.choiceA.title : revealPopup.choiceB.title}</strong>
                      </div>
                      <div>
                        {p2Display}: <strong>{revealPopup.p2Chosen === "A" ? revealPopup.choiceA.title : revealPopup.choiceB.title}</strong>
                      </div>
                      <div className="text-[11px] text-yellow-300 pt-1 font-semibold">
                        Gantian dicoba dua-duanya nanti! ✨
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleNextPlan}
                    className="w-full mt-3 bg-[#FFD138] hover:bg-[#FFE066] active:scale-95 text-[#1C1827] font-black text-sm py-3 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Lanjut ke Rencana Berikutnya</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              )}

              {/* Option A Card */}
              <button
                disabled={mode === "online" && myLocked}
                onClick={() => handleSelect("A")}
                className={`w-full text-left p-4 rounded-[28px] shadow-sm transition-all border-2 flex items-start gap-3.5 group relative overflow-hidden ${
                  mode === "online" && myChoice === "A"
                    ? "bg-[#FFE4E6] border-[#FF7BA3] ring-4 ring-[#FF7BA3]/30"
                    : "bg-white hover:bg-slate-50 border-slate-200/80 active:scale-[0.98]"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#FFAEC7]/30 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  {currentPlan.optionA.emoji}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#FFAEC7]/40 text-[#BE123C]">
                      {currentPlan.optionA.tag}
                    </span>
                    <span className="text-xs font-black text-slate-400">PILIHAN A</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {currentPlan.optionA.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed">
                    {currentPlan.optionA.desc}
                  </p>
                </div>
              </button>

              {/* Option B Card */}
              <button
                disabled={mode === "online" && myLocked}
                onClick={() => handleSelect("B")}
                className={`w-full text-left p-4 rounded-[28px] shadow-sm transition-all border-2 flex items-start gap-3.5 group relative overflow-hidden ${
                  mode === "online" && myChoice === "B"
                    ? "bg-[#EDE9FE] border-[#8B5CF6] ring-4 ring-[#8B5CF6]/30"
                    : "bg-white hover:bg-slate-50 border-slate-200/80 active:scale-[0.98]"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#C5B7FD]/30 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  {currentPlan.optionB.emoji}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#C5B7FD]/40 text-[#6D28D9]">
                      {currentPlan.optionB.tag}
                    </span>
                    <span className="text-xs font-black text-slate-400">PILIHAN B</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {currentPlan.optionB.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed">
                    {currentPlan.optionB.desc}
                  </p>
                </div>
              </button>

              {/* Bottom Notice */}
              <div className="text-center text-[11px] text-slate-500 font-medium pt-1 flex items-center justify-center gap-1.5">
                <span>🔒</span>
                <span>
                  {mode === "online" && myLocked
                    ? "Pilihanmu tersimpan! Menunggu pasangan... ⏳"
                    : "Pilihan dirahasiakan sampai kalian berdua selesai memilih"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* INTERSTITIAL: PASS PHONE MODAL (1 HP MODE) */}
        {/* ======================================================== */}
        {stage === "pass-phone" && (
          <div className="flex-1 bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] text-white flex flex-col justify-between p-6 relative select-none animate-fade-in text-center">
            <div className="flex items-center justify-center pt-2">
              <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide">
                Rencana {currentPlanIndex + 1} dari {DEFAULT_PLANS.length}
              </span>
            </div>

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
                  Pilihan {p1Display} Dikunci!
                </h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  Sekarang giliran <strong>{p2Display}</strong> yang memilih tanpa melihat jawaban sebelumnya. Oper HP ini ya!
                </p>
              </div>
            </div>

            <div className="space-y-3 pb-3">
              <button
                onClick={handlePassPhoneConfirm}
                className="w-full bg-[#FFD138] hover:bg-[#FFE066] active:scale-[0.98] text-[#1C1827] font-extrabold text-lg py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-all group"
              >
                <span>Siap! Giliran {p2Display}</span>
                <span className="w-9 h-9 rounded-full bg-[#1C1827] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 3: RESULT "REUNION DATE TICKET" */}
        {/* ======================================================== */}
        {stage === "result" && (
          <div
            ref={ticketRef}
            className="flex-1 bg-gradient-to-b from-[#EC4899] via-[#8B5CF6] to-[#3B82F6] text-slate-800 flex flex-col justify-between p-4 md:p-5 relative select-none overflow-y-auto"
          >
            {/* Top Badge: Tiket Kencan */}
            <div className="flex items-center justify-center pt-2 z-10">
              <div className="bg-white/95 text-[#1E1B4B] px-5 py-2 rounded-full text-xs font-black shadow-md uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-purple-600" />
                <span>Tiket Kencan Reunion Pas Ketemu</span>
              </div>
            </div>

            {/* Score & Header */}
            <div className="text-center my-3 z-10 text-white">
              <div className="text-6xl md:text-7xl font-black tracking-tighter leading-none mb-1">
                {resultData.score}%
              </div>
              <div className="text-xl md:text-2xl font-black text-yellow-300">
                Sehati & Klop Banget!
              </div>
              <div className="text-xs font-semibold text-white/90 mt-1">
                {p1Display} ❤️ {p2Display}
              </div>
            </div>

            {/* Main Boarding Pass Card */}
            <div className="bg-white rounded-[32px] p-5 shadow-2xl z-10 space-y-4 my-1 border border-white/40">
              {/* Card Badge & Title */}
              <div className="text-center">
                <div className="inline-block bg-[#FEF08A] text-[#854D0E] text-[11px] font-black px-3.5 py-1 rounded-full mb-1">
                  {resultData.type.badge}
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {resultData.type.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {resultData.type.description}
                </p>
              </div>

              {/* Matched Bucket List Section */}
              <div className="border-t border-dashed border-slate-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5 uppercase">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bucket List Kencan Disepakati ({resultData.matchedPlans.length}):</span>
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {resultData.matchedPlans.map((m, idx) => (
                    <div
                      key={m.item.id}
                      className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-2.5 flex items-center gap-2.5 text-left"
                    >
                      <span className="text-2xl shrink-0">{m.chosen.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 block truncate">
                          {m.chosen.title}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold block truncate">
                          {m.item.category} · {m.chosen.tag}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 shrink-0">✓ Ready</span>
                    </div>
                  ))}

                  {resultData.matchedPlans.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-500">
                      Kalian punya selera berbeda di semua kategori! Nanti bisa saling cobain ide satu sama lain bergantian.
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Diff Compromises */}
              {resultData.diffPlans.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowAllPlans(!showAllPlans)}
                    className="w-full text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {showAllPlans
                        ? "Sembunyikan rencana berbeda"
                        : `Lihat ${resultData.diffPlans.length} rencana dengan selera berbeda`}
                    </span>
                  </button>

                  {showAllPlans && (
                    <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto text-left text-xs text-slate-600 border-t border-slate-100 pt-2">
                      {resultData.diffPlans.map((d) => (
                        <div key={d.item.id} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 block text-[11px] mb-0.5">
                            {d.item.category}:
                          </span>
                          <div className="text-[10px] text-slate-500 flex justify-between gap-1">
                            <span>{p1Display}: {d.p1Chosen.emoji} {d.p1Chosen.title}</span>
                            <span>{p2Display}: {d.p2Chosen.emoji} {d.p2Chosen.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions: Main Lagi, Simpan Tiket, Bagikan */}
            <div className="grid grid-cols-3 gap-2.5 z-10 pt-2 pb-1">
              <button
                onClick={handleReset}
                className="bg-[#FFE483] hover:bg-[#FFDC66] active:scale-95 text-[#1C1827] font-extrabold py-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 transition-all"
              >
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs">Main lagi</span>
              </button>

              <button
                onClick={handleSaveTicketImage}
                className="bg-[#FFAEC7] hover:bg-[#FF9BB9] active:scale-95 text-[#1C1827] font-extrabold py-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs">Simpan Tiket</span>
              </button>

              <button
                onClick={handleShareResult}
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
