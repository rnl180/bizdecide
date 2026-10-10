import { readFile } from "node:fs/promises";
import path from "node:path";
import { createQuestion, expireQuestion, getQuestion, saveLaneOutputs, saveResult, sleep, updateRequest } from "./store";
import type { Evidence, ProgressEntry, QuestionDoc, RequestDoc, Result } from "./types";

/**
 * Cached replay of one recorded run (BIZDECIDE_REPLAY=1): the stage fallback when the network or the API stalls.
 * docs/demo-run.fixture.json (written by scripts/capture-demo-run.mjs) holds the run's progress with relative times,
 * its owner questions, the final brief and the lane outputs. Replay writes the same progress with the same delays,
 * asks the same questions live (so the audience poll still works) and delivers the same brief, so the numbers are
 * identical every time. Needs no API key.
 */

export const replayEnabled = () => process.env.BIZDECIDE_REPLAY === "1";

const FIXTURE = path.join(process.cwd(), "docs", "demo-run.fixture.json");
const GAP_CAP_MS = 25_000; // no lane sits silent longer than this on stage

type FixtureEntry = Omit<ProgressEntry, "at"> & { offsetMs: number; question?: number; answerOf?: number };
type FixtureQuestion = Pick<QuestionDoc, "question" | "context" | "options" | "allowOther" | "defaultOption" | "answer" | "otherText">;
export interface ReplayFixture {
  source?: string;
  businessName: string;
  language?: "en" | "ms";
  progress: FixtureEntry[];
  questions: FixtureQuestion[];
  result: Result;
  laneOutputs?: Record<string, unknown>;
  messages?: { question: string; answer: string; evidence?: Evidence[] }[];
}

let cached: Promise<ReplayFixture | null> | undefined;
export function loadFixture(): Promise<ReplayFixture | null> {
  cached ??= readFile(FIXTURE, "utf8").then(
    (t) => JSON.parse(t) as ReplayFixture,
    () => null,
  );
  return cached;
}

/** Replays the fixture onto a claimed request. askWaitMs: how long each question stays open for the owner and the room. */
export async function replayRun(requestId: string, r: RequestDoc, fx: ReplayFixture, askWaitMs: number) {
  const speed = Number(process.env.BIZDECIDE_REPLAY_SPEED) > 0 ? Number(process.env.BIZDECIDE_REPLAY_SPEED) : 1;
  const wait = (ms: number) => sleep(Math.min(Math.max(ms, 0), GAP_CAP_MS) / speed);
  console.log(`[replay] request ${requestId} (${r.businessName}) from ${fx.source ?? "the recorded run"}`);
  let prev = 0;
  for (const e of fx.progress) {
    const { offsetMs, question, answerOf, ...entry } = e;
    if (answerOf !== undefined) {
      prev = offsetMs; // the live answer below replaces the recorded one
      continue;
    }
    await wait(offsetMs - prev);
    prev = offsetMs;
    if (question === undefined) {
      await updateRequest(requestId, { progress: entry });
      continue;
    }
    const q = fx.questions[question];
    if (!q) continue;
    const questionId = await createQuestion({ requestId, question: q.question, context: q.context, options: q.options, allowOther: q.allowOther ?? true, defaultOption: q.defaultOption });
    await updateRequest(requestId, { status: "waiting_for_user", progress: { step: "Waiting for your answer", detail: q.question } });
    const answered = await waitForAnswer(questionId, askWaitMs);
    if (answered) {
      await updateRequest(requestId, { status: "processing", progress: { step: "Answer received", detail: answered.otherText || answered.answer } });
    } else {
      await expireQuestion(questionId);
      await updateRequest(requestId, { status: "processing", progress: { step: "No answer yet, continuing", detail: `Assumed: ${q.defaultOption}` } });
    }
  }
  if (fx.laneOutputs) await saveLaneOutputs(requestId, fx.laneOutputs).catch((e) => console.error(`[replay] lane outputs ${requestId}`, e));
  await saveResult(requestId, fx.result);
  await updateRequest(requestId, { status: "completed", progress: { step: "CFO brief delivered", detail: fx.result.headline } });
}

async function waitForAnswer(questionId: string, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    await sleep(2000);
    const q = await getQuestion(questionId);
    if (q?.status === "answered") return q;
  }
  return null;
}

const NO_LIVE_ANSWER = {
  en: "This is a recorded demo run, so new questions need the live CFO. Try one of the suggested questions.",
  ms: "Ini ialah larian demo yang dirakam, jadi soalan baharu memerlukan CFO langsung. Cuba salah satu soalan cadangan.",
};

/** A follow-up answer from the fixture (matched on the question text), or a note that replay can't answer new ones. */
export function replayAnswer(fx: ReplayFixture | null, question: string, lang: "en" | "ms") {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const hit = fx?.messages?.find((m) => norm(m.question) === norm(question));
  return hit ? { answer: hit.answer, evidence: hit.evidence } : { answer: NO_LIVE_ANSWER[lang], evidence: undefined };
}
