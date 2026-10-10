// Scores the agent's latest CFO brief for the demo café against docs/ANSWER_KEY.md.
// Usage:
//   node scripts/score-result.mjs                 # latest completed request in .data/db.json (local mode)
//   node scripts/score-result.mjs result.json     # a Result JSON you exported (e.g. from Firestore)
// The checks are keyword/number based on purpose: fast feedback after every run, not a perfect grader.
import { readFileSync, existsSync } from "node:fs";

let result, questions = [], requestId = "(file)";
const arg = process.argv[2];
if (arg) {
  result = JSON.parse(readFileSync(arg, "utf8"));
} else {
  if (!existsSync(".data/db.json")) {
    console.error("No .data/db.json yet. Run the demo first, or pass a result JSON file.");
    process.exit(1);
  }
  const db = JSON.parse(readFileSync(".data/db.json", "utf8"));
  const done = Object.entries(db.requests)
    .filter(([id, r]) => r.status === "completed" && db.results[id])
    .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
  if (!done.length) {
    console.error("No completed request with a result yet.");
    process.exit(1);
  }
  [requestId] = done.at(-1);
  result = db.results[requestId];
  questions = Object.values(db.questions).filter((q) => q.requestId === requestId);
}

const text = (o) => JSON.stringify(o).toLowerCase();
const R = text(result);
const Q = text(questions);
const ALL = R + " " + Q;
const has = (s, ...needles) => needles.some((n) => s.includes(n.toLowerCase()));

const checks = [
  ["Finding 1: coffee powder price creep +12% at Kopi Cap Bintang (item-specific)",
    has(R, "cap bintang", "kcb-26") && has(R, "12%", "12.0%", "31.36")],
  ["Finding 2: duplicate payment LSS/2609/278 (RM642)",
    has(R, "lss/2609/278", "lss-2609-278") || (has(R, "642") && has(R, "duplicate", "twice", "paid two"))],
  ["Finding 3: missing DuitNow QR settlement for 18 Sep (RM312.40)",
    has(R, "312.40", "312.4") || (has(R, "duitnow", "qr") && has(R, "18 sep", "2026-09-18", "18/09"))],
  ["Finding 4: mixed receipt (Pasaraya Serba Murah) split or asked",
    has(ALL, "serba murah", "144.15", "r-0912-0047731")],
  ["Asked the owner a question (live poll used)", questions.length > 0],
  ["Asked about household income for AIM instead of guessing",
    has(Q, "household income", "pendapatan isi rumah") || (has(R, "aim", "paduri") && has(R, "household income") && has(R, "unknown", "need", "ask", "confirm"))],
  ["SME category = Micro", has(text(result.smeCategory ?? "") + R, "micro")],
  ["Turnover ≈ RM252,571", has(R, "252,571", "252571", "252.6k", "252,6", "rm252k", "252.57")],
  ["PUNB near miss quantified (needs RM300k)", has(R, "punb") && has(R, "300k", "300,000", "47k", "47,4")],
  ["Every decision has RM impact", (result.decisions ?? []).every((d) => typeof d.impactRm === "number")],
  ["Every decision has evidence", (result.decisions ?? []).every((d) => (d.evidence ?? []).length > 0)],
  ["Verification checks reported", (result.verification ?? []).length > 0],
  ["Application pack for an eligible programme (TEKUN Niaga, BNM MEF or BNM SRF)",
    (result.applicationPacks ?? []).some((p) => has(text(p), "tekun-niaga", "bnm-mef", "bnm-srf"))],
  ["Application pack checklist marks something missing or partial (not all 'ready')",
    (result.applicationPacks ?? []).some((p) => (p.checklist ?? []).some((c) => c.status !== "ready"))],
];

const falsePositives = [
  ["Flagged cash-on-delivery bread (Roti & Kaya) as unpaid/missing", has(R, "roti & kaya", "roti dan kaya", "mak long") && has(R, "missing payment", "unpaid", "not paid")],
  ["Flagged LPG (Tong Gas) as unpaid/missing", has(R, "tong gas") && has(R, "missing payment", "unpaid", "not paid")],
  ["Treated owner drawing RM1,500 as an expense", has(R, "1,500", "1500") && has(R, "expense") && !has(R, "drawing")],
  ["Flagged delivery platform commission as an anomaly", has(R, "commission") && has(R, "anomal", "unexpected", "discrepan")],
];

let score = 0;
console.log(`\nBizDecide score for request ${requestId}\n`);
for (const [label, ok] of checks) {
  if (ok) score++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
}
let fp = 0;
console.log("\nShould NOT flag:");
for (const [label, bad] of falsePositives) {
  if (bad) fp++;
  console.log(`${bad ? "✗ FLAGGED:" : "✓ ok:"} ${label}`);
}
console.log(`\nScore: ${score}/${checks.length}  ·  false positives: ${fp}\n`);
