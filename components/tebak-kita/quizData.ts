export interface Question {
  id: number;
  category: string;
  tag: string;
  text: string;
}

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 1,
    category: "Emosi & Film",
    tag: "Siapa yang lebih mungkin...",
    text: "...nangis duluan pas nonton film sedih?",
  },
  {
    id: 2,
    category: "Makanan",
    tag: "Siapa yang lebih mungkin...",
    text: "...ngabisin camilan pas nonton bioskop sebelum filmnya mulai?",
  },
  {
    id: 3,
    category: "Jalan-Jalan",
    tag: "Siapa yang lebih mungkin...",
    text: "...paling lama dandan & siap-siap kalau mau pergi?",
  },
  {
    id: 4,
    category: "Navigasi",
    tag: "Siapa yang lebih mungkin...",
    text: "...panik duluan kalau salah belok atau nyasar di jalan?",
  },
  {
    id: 5,
    category: "Belanja",
    tag: "Siapa yang lebih mungkin...",
    text: "...gampang tergiur diskon dan checkout barang lucu di marketplace?",
  },
  {
    id: 6,
    category: "Hubungan",
    tag: "Siapa yang lebih mungkin...",
    text: "...yang bakal ngajak baikan atau minta maaf duluan kalau lagi ngambek?",
  },
  {
    id: 7,
    category: "Kebiasaan",
    tag: "Siapa yang lebih mungkin...",
    text: "...paling sering panik nyari kunci, kacamata, atau HP yang terselip?",
  },
  {
    id: 8,
    category: "Makanan",
    tag: "Siapa yang lebih mungkin...",
    text: "...paling lama milih menu pas ditanya mau makan di mana?",
  },
  {
    id: 9,
    category: "Hiburan",
    tag: "Siapa yang lebih mungkin...",
    text: "...paling heboh karaokean di mobil pas lagu favoritnya keputer?",
  },
  {
    id: 10,
    category: "Begadang",
    tag: "Siapa yang lebih mungkin...",
    text: "...ketiduran duluan pas lagi asyik deep talk malam-malam?",
  },
];

export interface CoupleTypeResult {
  title: string;
  badge: string;
  description: string;
  palingKompak: string;
  palingBeda: string;
}

export function calculateCoupleResult(
  questions: Question[],
  answers: Record<number, { player1?: "player1" | "player2"; player2?: "player1" | "player2" }>
): {
  score: number;
  matchCount: number;
  total: number;
  coupleType: CoupleTypeResult;
  categoryMatches: Record<string, { matches: number; total: number }>;
} {
  let matches = 0;
  const categoryStats: Record<string, { matches: number; total: number }> = {};

  questions.forEach((q) => {
    if (!categoryStats[q.category]) {
      categoryStats[q.category] = { matches: 0, total: 0 };
    }
    categoryStats[q.category].total += 1;

    const ans = answers[q.id];
    if (ans && ans.player1 && ans.player2) {
      if (ans.player1 === ans.player2) {
        matches += 1;
        categoryStats[q.category].matches += 1;
      }
    }
  });

  const total = questions.length;
  // Calculate percentage, formatted nicely
  const rawPercentage = (matches / total) * 100;
  // Dynamic realistic percentage formula between 60% and 98%
  const score = Math.min(98, Math.max(55, Math.round(50 + (rawPercentage * 0.48))));

  // Find best and worst category
  let bestCat = "";
  let bestRatio = -1;
  let worstCat = "";
  let worstRatio = 2;

  Object.entries(categoryStats).forEach(([cat, stat]) => {
    const ratio = stat.matches / stat.total;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestCat = cat;
    }
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worstCat = cat;
    }
  });

  const palingKompak = `Soal ${bestCat || "makanan"}`;
  const palingBeda = `Soal ${worstCat && worstCat !== bestCat ? worstCat : "liburan"}`;

  let coupleType: CoupleTypeResult;
  if (score >= 88) {
    coupleType = {
      title: "Kembar Beda Emak",
      badge: "Tipe couple kalian",
      description: "Hafal satu sama lain lebih dari hafal PIN sendiri. Koneksi batin tingkat dewa!",
      palingKompak,
      palingBeda,
    };
  } else if (score >= 76) {
    coupleType = {
      title: "Duo Kompak Sejati",
      badge: "Tipe couple kalian",
      description: "Saling melengkapi kayak Indomie goreng sama telor setengah matang. Klop abis!",
      palingKompak,
      palingBeda,
    };
  } else if (score >= 65) {
    coupleType = {
      title: "Dua Sejoli Asyik",
      badge: "Tipe couple kalian",
      description: "Kadang beda selera, tapi justru perbedaan itu yang bikin hubungan selalu rame dan seru.",
      palingKompak,
      palingBeda,
    };
  } else {
    coupleType = {
      title: "Tom & Jerry Bucin",
      badge: "Tipe couple kalian",
      description: "Suka berdebat hal-hal kecil tapi gak pernah bisa pisah sedetik pun!",
      palingKompak,
      palingBeda,
    };
  }

  return {
    score,
    matchCount: matches,
    total,
    coupleType,
    categoryMatches: categoryStats,
  };
}

