import { Metadata } from "next";
import { Suspense } from "react";
import PhotoRouletteGame from "@/components/roulette/PhotoRouletteGame";

export const metadata: Metadata = {
  title: "Reaction Photo Roulette · Photobooth Spontan saat Call",
  description:
    "Photobooth spontan berdua saat video call WebRTC! Musik countdown 10 detik dengan tantangan pose mendadak untuk menghasilkan strip foto 4-grid kenangan date.",
  openGraph: {
    title: "Reaction Photo Roulette · Photobooth Spontan",
    description: "Tantangan pose spontan saat video call bareng pasangan LDR!",
  },
};

export default function RoulettePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090A10] flex items-center justify-center text-white font-sans">
          <div className="animate-pulse text-sm font-semibold text-white/80">
            Memuat Reaction Photo Roulette...
          </div>
        </div>
      }
    >
      <PhotoRouletteGame />
    </Suspense>
  );
}
