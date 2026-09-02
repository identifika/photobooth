'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createUserFrame } from '@/lib/user-frames';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { FrameConfig } from '@/lib/frame-types';

interface SeedFrameData {
  name: string;
  emoji: string;
  categoryId: string;
  config: FrameConfig;
}

const FRAMES_TO_SEED: SeedFrameData[] = [
  // ── 1. Midnight Celestial ──────────────────────────────────────────
  // Dark navy/gold luxury theme with celestial accents
  {
    categoryId: '',
    config: {
      accentColor: '#d4af37',
      accentSize: 3,
      bgGradientAngle: 180,
      bgGradientFrom: '#0d1b2a',
      bgGradientTo: '#1b2d45',
      bgType: 'gradient',
      borderColor: '#d4af37',
      borderStyle: 'solid',
      borderWidth: 4,
      color: '#0d1b2a',
      elements: [
        { align: 'center', color: '#d4af37', font: 'Cormorant Garamond', fontSize: 11, height: 16, id: 'mc01t0', text: '✦  ✦  ✦  W R I T T E N   I N   T H E   S T A R S  ✦  ✦  ✦', type: 'title', width: 360, x: 20, y: 10 } as any,
        { align: 'center', color: '#f0e6c8', font: 'Dancing Script', fontSize: 36, height: 48, id: 'mc01t1', text: '{{couple}}', type: 'title', width: 360, x: 20, y: 30 } as any,
        { borderColor: '#d4af37', borderRadius: 6, borderWidth: 4, height: 220, id: 'mc01a1', rotation: 0, type: 'photo', width: 280, x: 60, y: 86 } as any,
        { align: 'center', color: '#8a9bb5', font: 'Montserrat', fontSize: 12, height: 18, id: 'mc01t2', text: '☾ {{date}} ☽', type: 'title', width: 360, x: 20, y: 316 } as any,
        { align: 'center', color: '#d4af37', font: 'Cormorant Garamond', fontSize: 15, height: 22, id: 'mc01t3', text: '{{venue}}', type: 'title', width: 360, x: 20, y: 338 } as any,
        { align: 'center', color: '#4a5a72', font: 'Montserrat', fontSize: 10, height: 16, id: 'mc01t4', text: '{{hashtag}}', type: 'title', width: 360, x: 20, y: 362 } as any,
      ],
      height: 390,
      width: 400,
    },
    emoji: '🌙',
    name: 'Wedding Midnight Celestial',
  },

  // ── 2. Vintage Photo Strip ─────────────────────────────────────────
  // Retro ticket-punched strip with 3 stacked photos
  {
    categoryId: '',
    config: {
      accentColor: '#c8a96e',
      accentSize: 0,
      bgType: 'solid',
      borderColor: '#8b7355',
      borderStyle: 'ticket',
      borderWidth: 4,
      ticketHoleSize: 8,
      color: '#faf5eb',
      elements: [
        { align: 'center', color: '#5c4a32', font: 'Playfair Display', fontSize: 14, height: 20, id: 'vs01t0', text: '— OUR LOVE STORY —', type: 'title', width: 360, x: 20, y: 16 } as any,
        { borderColor: '#c8a96e', borderRadius: 4, borderWidth: 3, height: 130, id: 'vs01a1', rotation: 0, type: 'photo', width: 300, x: 50, y: 44 } as any,
        { borderColor: '#c8a96e', borderRadius: 4, borderWidth: 3, height: 130, id: 'vs01a2', rotation: 0, type: 'photo', width: 300, x: 50, y: 182 } as any,
        { borderColor: '#c8a96e', borderRadius: 4, borderWidth: 3, height: 130, id: 'vs01a3', rotation: 0, type: 'photo', width: 300, x: 50, y: 320 } as any,
        { align: 'center', color: '#8b7355', font: 'Dancing Script', fontSize: 28, height: 38, id: 'vs01t1', text: '{{couple}}', type: 'title', width: 360, x: 20, y: 460 } as any,
        { align: 'center', color: '#a08a6a', font: 'Montserrat', fontSize: 11, height: 18, id: 'vs01t2', text: '{{date}}  ·  {{venue}}', type: 'title', width: 360, x: 20, y: 500 } as any,
      ],
      height: 530,
      width: 400,
    },
    emoji: '🎞️',
    name: 'Wedding Vintage Photo Strip',
  },

  // ── 3. Romantic Blush Duet ─────────────────────────────────────────
  // Soft pink/rose gold with two side-by-side circular photos
  {
    categoryId: '',
    config: {
      accentColor: '#e8a0b4',
      accentSize: 2,
      bgGradientAngle: 135,
      bgGradientFrom: '#fff5f8',
      bgGradientTo: '#fde2ec',
      bgType: 'gradient',
      borderColor: '#e8a0b4',
      borderStyle: 'solid',
      borderWidth: 3,
      color: '#5c2e42',
      elements: [
        { align: 'center', color: '#c77a94', font: 'Cormorant Garamond', fontSize: 12, height: 18, id: 'rb01t0', text: 'F O R E V E R   &   A L W A Y S', type: 'title', width: 360, x: 20, y: 12 } as any,
        { borderColor: '#ffffff', borderRadius: 100, borderWidth: 6, height: 150, id: 'rb01a1', rotation: -3, type: 'photo', width: 150, x: 30, y: 44 } as any,
        { align: 'center', color: '#e8a0b4', font: 'Dancing Script', fontSize: 42, height: 50, id: 'rb01t_amp', text: '&', type: 'title', width: 40, x: 180, y: 94 } as any,
        { borderColor: '#ffffff', borderRadius: 100, borderWidth: 6, height: 150, id: 'rb01a2', rotation: 3, type: 'photo', width: 150, x: 220, y: 44 } as any,
        { align: 'center', color: '#5c2e42', font: 'Dancing Script', fontSize: 34, height: 46, id: 'rb01t1', text: '{{couple}}', type: 'title', width: 360, x: 20, y: 208 } as any,
        { align: 'center', color: '#c77a94', font: 'Cormorant Garamond', fontSize: 13, height: 20, id: 'rb01t2', text: '♡ {{date}} ♡', type: 'title', width: 360, x: 20, y: 258 } as any,
        { align: 'center', color: '#9a5a72', font: 'Cormorant Garamond', fontSize: 14, height: 22, id: 'rb01t3', text: '{{venue}}', type: 'title', width: 360, x: 20, y: 280 } as any,
      ],
      height: 316,
      width: 400,
    },
    emoji: '💕',
    name: 'Wedding Romantic Blush Duet',
  },

  // ── 4. Tropical Paradise ───────────────────────────────────────────
  // Vibrant tropical/destination wedding with diagonal photo layout
  {
    categoryId: '',
    config: {
      accentColor: '#e67e22',
      accentSize: 3,
      bgGradientAngle: 160,
      bgGradientFrom: '#f0faf5',
      bgGradientTo: '#d4f0e7',
      bgType: 'gradient',
      borderColor: '#2eaa7a',
      borderStyle: 'dashed',
      borderWidth: 3,
      color: '#1a4a38',
      elements: [
        { align: 'center', color: '#2eaa7a', font: 'Dancing Script', fontSize: 18, height: 26, id: 'tp01t0', text: '🌴 🌺 🍃 🌺 🌴', type: 'title', width: 360, x: 20, y: 8 } as any,
        { borderColor: '#ffffff', borderRadius: 14, borderWidth: 5, height: 172, id: 'tp01a1', rotation: -6, type: 'photo', width: 168, x: 16, y: 46, z: 1 } as any,
        { borderColor: '#ffffff', borderRadius: 14, borderWidth: 5, height: 172, id: 'tp01a2', rotation: 4, type: 'photo', width: 168, x: 216, y: 64, z: 2 } as any,
        { borderColor: '#ffffff', borderRadius: 10, borderWidth: 5, height: 100, id: 'tp01a3', rotation: -2, type: 'photo', width: 140, x: 130, y: 200, z: 3 } as any,
        { align: 'center', color: '#1a4a38', font: 'Playfair Display', fontSize: 30, height: 42, id: 'tp01t1', text: '{{couple}}', type: 'title', width: 360, x: 20, y: 312 } as any,
        { align: 'center', color: '#e67e22', font: 'Montserrat', fontSize: 11, height: 18, id: 'tp01t2', text: '{{date}}', type: 'title', width: 360, x: 20, y: 358 } as any,
        { align: 'center', color: '#2eaa7a', font: 'Dancing Script', fontSize: 16, height: 24, id: 'tp01t3', text: '🌺 {{venue}} 🌺', type: 'title', width: 360, x: 20, y: 378 } as any,
      ],
      height: 414,
      width: 400,
    },
    emoji: '🌴',
    name: 'Wedding Tropical Paradise',
  },
];

export default function SeedPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    if (!user) {
      setStatus('⚠️ Please sign in first before adding frames.');
      return;
    }

    setIsSeeding(true);
    setStatus(`⏳ Adding ${FRAMES_TO_SEED.length} wedding frames for user ${user.email || user.uid}...`);

    try {
      for (const frame of FRAMES_TO_SEED) {
        const docId = await createUserFrame(user.uid, frame);
        setStatus((prev) => `${prev}\n✅ Added "${frame.name}" -> ID: ${docId}`);
      }
      setStatus((prev) => `${prev}\n\n🎉 All 4 wedding frames added successfully!`);
    } catch (err: any) {
      console.error(err);
      setStatus((prev) => `${prev}\n\n❌ Error: ${err.message || String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Import Wedding Frames</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Import 4 new creative wedding frames into your Firestore account.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-neutral-400">Checking authentication...</div>
        ) : user ? (
          <div className="bg-neutral-800/60 p-3 rounded-lg text-xs space-y-1">
            <div className="text-neutral-300">Signed in as: <span className="font-semibold text-white">{user.email || user.uid}</span></div>
            <div className="text-neutral-400">UID: {user.uid}</div>
          </div>
        ) : (
          <div className="bg-amber-950/40 border border-amber-800/50 p-3 rounded-lg text-xs text-amber-200">
            ⚠️ You are not signed in. <Link href="/login" className="underline text-amber-400 hover:text-amber-300">Sign in here</Link> first.
          </div>
        )}

        <Button
          onClick={handleSeed}
          disabled={!user || isSeeding || loading}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 rounded-xl transition"
        >
          {isSeeding ? 'Adding Frames...' : '✨ Add 4 Creative Wedding Frames'}
        </Button>


        {status && (
          <pre className="bg-neutral-950 p-4 rounded-xl text-xs font-mono text-neutral-300 whitespace-pre-wrap max-h-60 overflow-y-auto border border-neutral-800">
            {status}
          </pre>
        )}

        <div className="text-center pt-2">
          <Link href="/frames" className="text-xs text-neutral-400 hover:text-white underline">
            Go to My Frames →
          </Link>
        </div>
      </div>
    </div>
  );
}
