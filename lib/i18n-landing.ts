import type { Lang } from "@/lib/i18n";

/** Landing page copy (hero, "found" card and how it works) in English and Bahasa Melayu. Kept short on purpose. */

export type Priority = "urgent" | "important" | "opportunity";

export type LandingStrings = {
  langLabel: string;
  hero: {
    eyebrow: string;
    h1: [string, string];
    lede: string;
    ctaFiles: string;
    ctaDemo: string;
    trust: string[];
  };
  /** The sample brief shown beside the headline. Amounts are display strings; the first one counts up. */
  card: {
    cafe: string;
    place: string;
    badge: string;
    found: string;
    foundLabel: string;
    saved: string;
    savedLabel: string;
    rows: { priority: Priority; tag: string; title: string; amount: string; status: string; done?: boolean }[];
  };
  how: { kicker: string; title: string; steps: { title: string; body: string }[]; running: string };
};

const en: LandingStrings = {
  langLabel: "Language",
  hero: {
    eyebrow: "AI CFO for Malaysian SMEs",
    h1: ["Upload documents.", "We find you money."],
    lede: "Your sales, invoices and bank statements hide money: double payments, supplier overcharges and funding you qualify for. We find it and help you get it.",
    ctaFiles: "Upload documents",
    ctaDemo: "Try a sample",
    trust: ["No login", "Proof for every ringgit", "Nothing sent without your OK"],
  },
  card: {
    cafe: "Rock Cafe",
    place: "Petaling Jaya",
    badge: "Sample brief",
    found: "RM954.40",
    foundLabel: "to recover",
    saved: "+RM985/yr",
    savedLabel: "overcharge stopped",
    rows: [
      { priority: "urgent", tag: "Urgent", title: "Invoice paid twice", amount: "RM642", status: "Refund drafted", done: true },
      { priority: "urgent", tag: "Urgent", title: "DuitNow payout missing", amount: "RM312.40", status: "Bank query ready" },
      { priority: "important", tag: "Important", title: "Kopi O powder up 12%", amount: "RM985/yr", status: "Ask for quotes" },
      { priority: "opportunity", tag: "Opportunity", title: "TEKUN loan fits your plan", amount: "", status: "Pack ready" },
    ],
  },
  how: {
    kicker: "How it works",
    title: "Documents in. Money out.",
    steps: [
      { title: "Upload your documents", body: "Sales, invoices, bank statements." },
      { title: "We find the money", body: "Double payments, overcharges, funding." },
      { title: "You get it", body: "We write the email. You approve." },
    ],
    running: "Also runs as Tencent WorkBuddy skills",
  },
};

const ms: LandingStrings = {
  langLabel: "Bahasa",
  hero: {
    eyebrow: "CFO AI untuk PKS Malaysia",
    h1: ["Muat naik dokumen.", "Kami cari duit untuk anda."],
    lede: "Jualan, invois dan penyata bank anda menyembunyikan duit: bayaran berganda, caj lebih pembekal dan pembiayaan yang anda layak. Kami cari dan bantu anda dapatkannya.",
    ctaFiles: "Muat naik dokumen",
    ctaDemo: "Cuba contoh",
    trust: ["Tiada log masuk", "Bukti untuk setiap ringgit", "Tiada dihantar tanpa kelulusan anda"],
  },
  card: {
    cafe: "Rock Cafe",
    place: "Petaling Jaya",
    badge: "Contoh laporan",
    found: "RM954.40",
    foundLabel: "boleh dituntut",
    saved: "+RM985/thn",
    savedLabel: "caj lebih dihentikan",
    rows: [
      { priority: "urgent", tag: "Segera", title: "Invois dibayar dua kali", amount: "RM642", status: "Emel tuntutan sedia", done: true },
      { priority: "urgent", tag: "Segera", title: "Bayaran DuitNow tidak masuk", amount: "RM312.40", status: "Pertanyaan bank sedia" },
      { priority: "important", tag: "Penting", title: "Serbuk Kopi O naik 12%", amount: "RM985/thn", status: "Minta sebut harga" },
      { priority: "opportunity", tag: "Peluang", title: "TEKUN sesuai untuk pelan anda", amount: "", status: "Pek sedia" },
    ],
  },
  how: {
    kicker: "Cara ia berfungsi",
    title: "Dokumen masuk. Duit keluar.",
    steps: [
      { title: "Muat naik dokumen", body: "Jualan, invois, penyata bank." },
      { title: "Kami cari duit", body: "Bayaran berganda, caj lebih, pembiayaan." },
      { title: "Anda dapatkannya", body: "Kami tulis emel. Anda luluskan." },
    ],
    running: "Juga berjalan sebagai kemahiran Tencent WorkBuddy",
  },
};

export const LANDING: Record<Lang, LandingStrings> = { en, ms };
