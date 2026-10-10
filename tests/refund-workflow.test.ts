import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { actionCompletionProblem } from "../lib/action-completion";
import { claudeEnabled } from "../lib/engine";
import { sourceRows } from "../lib/source-rows";
import { financialImpactChecks } from "../lib/financial-impact";
import { BusinessInputSchema, ResultSchema, type Decision } from "../lib/types";

const root = process.cwd();
const business = BusinessInputSchema.parse(JSON.parse(readFileSync(path.join(root, "public/demo/kedai-kopi-aminah.json"), "utf8")));
const refund: Decision = {
  priority: "urgent", title: "Recover the duplicate payment", action: "Request a refund of RM642",
  impactRm: 642, impactType: "one_off", reason: "One invoice was paid twice.",
  impactCheckId: financialImpactChecks(business).find((c) => c.kind === "duplicate_payment")!.id,
  evidence: [
    { label: "Two payments", source: { table: "bank", keys: ["IBG0915S02", "IBG0916S02"] } },
    { label: "Ledger", source: { table: "payables", keys: ["LSS/2609/278"] } },
  ],
};
const email = {
  subject: "Refund request: invoice LSS/2609/278",
  body: "Please refund the additional RM642 paid for invoice LSS/2609/278. Payments were made on 15 September (IBG0915S02) and 16 September 2026 (IBG0916S02). Thank you, Rock Cafe.",
};

test("an API key alone never bypasses WorkBuddy", () => {
  assert.equal(claudeEnabled({}), false);
  assert.equal(claudeEnabled({ ANTHROPIC_API_KEY: "test-key" }), false);
  assert.equal(claudeEnabled({ BIZDECIDE_ENGINE: "workbuddy", ANTHROPIC_API_KEY: "test-key" }), false);
  assert.equal(claudeEnabled({ BIZDECIDE_ENGINE: "claude" }), false);
  assert.equal(claudeEnabled({ BIZDECIDE_ENGINE: "claude", ANTHROPIC_API_KEY: " " }), false);
  assert.equal(claudeEnabled({ BIZDECIDE_ENGINE: "claude", ANTHROPIC_API_KEY: "test-key" }), true);
});

test("done requires useful content, a matching channel and an email for a refund", () => {
  const done = { status: "done" as const, summary: "Ready" };
  assert.ok(actionCompletionProblem(done));
  assert.ok(actionCompletionProblem({ ...done, links: [{ label: "Drafts", url: "https://mail.google.com" }] }));
  assert.ok(actionCompletionProblem({ ...done, email: { subject: " ", body: " " } }));
  assert.ok(actionCompletionProblem({ ...done, summary: " ", email }));
  const document = { title: "Letter", sections: [{ heading: "Request", body: "Please refund." }] };
  assert.ok(actionCompletionProblem({ ...done, document }, refund));
  assert.ok(actionCompletionProblem({ ...done, document, channel: "gmail_draft" }));
  assert.ok(actionCompletionProblem({ ...done, email, channel: "document" }));
  assert.ok(actionCompletionProblem({ ...done, document: { ...document, sections: [{ heading: "Request", body: " " }] } }));
  assert.equal(actionCompletionProblem({ ...done, document, channel: "document" }), null);
  assert.equal(actionCompletionProblem({ ...done, email, channel: "note" }, refund), null);
  assert.equal(actionCompletionProblem({ status: "failed", error: "Source data missing" }), null);
  assert.ok(actionCompletionProblem({ status: "failed", error: " " }));
});

test("the agent's bank proof matches the owner's rows; item and month selection still work", () => {
  const rows = sourceRows(business, refund.evidence[0]!.source!);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.reference, r.date, r.debitRm]), [
    ["IBG0915S02", "2026-09-15", 642], ["IBG0916S02", "2026-09-16", 642],
  ]);
  assert.equal(sourceRows(business, { table: "bank", keys: ["missing"] }).length, 0);
  const sales = sourceRows(business, { table: "sales", keys: ["2026-09"] });
  assert.ok(sales.length > 0);
  assert.ok(sales.every((r) => String(r.period).startsWith("2026-09")));
  const coffee = sourceRows(business, { table: "purchases", keys: ["KCB-26-1187"], item: "Black Coffee Powder Blend 1kg" });
  assert.equal(coffee.length, 1);
  assert.equal(coffee[0]!.unitPriceRm, 28);
});

test("demo analysis finds the refund; rejected completion stays working and a repaired email is saved", async (t) => {
  const analysis = JSON.parse(execFileSync(process.env.PYTHON_BIN || "python3", [
    path.join(root, "workbuddy/run_all.py"), "--data", path.join(root, "public/demo/kedai-kopi-aminah.json"),
  ], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }));
  assert.deepEqual(analysis.errors, {});
  const finding = analysis.candidateDecisions.find((d: { type: string }) => d.type === "duplicate_payment");
  assert.equal(finding.impactRm, 642);
  assert.equal(finding.detail.invoiceNo, "LSS/2609/278");
  assert.deepEqual(finding.source.keys, ["IBG0915S02", "IBG0916S02"]);
  assert.equal(sourceRows(business, finding.detail.ledgerSource).length, 1);
  assert.equal(analysis.candidateDecisions.find((d: { type: string }) => d.type === "supplier_price_creep").impactRm, 82.13);

  // The store captures cwd on import; keep all test records outside the real .data folder.
  const dir = mkdtempSync(path.join(os.tmpdir(), "bizdecide-refund-test-"));
  const previousMode = process.env.BIZDECIDE_STORE;
  process.env.BIZDECIDE_STORE = "local";
  process.chdir(dir);
  t.after(() => {
    process.chdir(root);
    if (previousMode === undefined) delete process.env.BIZDECIDE_STORE;
    else process.env.BIZDECIDE_STORE = previousMode;
    rmSync(dir, { recursive: true, force: true });
  });
  const store = await import("../lib/store");
  const businessId = await store.createBusiness(business);
  const requestId = await store.createRequest(businessId, business.profile.name, "bookkeeping", "MY", "en");
  const run = await store.claimRequest(requestId, "Test worker");
  await store.saveResult(requestId, ResultSchema.parse({ headline: "Recover RM642", decisions: [refund], verification: [{ check: "Bank payments matched", passed: true }] }), run!.claimToken);
  const action = await store.createAction({ requestId, businessId, decisionIndex: 0, decisionTitle: refund.title, lang: "en" });
  assert.equal((await store.claimNextAction())?.id, action.id);
  await assert.rejects(store.completeAction(action.id, { status: "done", summary: "Done" }), /Attach/);
  assert.equal((await store.getAction(action.id))?.status, "working");
  assert.equal((await store.getAction(action.id))?.completedAt, undefined);
  await store.completeAction(action.id, { status: "done", summary: "Refund request ready to send", channel: "note", email });
  const saved = await store.getAction(action.id);
  assert.equal(saved?.status, "done");
  assert.deepEqual(saved?.email, email);
  assert.ok(saved?.completedAt);
  await assert.rejects(store.completeAction(action.id, { status: "failed", error: "Late response" }), /already done/);
  assert.equal((await store.getAction(action.id))?.status, "done");
  const missing = await store.createAction({ requestId: "missing-brief", businessId, decisionIndex: 0, decisionTitle: refund.title, lang: "en" });
  await assert.rejects(store.completeAction(missing.id, { status: "done", summary: "Ready", email }), /decision is missing/);
  await store.completeAction(missing.id, { status: "failed", error: "The brief is missing" });
  assert.equal((await store.getAction(missing.id))?.status, "failed");
});
