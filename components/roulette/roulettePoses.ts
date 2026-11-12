export interface RoulettePose {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  badge: string;
  color: string;
  accent: string;
  hint: string;
}

export const ALL_ROULETTE_POSES: RoulettePose[] = [
  {
    id: "half-heart",
    title: "Bikin Setengah Hati!",
    subtitle: "Tangan harus pas nyatu di garis tengah layar!",
    emoji: "🫶",
    badge: "Romantis Klop",
    color: "#FF2E93",
    accent: "#FFE4F1",
    hint: "Tempelkan tanganmu persis di garis tengah agar membentuk 1 hati utuh berdua!",
  },
  {
    id: "silly-face",
    title: "Muka Paling Konyol!",
    subtitle: "Pose muka paling jelek & konyol tanpa malu!",
    emoji: "🤪",
    badge: "Anti Jaim",
    color: "#8B5CF6",
    accent: "#EDE9FE",
    hint: "Mata juling, lidah melet, atau pipi monyong sejelek mungkin!",
  },
  {
    id: "random-item",
    title: "Pamer Barang Terdekat!",
    subtitle: "Pegang & pamerin barang paling acak di dekatmu!",
    emoji: "📦",
    badge: "Spontan Abis",
    color: "#F59E0B",
    accent: "#FEF3C7",
    hint: "Bisa botol minum, bantal, cemilan, sendok, atau boneka!",
  },
  {
    id: "kiss-screen",
    title: "Cium Layar (Virtual Kiss)!",
    subtitle: "Pose bibir cium ke arah kamera sedekat mungkin!",
    emoji: "😚",
    badge: "Gemes Maksimal",
    color: "#EC4899",
    accent: "#FCE7F3",
    hint: "Majuin wajah ke kamera dan berikan ciuman paling lebay!",
  },
  {
    id: "stare-peace",
    title: "Peace & Tatap Matanya!",
    subtitle: "Pose 2 jari sambil tatap mata pasangan tanpa kedip!",
    emoji: "✌️",
    badge: "Tatap-tatapan",
    color: "#10B981",
    accent: "#D1FAE5",
    hint: "Fokus tatap mata dia di layar, jangan sampai kedip duluan ya!",
  },
  {
    id: "fashion-model",
    title: "Model Majalah Sombong!",
    subtitle: "Pose sok keren & judes ala model catwalk elit!",
    emoji: "🕶️",
    badge: "High Fashion",
    color: "#0F172A",
    accent: "#F1F5F9",
    hint: "Angkat dagu, tatapan tajam tanpa senyum seolah paling berkuasa!",
  },
  {
    id: "pretend-sleep",
    title: "Pura-Pura Ketiduran!",
    subtitle: "Merem pulas & senderan seolah ketiduran pas call!",
    emoji: "😴",
    badge: "Lucu Gemas",
    color: "#6366F1",
    accent: "#E0E7FF",
    hint: "Kepala miring, mulut sedikit mangap seolah mimpi indah bareng dia!",
  },
  {
    id: "bunny-ears",
    title: "Telinga Kelinci / Kucing!",
    subtitle: "Bikin dua telinga lucu pakai tangan di atas kepala!",
    emoji: "🐰",
    badge: "Super Cute",
    color: "#F43F5E",
    accent: "#FFE4E6",
    hint: "Goyangkan jarimu seperti telinga kelinci yang lagi penasaran!",
  },
  {
    id: "dramatic-shock",
    title: "Kaget Dramatis!",
    subtitle: "Mulut mangap & pegang pipi seolah syok berat!",
    emoji: "😲",
    badge: "Melodrama",
    color: "#E11D48",
    accent: "#FFE4E6",
    hint: "Ekspresi seolah baru lihat hantu atau dapet diskon dadakan 99%!",
  },
  {
    id: "flower-bloom",
    title: "Kuntum Bunga Mekar!",
    subtitle: "Dua tangan menopang dagu seolah wajahmu adalah bunga!",
    emoji: "🌸",
    badge: "Aesthetic Bloom",
    color: "#DB2777",
    accent: "#FDF2F8",
    hint: "Tersenyum manis dengan kedua telapak tangan terbuka di bawah dagu!",
  },
  {
    id: "sip-drink",
    title: "Nyeruput Minuman Estetik!",
    subtitle: "Pura-pura atau beneran minum dengan gaya paling santai!",
    emoji: "☕",
    badge: "Cafe Date",
    color: "#B45309",
    accent: "#FEF3C7",
    hint: "Pegang cangkir atau gelas, tatap kamera seolah lagi kencan di kafe!",
  },
  {
    id: "peek-a-boo",
    title: "Cilukba Malu-Malu!",
    subtitle: "Tutup muka pakai tangan, terus ngintip lewat jari!",
    emoji: "🙈",
    badge: "Malu-malu Kucing",
    color: "#065F46",
    accent: "#D1FAE5",
    hint: "Sembunyikan wajah lalu buka sedikit jemari untuk intip pasanganmu!",
  },
  {
    id: "finger-heart",
    title: "Korean Finger Heart!",
    subtitle: "Pose jempol & telunjuk silang ala bintang K-Drama!",
    emoji: "🫰",
    badge: "K-Wave",
    color: "#9333EA",
    accent: "#F3E8FF",
    hint: "Keluarkan love kecil dari jarimu tepat di depan kamera!",
  },
  {
    id: "superhero",
    title: "Superhero Siap Tempur!",
    subtitle: "Tangan mengepal ke kamera seolah mau tembak laser!",
    emoji: "🦸",
    badge: "Aksi Heboh",
    color: "#2563EB",
    accent: "#DBEAFE",
    hint: "Pasang kuda-kuda paling mantap siap melindungi pasanganmu!",
  },
  {
    id: "big-laugh",
    title: "Tertawa Lepas Bahagia!",
    subtitle: "Pose ketawa paling lebar seolah dengar lelucon terlucu!",
    emoji: "🤣",
    badge: "Full Senyum",
    color: "#D97706",
    accent: "#FEF3C7",
    hint: "Ketawa lepas natural sampai matamu menyipit bahagia!",
  },
  {
    id: "retro-duckface",
    title: "Selfie Alay 2010!",
    subtitle: "Pose bibir monyong (duckface) dengan dua jari miring!",
    emoji: "🤳",
    badge: "Throwback Nostalgia",
    color: "#C026D3",
    accent: "#FAE8FF",
    hint: "Keluarkan aura foto profil Facebook zaman dulu!",
  },
];

/**
 * Returns 4 distinct random poses for a 4-grid photo strip game
 */
export function getRandomRoulettePoses(count: number = 4): RoulettePose[] {
  const shuffled = [...ALL_ROULETTE_POSES].sort(() => 0.5 - Math.random());
  // Ensure "half-heart" or "silly-face" is almost always in the mix for fun!
  const hasHeart = shuffled.slice(0, count).some((p) => p.id === "half-heart");
  if (!hasHeart && count >= 2) {
    const heartPose = ALL_ROULETTE_POSES.find((p) => p.id === "half-heart")!;
    shuffled[0] = heartPose;
  }
  return shuffled.slice(0, count);
}
