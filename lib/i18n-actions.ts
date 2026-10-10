import type { Lang } from "./i18n";
import type { ImpactKind } from "./impact";

/**
 * Copy for "Approve → it's done" (components/DecisionAction.tsx), the "found" headline on the brief
 * and the printable action page (app/r/[id]/a/[actionId]), in English and Bahasa Melayu.
 */

/** "42s", "3m 05s", "1h 04m": `h` is the hour letter (j for jam in Bahasa Melayu). */
const duration = (h: string) => (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}${h} ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
};

const en = {
  // approve
  approve: "Approve — let your CFO team do it",
  what: {
    one_off: "Your CFO agent writes the request to get this money back, ready to send from your Gmail. Nothing is sent without you.",
    monthly: "Your CFO agent writes to the supplier and asks alternatives for quotes, ready to send from your Gmail. Nothing is sent without you.",
    financing: "Your CFO agent fills in the application pack and drafts the cover email to the agency. Nothing is sent without you.",
  } as Record<ImpactKind, string>,
  writeIn: "Write it in",
  langName: { en: "English", ms: "Bahasa Melayu" } as Record<Lang, string>,
  connError: "Couldn't reach BizDecide. Check your connection and try again.",
  startError: "Couldn't start this. Please try again.",

  // live: queued is shown as a title and a second line, and read out as one sentence
  queued: ["Sent to your CFO team.", "Waiting for an agent…"] as [string, string],
  queuedSlow: "Still waiting for a free agent. The result will appear here, even if you leave and come back.",
  working: "Your CFO agent is on it",
  writingIn: { en: "Writing in English", ms: "Writing in Bahasa Melayu" } as Record<Lang, string>,
  dur: duration("h"),

  // done
  done: (time: string) => `Done in ${time}`,
  doneNoTime: "Done",
  savedGmail: "Saved in your Gmail drafts",
  readyToSend: "Ready to send from your email",
  to: "To",
  cc: "Cc",
  subject: "Subject",
  showAll: "Show all",
  showLess: "Show less",
  openDrafts: "Open Gmail drafts",
  openGmail: "Open in Gmail",
  copy: "Copy",
  copied: "Copied",
  viewPrint: "View & print",
  sections: (n: number) => `${n} section${n === 1 ? "" : "s"}`,

  // failed
  failed: "Couldn't finish this one",
  retry: "Try again",

  // printable page
  savePdf: "Save as PDF",
  back: "Back to your brief",
  preparedBy: "Prepared by your BizDecide CFO team",
  loading: "Loading…",
  notFound: "We couldn't find this document.",
  dateLocale: "en-MY",

  // "BizDecide found RM1,626 for Rock Cafe": [before amount, between amount and business name]
  found: ["BizDecide found ", " for "] as [string, string],
  foundFunding: ["BizDecide found ", " of funding for "] as [string, string],
  // [bold part, rest]
  partOneOff: (x: string): [string, string] => [x, " to recover now"],
  partMonthly: (perMonth: string, perYear: string): [string, string] => [`${perMonth}/month`, ` (${perYear}/year) to save`],
  partFinancing: (x: string): [string, string] => [x, " funding you qualify for"],
};
export type ActStrings = typeof en;

const ms: ActStrings = {
  approve: "Lulus — biar pasukan CFO anda buat",
  what: {
    one_off:
      "Ejen CFO anda menulis permintaan untuk mendapatkan semula duit ini, sedia untuk dihantar dari Gmail anda. Tiada apa dihantar tanpa anda.",
    monthly:
      "Ejen CFO anda menulis kepada pembekal dan meminta sebut harga daripada pembekal lain, sedia untuk dihantar dari Gmail anda. Tiada apa dihantar tanpa anda.",
    financing: "Ejen CFO anda mengisi pek permohonan dan menyediakan emel iringan kepada agensi. Tiada apa dihantar tanpa anda.",
  },
  writeIn: "Tulis dalam",
  langName: { en: "Inggeris", ms: "Bahasa Melayu" },
  connError: "Tidak dapat menghubungi BizDecide. Semak sambungan anda dan cuba lagi.",
  startError: "Tidak dapat dimulakan. Sila cuba lagi.",

  queued: ["Dihantar kepada pasukan CFO anda.", "Menunggu ejen…"],
  queuedSlow: "Masih menunggu ejen yang lapang. Hasilnya akan muncul di sini, walaupun anda keluar dan kembali semula.",
  working: "Ejen CFO anda sedang membuatnya",
  writingIn: { en: "Menulis dalam bahasa Inggeris", ms: "Menulis dalam Bahasa Melayu" },
  dur: duration("j"),

  done: (time) => `Siap dalam ${time}`,
  doneNoTime: "Siap",
  savedGmail: "Disimpan dalam draf Gmail anda",
  readyToSend: "Sedia untuk dihantar dari emel anda",
  to: "Kepada",
  cc: "Cc",
  subject: "Subjek",
  showAll: "Tunjuk semua",
  showLess: "Kurangkan",
  openDrafts: "Buka draf Gmail",
  openGmail: "Buka dalam Gmail",
  copy: "Salin",
  copied: "Disalin",
  viewPrint: "Lihat & cetak",
  sections: (n) => `${n} bahagian`,

  failed: "Tidak dapat disiapkan",
  retry: "Cuba lagi",

  savePdf: "Simpan sebagai PDF",
  back: "Kembali ke laporan anda",
  preparedBy: "Disediakan oleh pasukan CFO BizDecide anda",
  loading: "Memuatkan…",
  notFound: "Dokumen ini tidak ditemui.",
  dateLocale: "ms-MY",

  found: ["BizDecide jumpa ", " untuk "],
  foundFunding: ["BizDecide jumpa pembiayaan ", " untuk "],
  partOneOff: (x) => [x, " boleh dituntut sekarang"],
  partMonthly: (perMonth, perYear) => [`${perMonth}/bulan`, ` (${perYear}/tahun) boleh dijimat`],
  partFinancing: (x) => [x, " pembiayaan yang anda layak"],
};

export const ACT: Record<Lang, ActStrings> = { en, ms };
