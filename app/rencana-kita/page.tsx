import { Metadata } from "next";
import { Suspense } from "react";
import RencanaKitaGame from "@/components/rencana-kita/RencanaKitaGame";

export const metadata: Metadata = {
  title: "Rencana Kita · Reunion Bucket List Date",
  description:
    "Game This or That buat pasangan LDR! Cocokkan rencana kencan impian pas ketemu nanti, kumpulin bucket list, dan download Tiket Kencan kalian.",
  openGraph: {
    title: "Rencana Kita · Reunion Bucket List Date",
    description: "Cocokkan rencana kencan pas ketemu nanti bareng pasangan LDR-mu!",
  },
};

export default function RencanaKitaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F1424] flex items-center justify-center text-white font-sans">
          <div className="animate-pulse text-sm font-semibold text-white/80">
            Memuat Rencana Kita...
          </div>
        </div>
      }
    >
      <RencanaKitaGame />
    </Suspense>
  );
}
