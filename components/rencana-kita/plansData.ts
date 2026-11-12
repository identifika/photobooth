export interface DateOption {
  id: "A" | "B";
  title: string;
  desc: string;
  emoji: string;
  tag: string;
  color: string;
}

export interface DatePlanItem {
  id: number;
  category: string;
  subtitle: string;
  optionA: DateOption;
  optionB: DateOption;
}

export type PlanChoiceType = "A" | "B" | "CUSTOM" | "SKIP";

export interface SinglePlanAnswer {
  choice: PlanChoiceType;
  customText?: string;
}

export const DEFAULT_PLANS: DatePlanItem[] = [
  {
    id: 1,
    category: "Kuliner Pertama",
    subtitle: "Pas hari pertama ketemu, mau makan apa dulu?",
    optionA: {
      id: "A",
      title: "Street Food & Jajan Malam",
      desc: "Keliling angkringan, jajan kaki lima, santai & kenyang",
      emoji: "🍢",
      tag: "Santai & Ramai",
      color: "#FFAEC7",
    },
    optionB: {
      id: "B",
      title: "Cafe Hopping & Dessert",
      desc: "Tempat estetik, foto-foto lucu, ngobrol berjam-jam",
      emoji: "🍰",
      tag: "Aesthetic & Cozy",
      color: "#C5B7FD",
    },
  },
  {
    id: 2,
    category: "Nonton Bareng",
    subtitle: "Momen nonton yang paling seru kalian rasain berdua?",
    optionA: {
      id: "A",
      title: "Bioskop Midnight Movie",
      desc: "Popcorn jumbo, layar megah, serunya nonton film baru bareng",
      emoji: "🍿",
      tag: "Exciting",
      color: "#FFE785",
    },
    optionB: {
      id: "B",
      title: "Nonton Santai di Rumah",
      desc: "Maraton series/film favorit, pesan delivery camilan enak, santai tanpa ribet",
      emoji: "🛋️",
      tag: "Warm & Cozy",
      color: "#B8E986",
    },
  },
  {
    id: 3,
    category: "Healing di Alam",
    subtitle: "Spot alam yang paling pengen kalian datangi pas ketemu?",
    optionA: {
      id: "A",
      title: "Piknik Santai di Taman",
      desc: "Bawa bekal enak, dengar playlist berdua santai di bawah pohon",
      emoji: "🧺",
      tag: "Nature & Fresh",
      color: "#A7F3D0",
    },
    optionB: {
      id: "B",
      title: "Sunset-an di Tepi Pantai",
      desc: "Minum air kelapa, jalan santai sore di pasir pantai",
      emoji: "🌅",
      tag: "Romantic Sunset",
      color: "#FED7AA",
    },
  },
  {
    id: 4,
    category: "Aktivitas Seru",
    subtitle: "Biar gak cuma jalan-jalan biasa, kalian lebih suka?",
    optionA: {
      id: "A",
      title: "Arcade & Photobooth Marathon",
      desc: "Balapan mobil di timezone, kumpulin tiket & foto box lucu",
      emoji: "🎮",
      tag: "Playful & Fun",
      color: "#C5B7FD",
    },
    optionB: {
      id: "B",
      title: "Museum Date & Galeri Seni",
      desc: "Lihat instalasi seni interaktif, saling fotoin OOTD keren",
      emoji: "🎨",
      tag: "Artistic & Chill",
      color: "#FFAEC7",
    },
  },
  {
    id: 5,
    category: "Masak Sendiri",
    subtitle: "Tantangan bikin makanan bareng pas lagi ketemu?",
    optionA: {
      id: "A",
      title: "Belanja & Masak Sendiri",
      desc: "Belanja bahan di supermarket, seru-seruan masak bareng di dapur",
      emoji: "🍳",
      tag: "Chef Couple",
      color: "#FED7AA",
    },
    optionB: {
      id: "B",
      title: "All-You-Can-Eat BBQ / Shabu",
      desc: "Panggang daging sepuasnya, makan enak sampai kenyang",
      emoji: "🥩",
      tag: "Meat Lovers",
      color: "#FECDD3",
    },
  },
  {
    id: 6,
    category: "Jalan Malam",
    subtitle: "Malam minggu pertama setelah sekian lama LDR?",
    optionA: {
      id: "A",
      title: "Night Ride Naik Motor",
      desc: "Pakai jaket couple, rasain angin malam kota sambil ngobrol santai",
      emoji: "🛵",
      tag: "City Vibes",
      color: "#BAE6FD",
    },
    optionB: {
      id: "B",
      title: "City Walk & Beli Es Krim",
      desc: "Jalan santai di trotoar kota malam hari sambil jajan es krim",
      emoji: "🍦",
      tag: "Sweet & Slow",
      color: "#FDE68A",
    },
  },
  {
    id: 7,
    category: "Liburan Impian",
    subtitle: "Kalau ada liburan panjang pas ketemu nanti, lebih pengen suasana apa?",
    optionA: {
      id: "A",
      title: "Glamping / Kabin Sejuk di Alam",
      desc: "Udara dingin pegunungan berkabut, api unggun & jagung bakar hangat",
      emoji: "🏕️",
      tag: "Adventure Nature",
      color: "#A7F3D0",
    },
    optionB: {
      id: "B",
      title: "City Staycation & Istirahat Santai",
      desc: "Hotel nyaman di tengah kota, sarapan enak, rileks tanpa diganggu kerjaan",
      emoji: "🏨",
      tag: "Pure Relaxation",
      color: "#E9D5FF",
    },
  },
  {
    id: 8,
    category: "Pagi Hari",
    subtitle: "Gaya pagi hari kalian pas lagi barengan?",
    optionA: {
      id: "A",
      title: "Bangun Pagi & Cari Sarapan",
      desc: "CFD-an, jalan santai pagi, makan bubur ayam / lontong sayur langganan",
      emoji: "🥣",
      tag: "Early Birds",
      color: "#FEF08A",
    },
    optionB: {
      id: "B",
      title: "Bangun Siang & Santai Brunch",
      desc: "Tidur cukup tanpa alarm, bangun santai lanjut makan siang enak",
      emoji: "☕",
      tag: "Slow Morning",
      color: "#DDD6FE",
    },
  },
  {
    id: 9,
    category: "Belanja Seru",
    subtitle: "Pas lagi muterin mall atau toko lucu?",
    optionA: {
      id: "A",
      title: "Saling Pilihin Baju (OOTD)",
      desc: "Tantangan beliin outfit yang menurutmu cocok buat pasangan",
      emoji: "👕",
      tag: "Fashion Fun",
      color: "#FBCFE8",
    },
    optionB: {
      id: "B",
      title: "Cari Pernak-Pernik & Buku",
      desc: "Beli gantungan kunci couple, pernak-pernik lucu & buku bacaan",
      emoji: "📚",
      tag: "Cute Memories",
      color: "#BBF7D0",
    },
  },
  {
    id: 10,
    category: "Kenang-kenangan",
    subtitle: "Bikin barang kenang-kenangan yang bisa dibawa pulang?",
    optionA: {
      id: "A",
      title: "Workshop Keramik / Pottery",
      desc: "Bikin kerajinan tanah liat berdua, cetak cangkir couple buatan tangan",
      emoji: "🏺",
      tag: "Handmade Love",
      color: "#FED7AA",
    },
    optionB: {
      id: "B",
      title: "Bikin Cincin / DIY Silver Ring",
      desc: "Palu & ukir inisial nama atau tanggal penting di cincin perak sendiri",
      emoji: "💍",
      tag: "Precious Memory",
      color: "#E2E8F0",
    },
  },
];

export interface CouplePlanResult {
  score: number;
  matchedCount: number;
  totalAnswered: number;
  skippedCount: number;
  total: number;
  matchedPlans: Array<{
    item: DatePlanItem;
    title: string;
    desc: string;
    emoji: string;
    tag: string;
    isCustom?: boolean;
    customAuthor?: string;
  }>;
  diffPlans: Array<{
    item: DatePlanItem;
    p1Text: string;
    p1Emoji: string;
    p2Text: string;
    p2Emoji: string;
    p1IsCustom?: boolean;
    p2IsCustom?: boolean;
  }>;
  customIdeas: Array<{
    item: DatePlanItem;
    author: string;
    text: string;
  }>;
  skippedPlans: Array<{
    item: DatePlanItem;
  }>;
  type: {
    badge: string;
    title: string;
    description: string;
    highlight: string;
  };
}

export function calculatePlanResult(
  items: DatePlanItem[],
  answers: Record<number, { player1?: SinglePlanAnswer; player2?: SinglePlanAnswer }>,
  p1Name = "Aku",
  p2Name = "Pasangan"
): CouplePlanResult {
  let matchedCount = 0;
  let skippedCount = 0;
  let totalAnswered = 0;
  const matchedPlans: CouplePlanResult["matchedPlans"] = [];
  const diffPlans: CouplePlanResult["diffPlans"] = [];
  const customIdeas: CouplePlanResult["customIdeas"] = [];
  const skippedPlans: CouplePlanResult["skippedPlans"] = [];

  items.forEach((item) => {
    const ans = answers[item.id];
    if (!ans) return;

    const p1 = ans.player1;
    const p2 = ans.player2;

    // If either skipped, consider the scenario skipped
    if (p1?.choice === "SKIP" || p2?.choice === "SKIP") {
      skippedCount++;
      skippedPlans.push({ item });
      return;
    }

    if (p1 && p2) {
      totalAnswered++;

      // Track any custom ideas
      if (p1.choice === "CUSTOM" && p1.customText) {
        customIdeas.push({ item, author: p1Name, text: p1.customText });
      }
      if (p2.choice === "CUSTOM" && p2.customText && p2.customText !== p1.customText) {
        customIdeas.push({ item, author: p2Name, text: p2.customText });
      }

      // Check match:
      if (p1.choice === "A" && p2.choice === "A") {
        matchedCount++;
        matchedPlans.push({
          item,
          title: item.optionA.title,
          desc: item.optionA.desc,
          emoji: item.optionA.emoji,
          tag: item.optionA.tag,
        });
      } else if (p1.choice === "B" && p2.choice === "B") {
        matchedCount++;
        matchedPlans.push({
          item,
          title: item.optionB.title,
          desc: item.optionB.desc,
          emoji: item.optionB.emoji,
          tag: item.optionB.tag,
        });
      } else if (p1.choice === "CUSTOM" && p2.choice === "CUSTOM") {
        matchedCount++;
        matchedPlans.push({
          item,
          title: p1.customText?.trim() || "Ide Kencan Spesial",
          desc: `Ide kencan spesial dari ${p1Name} & ${p2Name}`,
          emoji: "💡",
          tag: "Ide Spesial Berdua",
          isCustom: true,
        });
      } else {
        const getDisplay = (ansItem: SinglePlanAnswer, authorName: string) => {
          if (ansItem.choice === "A") return { text: item.optionA.title, emoji: item.optionA.emoji, isCustom: false };
          if (ansItem.choice === "B") return { text: item.optionB.title, emoji: item.optionB.emoji, isCustom: false };
          return { text: ansItem.customText?.trim() || `Ide ${authorName}`, emoji: "💡", isCustom: true };
        };

        const d1 = getDisplay(p1, p1Name);
        const d2 = getDisplay(p2, p2Name);

        diffPlans.push({
          item,
          p1Text: d1.text,
          p1Emoji: d1.emoji,
          p2Text: d2.text,
          p2Emoji: d2.emoji,
          p1IsCustom: d1.isCustom,
          p2IsCustom: d2.isCustom,
        });
      }
    }
  });

  const total = items.length;
  const score = totalAnswered > 0 ? Math.round((matchedCount / totalAnswered) * 100) : 100;

  let type = {
    badge: "Satu Frekuensi 💖",
    title: "Duo Sehati Sejiwa",
    description:
      "Gila sih! Selera kencan kalian hampir 100% klop. Pas nanti ketemu offline, dijamin gak bakal ada drama bingung mau ke mana karena semua selera kalian nyambung!",
    highlight: "Kalian bakal punya reunion date yang super lancar dan harmonis!",
  };

  if (score < 40) {
    type = {
      badge: "Saling Melengkapi 🧩",
      title: "Duo Eksplorasi Seru",
      description:
        "Beda pilihan justru bikin petualangan kalian makin kaya! Yang satu suka santai, yang satu suka ramai. Kuncinya gantian nyobain dunia masing-masing!",
      highlight: "Rencana kencan kalian jadi dobel seru karena banyak hal baru untuk dicoba!",
    };
  } else if (score < 70) {
    type = {
      badge: "Fleksibel Asik ✨",
      title: "Duo Petualang Kompak",
      description:
        "Kalian punya banyak kesamaan yang bikin nyaman, tapi tetap punya selera unik yang bikin agenda kencan kalian gak ngebosenin sama sekali!",
      highlight: "Kencan santai jalan, eksplorasi hal seru juga tetap gaspol!",
    };
  }

  return {
    score,
    matchedCount,
    totalAnswered,
    skippedCount,
    total,
    matchedPlans,
    diffPlans,
    customIdeas,
    skippedPlans,
    type,
  };
}
