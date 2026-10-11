import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";
import type { CsvKind } from "@/lib/csv";

/**
 * Kancil, the mascot in the corner (components/Kancil.tsx). Two channels:
 * - mood: pages say what is happening with useKancil(mood); one at a time, the last to set it wins, unmounting clears it.
 * - tips: pages queue coach tips with useKancilTip / kancilTip; Kancil runs to each tip's target, says it, and runs back.
 */

export type KancilMood = "wave" | "peek" | "catch" | "read" | "dig" | "cheer" | "worried";

/** A coach tip: Kancil runs to `target` (a CSS selector) and says `text`, or says it from his corner when there is none. */
export type KancilTip = {
  id: string;
  text: string;
  target?: string;
  /** Where he stands: beside the target (left or right), or inside it at the bottom right. */
  place?: "left" | "right" | "inside";
  pose?: KancilMood;
  ms?: number;
  /** Tips in a group are skipped together (the tour). */
  group?: string;
  /** Shown once in this browser, not just once per page. */
  once?: boolean;
  /** Drop the tip when its target is not on screen (the tour); otherwise Kancil says it from his corner. */
  skipUnseen?: boolean;
};

let current: KancilMood | null = null;
let tips: KancilTip[] = [];
const NO_TIPS: KancilTip[] = [];
const shown = new Set<string>(); // tips already on screen during this page view
const listeners = new Set<() => void>();
const SEEN_KEY = "bizdecide:kancil-seen";

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function seenEver(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function setMood(mood: KancilMood | null) {
  if (current === mood) return;
  current = mood;
  emit();
}

/** Shows `mood` while the calling component is mounted; null hands the mascot back to its own idle behaviour. */
export function useKancil(mood: KancilMood | null) {
  useEffect(() => {
    setMood(mood);
    return () => setMood(null);
  }, [mood]);
}

/** The mood pages last set (read by the mascot). */
export function useKancilMood() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Queues a tip, unless it is already queued, was shown during this page view, or is a `once` tip seen before. */
export function kancilTip(tip: KancilTip) {
  if (shown.has(tip.id) || tips.some((t) => t.id === tip.id)) return;
  if (tip.once && seenEver().includes(tip.id)) return;
  tips = [...tips, tip];
  emit();
}

/** Takes a tip off the queue: shown, skipped, or no longer true. With `group`, the rest of its group goes too. */
export function kancilTipDone(id: string, { group = false } = {}) {
  const tip = tips.find((t) => t.id === id);
  if (!tip) return;
  tips = tips.filter((t) => t !== tip && !(group && tip.group && t.group === tip.group));
  emit();
}

/** Called by the mascot when a tip goes on screen, so it is not repeated. */
export function kancilTipShown(tip: KancilTip) {
  shown.add(tip.id);
  if (!tip.once) return;
  try {
    const seen = seenEver();
    if (!seen.includes(tip.id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, tip.id]));
  } catch {}
}

/** The tip queue, oldest first (read by the mascot). */
export function useKancilTips() {
  return useSyncExternalStore(subscribe, () => tips, () => NO_TIPS);
}

/** Queues `tip` while it is set. When it changes or turns null the old one is dropped, even mid-way, since it no longer applies. */
export function useKancilTip(tip: KancilTip | null) {
  const id = tip?.id ?? null;
  const latest = useRef(tip);
  latest.current = tip;
  useEffect(() => {
    if (!id || !latest.current) return;
    kancilTip(latest.current);
    return () => kancilTipDone(id);
  }, [id]);
}

/** What Kancil says. Short on purpose: it is a speech bubble, and pages already say the real status. */
export const KANCIL_LINES: Record<
  Lang,
  {
    hello: string;
    catch: string;
    read: string;
    dig: string[];
    peek: string;
    cheer: string;
    worried: string;
    poke: string[];
    hide: string;
    skip: string;
    tour: [string, string, string];
    coach: {
      drop: string;
      demo: string;
      name: string;
      missing: Partial<Record<CsvKind, string>>;
      consent: string;
      found: (amount: string, total: string) => string;
      soFar: (total: string) => string;
      done: (total: string, name: string) => string;
      doneFunding: (total: string) => string;
      doneReady: string;
    };
  }
> = {
  en: {
    hello: "Hi! I'm Kancil. Send me your receipts.",
    catch: "Drop it! I'll catch it.",
    read: "Reading your files…",
    dig: ["Checking receipts…", "Hunting for savings…", "Matching invoices…", "Counting every ringgit…"],
    peek: "Quick question for you!",
    cheer: "Found money!",
    worried: "Alamak. Something went wrong.",
    poke: ["Proof for every ringgit!", "Nothing goes out without your OK.", "Hehe, that tickles.", "Got more invoices for me?"],
    hide: "Hide Kancil",
    skip: "Skip tour",
    tour: [
      "Start here. Upload your sales, invoices and bank statements.",
      "You get a brief like this: money to get back, with proof for every ringgit.",
      "No files handy? Try a sample first.",
    ],
    coach: {
      drop: "Drop your files here. Sales, invoices, bank statements. Photos of receipts work too.",
      demo: "Sample loaded: a coffee shop in Petaling Jaya. Press Send and watch me dig.",
      name: "What's your shop called? I need a name for the brief.",
      missing: {
        sales: "Add your sales. A POS export works, and I'll check every day's takings.",
        purchases: "Add supplier invoices and I can spot overcharges and double payments.",
        bank: "Add a bank statement and I can check your DuitNow and card payouts.",
        suppliers: "Add your supplier list so I know who to write to.",
      },
      consent: "All set! Tick this box, then press Send.",
      found: (amount, total) => (amount === total ? `Found ${amount}!` : `Found ${amount}! That's ${total} so far.`),
      soFar: (total) => `${total} found so far. Still digging…`,
      done: (total, name) => `Done! I found ${total} for ${name}.`,
      doneFunding: (total) => `Done! You could get ${total} in funding.`,
      doneReady: "Done! Your brief is ready.",
    },
  },
  ms: {
    hello: "Hai! Saya Kancil. Hantar resit anda.",
    catch: "Lepaskan! Saya sambut.",
    read: "Membaca fail anda…",
    dig: ["Menyemak resit…", "Mencari penjimatan…", "Memadankan invois…", "Mengira setiap ringgit…"],
    peek: "Soalan ringkas untuk anda!",
    cheer: "Jumpa duit!",
    worried: "Alamak. Ada masalah.",
    poke: ["Bukti untuk setiap ringgit!", "Tiada dihantar tanpa kelulusan anda.", "Hehe, gelilah.", "Ada invois lagi?"],
    hide: "Sembunyikan Kancil",
    skip: "Langkau",
    tour: [
      "Mula di sini. Muat naik jualan, invois dan penyata bank anda.",
      "Anda dapat laporan begini: duit untuk dituntut, dengan bukti setiap ringgit.",
      "Tiada fail? Cuba contoh dahulu.",
    ],
    coach: {
      drop: "Lepaskan fail di sini. Jualan, invois, penyata bank. Gambar resit pun boleh.",
      demo: "Contoh dimuatkan: kedai kopi di Petaling Jaya. Tekan Hantar dan lihat saya menggali.",
      name: "Apa nama kedai anda? Saya perlukan nama untuk laporan.",
      missing: {
        sales: "Tambah jualan anda. Eksport POS pun boleh, saya semak jualan setiap hari.",
        purchases: "Tambah invois pembekal, saya boleh kesan caj lebih dan bayaran berganda.",
        bank: "Tambah penyata bank, saya boleh semak bayaran DuitNow dan kad anda.",
        suppliers: "Tambah senarai pembekal supaya saya tahu siapa untuk dihubungi.",
      },
      consent: "Semua sedia! Tandakan kotak ini, kemudian tekan Hantar.",
      found: (amount, total) => (amount === total ? `Jumpa ${amount}!` : `Jumpa ${amount}! Jumlah setakat ini ${total}.`),
      soFar: (total) => `${total} dijumpai setakat ini. Masih menggali…`,
      done: (total, name) => `Siap! Saya jumpa ${total} untuk ${name}.`,
      doneFunding: (total) => `Siap! Anda boleh dapat pembiayaan ${total}.`,
      doneReady: "Siap! Laporan anda sedia.",
    },
  },
};
