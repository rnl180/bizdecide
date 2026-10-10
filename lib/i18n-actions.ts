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
  approve: "Approve",
  what: {
    one_off: "We draft the refund request. Nothing is sent without you.",
    monthly: "We draft the supplier email. Nothing is sent without you.",
    financing: "We fill in the application. Nothing is sent without you.",
  } as Record<ImpactKind, string>,
  writeIn: "Write it in",
  langName: { en: "English", ms: "Bahasa Melayu" } as Record<Lang, string>,
  connError: "Couldn't reach BizDecide. Check your connection and try again.",
  startError: "Couldn't start this. Please try again.",

  // live: queued is shown as a title and a second line, and read out as one sentence
  queued: ["Sent to your CFO team.", "Waiting for an agent…"] as [string, string],
  queuedSlow: "Still waiting. The result will appear here.",
  working: "Your CFO agent is on it",
  writingIn: { en: "Writing in English", ms: "Writing in Bahasa Melayu" } as Record<Lang, string>,
  dur: duration("h"),

  // done
  done: (time: string) => `Prepared in ${time}`,
  doneNoTime: "Prepared",
  outcome: {
    title: "Track the outcome", status: "Status", prepared: "Prepared", sent: "Sent / submitted", recorded: "Result recorded",
    edit: "Update outcome", save: "Confirm & save", cancel: "Cancel",
    amount: { one_off: "Total received (RM)", monthly: "Total saved so far (RM)", financing: "Funding received (RM)" },
    note: "What happened? Include the date or period.",
    provenance: "Reported by you · not checked against bank records",
    confirmation: "Confirm only what has actually happened. Enter the total so far, not an additional amount.",
    error: "Couldn't save the outcome. Try again.", conflict: "This outcome changed in another window. Reload the brief before saving again.",
  },
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
  found: ["Potential financial benefit: ", " for "] as [string, string],
  foundFunding: ["Potential funding: ", " for "] as [string, string],
  // [bold part, rest]
  partOneOff: (x: string): [string, string] => [x, " in potential recoveries to confirm"],
  partMonthly: (perMonth: string, perYear: string): [string, string] => [`${perMonth}/month`, ` (${perYear}/year) in projected savings`],
  partFinancing: (x: string): [string, string] => [x, " proposed funding, subject to eligibility and approval"],
};
export type ActStrings = typeof en;

const ms: ActStrings = {
  approve: "Lulus",
  what: {
    one_off: "Kami sediakan draf tuntutan. Tiada apa dihantar tanpa anda.",
    monthly: "Kami sediakan draf emel pembekal. Tiada apa dihantar tanpa anda.",
    financing: "Kami isi permohonan. Tiada apa dihantar tanpa anda.",
  },
  writeIn: "Tulis dalam",
  langName: { en: "Inggeris", ms: "Bahasa Melayu" },
  connError: "Tidak dapat menghubungi BizDecide. Semak sambungan anda dan cuba lagi.",
  startError: "Tidak dapat dimulakan. Sila cuba lagi.",

  queued: ["Dihantar kepada pasukan CFO anda.", "Menunggu ejen…"],
  queuedSlow: "Masih menunggu. Hasilnya akan muncul di sini.",
  working: "Ejen CFO anda sedang membuatnya",
  writingIn: { en: "Menulis dalam bahasa Inggeris", ms: "Menulis dalam Bahasa Melayu" },
  dur: duration("j"),

  done: (time) => `Disediakan dalam ${time}`,
  doneNoTime: "Disediakan",
  outcome: {
    title: "Jejak hasil", status: "Status", prepared: "Disediakan", sent: "Dihantar / dikemukakan", recorded: "Hasil direkodkan",
    edit: "Kemas kini hasil", save: "Sahkan & simpan", cancel: "Batal",
    amount: { one_off: "Jumlah diterima (RM)", monthly: "Jumlah dijimatkan setakat ini (RM)", financing: "Pembiayaan diterima (RM)" },
    note: "Apa yang berlaku? Nyatakan tarikh atau tempoh.",
    provenance: "Dilaporkan oleh anda · belum disemak dengan rekod bank",
    confirmation: "Sahkan hanya perkara yang sudah berlaku. Masukkan jumlah setakat ini, bukan amaun tambahan.",
    error: "Hasil tidak dapat disimpan. Cuba lagi.", conflict: "Hasil ini berubah dalam tetingkap lain. Muat semula laporan sebelum menyimpan lagi.",
  },
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

  found: ["Potensi manfaat kewangan: ", " untuk "],
  foundFunding: ["Potensi pembiayaan: ", " untuk "],
  partOneOff: (x) => [x, " potensi tuntutan untuk disahkan"],
  partMonthly: (perMonth, perYear) => [`${perMonth}/bulan`, ` (${perYear}/tahun) anggaran penjimatan`],
  partFinancing: (x) => [x, " cadangan pembiayaan, tertakluk pada kelayakan dan kelulusan"],
};

export const ACT: Record<Lang, ActStrings> = { en, ms };
