import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { getRequest, getVote, isPollCode, tallyByQuestion } from "./store";
import type { QuestionDoc } from "./types";

/**
 * The audience poll on an owner question (/p/<code>): no login, one vote per browser (cookie) per question.
 * The public view never carries the request or question id, so a voter can't reach the brief or answer for the owner.
 */

const COOKIE = "bd_voter";
const COOKIE_MAX_AGE = 30 * 24 * 3600;

/** The browser's voter id from its cookie, or a new one (set it on the response with setVoterCookie). */
export function voterCookie(req: Request): { id: string; fresh: boolean } {
  const m = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)bd_voter=([a-f0-9]{32})(?:;|$)/);
  return m ? { id: m[1]!, fresh: false } : { id: randomBytes(16).toString("hex"), fresh: true };
}

export function setVoterCookie(res: NextResponse, req: Request, id: string) {
  res.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** What the store keeps: a hash per question, so votes can't be linked across questions or back to the cookie. */
export const voterHash = (cookieId: string, questionId: string) => createHash("sha256").update(`${cookieId}:${questionId}`).digest("hex").slice(0, 32);

export const normalizeCode = (raw: string) => {
  const code = raw.trim().toUpperCase();
  return isPollCode(code) ? code : null;
};

export interface PollView {
  code: string;
  status: QuestionDoc["status"];
  question: string;
  context?: string;
  options: string[];
  tally: Record<string, number>;
  total: number;
  myVote: string | null;
  answer: string | null; // what the owner (or presenter) chose, once closed
  lang: "en" | "ms";
}

export async function pollView(q: QuestionDoc, voter: string | null): Promise<PollView> {
  const [tally, mine, request] = await Promise.all([
    tallyByQuestion(q.id),
    voter ? getVote(q.id, voterHash(voter, q.id)) : Promise.resolve(null),
    getRequest(q.requestId),
  ]);
  const counts = Object.fromEntries(q.options.map((o) => [o, tally[o] ?? 0]));
  return {
    code: q.pollCode!,
    status: q.status,
    question: q.question,
    context: q.context,
    options: q.options,
    tally: counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    myVote: mine?.option ?? null,
    answer: q.status === "answered" ? (q.answer === "__other__" ? (q.otherText ?? null) : (q.answer ?? null)) : null,
    lang: request?.language === "ms" ? "ms" : "en",
  };
}
