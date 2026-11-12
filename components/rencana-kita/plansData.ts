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
    subtitle: "Momen nonton yang paling kalian pengen rasain berdua?",
    optionA: {
      id: "A",
      title: "Bioskop Midnight Movie",
      desc: "Popcorn jumbo, layar raksasa, pulang larut malam",
      emoji: "🍿",
      tag: "Exciting",
      color: "#FFE785",
    },
    optionB: {
      id: "B",
      title: "Netflix & Chill di Rumah",
      desc: "Pakai selimut hangat, pesan delivery, bisa pelukan",
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
      title: "Piknik Santai di Taman Bunga",
      desc: "Bawa bekal sandwich, dengar playlist berdua di bawah pohon",
      emoji: "🧺",
      tag: "Nature & Fresh",
      color: "#A7F3D0",
    },
    optionB: {
      id: "B",
      title: "Sunset-an di Tepi Pantai",
      desc: "Minum air kelapa, jalan telanjang kaki di pasir sore",
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
      desc: "Lihat instalasi seni interaktif, saling fotoin OOTD",
      emoji: "🎨",
      tag: "Artistic & Chill",
      color: "#FFAEC7",
    },
  },
  {
    id: 5,
    category: "Masak Sendiri",
    subtitle: "Tantangan masak makanan bareng di dapur impian?",
    optionA: {
      id: "A",
      title: "Bikin Pasta & Steak Sendiri",
      desc: "Belanja bahan di supermarket, masak pakai celemek couple",
      emoji: "🍳",
      tag: "Chef Couple",
      color: "#FED7AA",
    },
    optionB: {
      id: "B",
      title: "All-You-Can-Eat BBQ / Shabu",
      desc: "Panggang daging sepuasnya sambil saling suapin",
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
      desc: "Pakai jaket, helm couple, rasain angin malam sambil ngobrol",
      emoji: "🛵",
      tag: "City Vibes",
      color: "#BAE6FD",
    },
    optionB: {
      id: "B",
      title: "Jalan Santai & Beli Es Krim",
      desc: "City walk santai di trotoar sambil gandengan tangan erat",
      emoji: "🍦",
      tag: "Sweet & Slow",
      color: "#FDE68A",
    },
  },
  {
    id: 7,
    category: "Tempat Nginep",
    subtitle: "Tipe liburan nginep yang paling kalian impikan?",
    optionA: {
      id: "A",
      title: "Glamping Mewah di Gunung",
      desc: "Udara dingin berkabut, bikin marshmallow bakar di api unggun",
      emoji: "🏕️",
      tag: "Adventure Cozy",
      color: "#A7F3D0",
    },
    optionB: {
      id: "B",
      title: "Hotel Staycation Mewah",
      desc: "Rendam di bathtub berdua, sarapan di kasur empuk",
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
      desc: "CFD-an, jalan santai pagi, makan bubur ayam bareng",
      emoji: "🥣",
      tag: "Early Birds",
      color: "#FEF08A",
    },
    optionB: {
      id: "B",
      title: "Bangun Siang & Langsung Brunch",
      desc: "Tidur sepuasnya tanpa alarm, bangun pas matahari udah tinggi",
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
      desc: "Beli gantungan kunci couple, pernak-pernik lucu & buku",
      emoji: "📚",
      tag: "Cute Memories",
      color: "#BBF7D0",
    },
  },
  {
    id: 10,
    category: "Karya Bersama",
    subtitle: "Bikin barang kenang-kenangan yang bisa dibawa pulang?",
    optionA: {
      id: "A",
      title: "Workshop Pottery / Keramik",
      desc: "Putar tanah liat berdua ala film romantis, bikin cangkir couple",
      emoji: "🏺",
      tag: "Handmade Love",
      color: "#FED7AA",
    },
    optionB: {
      id: "B",
      title: "Bikin Cincin / DIY Silver Ring",
      desc: "Palu & ukir inisial nama kalian di cincin perak sendiri",
      emoji: "💍",
      tag: "Precious Memory",
      color: "#E2E8F0",
    },
  },
];

export interface CouplePlanResult {
  score: number;
  matchedCount: number;
  total: number;
  matchedPlans: Array<{
    item: DatePlanItem;
    chosen: DateOption;
  }>;
  diffPlans: Array<{
    item: DatePlanItem;
    p1Chosen: DateOption;
    p2Chosen: DateOption;
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
  answers: Record<number, { player1?: "A" | "B"; player2?: "A" | "B" }>
): CouplePlanResult {
  let matchedCount = 0;
  const matchedPlans: CouplePlanResult["matchedPlans"] = [];
  const diffPlans: CouplePlanResult["diffPlans"] = [];

  items.forEach((item) => {
    const ans = answers[item.id];
    if (ans?.player1 && ans?.player2) {
      if (ans.player1 === ans.player2) {
        matchedCount++;
        matchedPlans.push({
          item,
          chosen: ans.player1 === "A" ? item.optionA : item.optionB,
        });
      } else {
        diffPlans.push({
          item,
          p1Chosen: ans.player1 === "A" ? item.optionA : item.optionB,
          p2Chosen: ans.player2 === "A" ? item.optionA : item.optionB,
        });
      }
    }
  });

  const total = items.length;
  const score = total > 0 ? Math.round((matchedCount / total) * 100) : 0;

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
    total,
    matchedPlans,
    diffPlans,
    type,
  };
}
