// Seeds the local store with the recorded demo run, completed, so the brief page can be worked on without any API key.
// Usage: node scripts/seed-demo-run.mjs   (the brief is in the language the run was recorded in)
// Writes the demo café business, a completed request with the recorded progress, its answered questions, the brief and
// the lane outputs into .data/db.json (BIZDECIDE_STORE=local), then prints the /r/<id> link.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FIXTURE = "docs/demo-run.fixture.json";
const DEMO = "public/demo/kedai-kopi-aminah.json";
const DB = ".data/db.json";

if (!existsSync(FIXTURE)) {
  console.error(`No ${FIXTURE}. Record one with node scripts/capture-demo-run.mjs.`);
  process.exit(1);
}
const fx = JSON.parse(readFileSync(FIXTURE, "utf8"));
const demo = JSON.parse(readFileSync(DEMO, "utf8"));
const empty = { businesses: {}, requests: {}, questions: {}, results: {}, messages: {}, actions: {}, lane_outputs: {}, votes: {} };
const db = existsSync(DB) ? { ...empty, ...JSON.parse(readFileSync(DB, "utf8")) } : empty;

const id = () => randomBytes(10).toString("hex"); // same shape as the local store's ids
const POLL = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pollCode = () => Array.from(randomBytes(6), (b) => POLL[b % POLL.length]).join("");
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const end = now - 60_000; // delivered a minute ago
const t0 = end - (fx.durationMs ?? 0);

const businessId = id();
const { disclaimer: _d, ...data } = demo;
db.businesses[businessId] = {
  ...data,
  profile: { market: "MY", ...demo.profile, ...(fx.language ? { language: fx.language } : {}) },
  documents: [],
  createdAt: iso(t0 - 30_000),
  updatedAt: iso(t0 - 30_000),
};

const requestId = id();
db.requests[requestId] = {
  businessId,
  businessName: fx.businessName,
  service: fx.service ?? "cfo_brief",
  market: "MY",
  language: fx.language,
  status: "completed",
  createdAt: iso(t0 - 5_000),
  updatedAt: iso(end),
  progress: [
    { at: iso(t0 - 5_000), step: "Request received", detail: "Waiting for the BizDecide CFO team to pick it up" },
    { at: iso(t0), step: "Picked up by your CFO team", detail: "Seeded from the recorded demo run" },
    ...fx.progress.map(({ offsetMs, question: _q, answerOf: _a, ...p }) => ({ at: iso(t0 + offsetMs), ...p })),
    { at: iso(end), step: "CFO brief delivered", detail: fx.result.headline },
  ],
};

fx.questions.forEach((q, i) => {
  const asked = fx.progress.find((p) => p.question === i);
  db.questions[id()] = {
    requestId,
    ...q,
    allowOther: q.allowOther ?? true,
    pollCode: pollCode(),
    status: q.answer ? "answered" : "expired",
    createdAt: iso(t0 + (asked?.offsetMs ?? 0)),
    ...(q.answer ? { answeredAt: iso(t0 + (asked?.offsetMs ?? 0) + 15_000) } : {}),
  };
});
db.results[requestId] = { ...fx.result, createdAt: iso(end) };
if (fx.laneOutputs) db.lane_outputs[requestId] = { json: JSON.stringify(fx.laneOutputs), createdAt: iso(end) };

mkdirSync(".data", { recursive: true });
writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`Seeded request ${requestId} (${fx.businessName}). Start the app with BIZDECIDE_STORE=local and open /r/${requestId}`);
