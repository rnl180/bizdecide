// Records one finished run as the replay fixture (docs/demo-run.fixture.json) for BIZDECIDE_REPLAY=1 and seed-demo-run.mjs.
// Usage (local store, after a good run of the demo café):
//   node scripts/capture-demo-run.mjs                      # latest completed request in .data/db.json
//   node scripts/capture-demo-run.mjs <requestId> [--source "what produced this run"]
// Keeps the run's progress with times relative to the moment it was picked up, its owner questions and answers,
// the final brief, the lane outputs and any answered "Ask your CFO" messages.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const source = flag("--source");
const wanted = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--source");
const OUT = "docs/demo-run.fixture.json";

if (!existsSync(".data/db.json")) {
  console.error("No .data/db.json. Run the demo café with BIZDECIDE_STORE=local first.");
  process.exit(1);
}
const db = JSON.parse(readFileSync(".data/db.json", "utf8"));
const done = Object.entries(db.requests ?? {})
  .filter(([id, r]) => r.status === "completed" && db.results?.[id] && (!wanted || id === wanted))
  .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
if (!done.length) {
  console.error(wanted ? `Request ${wanted} is not a completed request with a result.` : "No completed request with a result yet.");
  process.exit(1);
}
const [requestId, request] = done.at(-1);
const { createdAt: _c, ...result } = db.results[requestId];

// Times are relative to the claim; the replay writes its own claim and its own "brief delivered".
const progress = request.progress ?? [];
const start = progress.findIndex((p) => /^(Picked up by your CFO team|Restarted after an interruption)$/.test(p.step));
const t0 = Date.parse(progress[Math.max(start, 0)]?.at ?? request.createdAt);
const questions = Object.values(db.questions ?? {})
  .filter((q) => q.requestId === requestId)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map(({ question, context, options, allowOther, defaultOption, answer, otherText }) => ({ question, context, options, allowOther, defaultOption, answer, otherText }));
let asked = -1;
const entries = progress
  .slice(start + 1)
  .filter((p) => p.step !== "CFO brief delivered")
  .map(({ at, ...p }) => {
    const e = { offsetMs: Math.max(0, Date.parse(at) - t0), ...p };
    if (p.step === "Waiting for your answer") e.question = ++asked;
    else if (/^(Answer received|No answer yet, continuing)$/.test(p.step) && asked >= 0) e.answerOf = asked;
    return e;
  });
if (asked + 1 !== questions.length) console.warn(`Warning: ${asked + 1} waiting steps but ${questions.length} questions.`);

let laneOutputs;
try {
  laneOutputs = JSON.parse(db.lane_outputs?.[requestId]?.json ?? "null") ?? undefined;
} catch {
  laneOutputs = undefined;
}
const messages = Object.values(db.messages ?? {})
  .filter((m) => m.requestId === requestId && m.status === "answered")
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map(({ question, answer, evidence }) => ({ question, answer, ...(evidence?.length ? { evidence } : {}) }));

const fixture = {
  about: "Recorded BizDecide run replayed by BIZDECIDE_REPLAY=1 (lib/replay.ts) and seeded by scripts/seed-demo-run.mjs. Re-record with scripts/capture-demo-run.mjs.",
  source: source ?? "A completed run in the local store",
  capturedAt: new Date().toISOString(),
  requestId,
  businessName: request.businessName,
  service: request.service,
  language: request.language,
  durationMs: entries.at(-1)?.offsetMs ?? 0,
  progress: entries,
  questions,
  result,
  laneOutputs,
  messages,
};
writeFileSync(OUT, JSON.stringify(fixture, null, 1) + "\n");
console.log(`Wrote ${OUT}: request ${requestId} (${request.businessName}), ${entries.length} progress steps over ${Math.round(fixture.durationMs / 1000)}s, ${questions.length} questions, ${messages.length} chat answers.`);
