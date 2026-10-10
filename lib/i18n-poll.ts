import type { Lang } from "./i18n";

/** Audience poll page (/p/[code]) copy, English and Bahasa Melayu. */
const en = {
  kicker: "Live question from the owner's AI CFO",
  pick: "Tap your answer. One vote per phone.",
  sending: "Sending…",
  thanks: "Thanks, your vote is in.",
  yourVote: (option: string) => `Your vote: ${option}`,
  votes: (n: number) => `${n} vote${n === 1 ? "" : "s"}`,
  closed: "Voting has closed.",
  answered: (answer: string) => `The answer used: ${answer}`,
  expired: "No answer came in time, so the CFO went on with its default.",
  loading: "Loading the question…",
  notFound: "This poll doesn't exist. Check the code on the screen.",
  offline: "Can't reach BizDecide. Retrying…",
  already: "This phone has already voted.",
  sendErr: "Your vote didn't go through. Try again.",
  live: "Live tally",
  language: "Bahasa Melayu",
};

export type PollStrings = typeof en;

const ms: PollStrings = {
  kicker: "Soalan langsung daripada CFO AI pemilik",
  pick: "Tekan jawapan anda. Satu undi bagi setiap telefon.",
  sending: "Menghantar…",
  thanks: "Terima kasih, undi anda diterima.",
  yourVote: (option) => `Undi anda: ${option}`,
  votes: (n) => `${n} undi`,
  closed: "Undian telah ditutup.",
  answered: (answer) => `Jawapan yang digunakan: ${answer}`,
  expired: "Tiada jawapan dalam masa, jadi CFO meneruskan dengan pilihan asal.",
  loading: "Memuatkan soalan…",
  notFound: "Undian ini tidak wujud. Semak kod di skrin.",
  offline: "Tidak dapat menghubungi BizDecide. Mencuba semula…",
  already: "Telefon ini sudah mengundi.",
  sendErr: "Undi anda tidak dihantar. Cuba lagi.",
  live: "Kiraan langsung",
  language: "English",
};

export const POLL: Record<Lang, PollStrings> = { en, ms };
