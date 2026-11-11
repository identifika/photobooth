import { Metadata } from "next";
import { Suspense } from "react";
import TebakKitaGame from "@/components/tebak-kita/TebakKitaGame";

export const metadata: Metadata = {
  title: "Tebak Kita · Seberapa Kenal Kamu Sama Dia?",
  description:
    "Game kuis seru untuk pasangan! Jawab diam-diam, buka bareng, dan lihat seberapa kompak kalian berdua.",
  openGraph: {
    title: "Tebak Kita · Game Pasangan Seru",
    description: "Seberapa kenal kamu sama dia? Mainkan kuis pasangan Shape Friends!",
  },
};

export default function TebakKitaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#110D20] flex items-center justify-center text-white font-sans">
          <div className="animate-pulse text-sm font-semibold text-white/80">
            Memuat Tebak Kita...
          </div>
        </div>
      }
    >
      <TebakKitaGame />
    </Suspense>
  );
}

