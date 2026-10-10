import { useEffect, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

/**
 * Kancil, the mascot in the corner (components/Kancil.tsx). Pages say what is happening with useKancil(mood);
 * the mascot shows it. One mood at a time: the last page or component to set one wins, and unmounting clears it.
 */

export type KancilMood = "wave" | "peek" | "catch" | "read" | "dig" | "cheer" | "worried";

let current: KancilMood | null = null;
const listeners = new Set<() => void>();

function setMood(mood: KancilMood | null) {
  if (current === mood) return;
  current = mood;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
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

/** What Kancil says. Short on purpose: it is a speech bubble, and pages already say the real status. */
export const KANCIL_LINES: Record<
  Lang,
  { hello: string; catch: string; read: string; dig: string[]; peek: string; cheer: string; worried: string; poke: string[]; hide: string }
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
  },
};
