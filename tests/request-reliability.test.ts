import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateResultDelivery } from "../lib/result-delivery";
import { financialImpactChecks } from "../lib/financial-impact";
import { BusinessInputSchema, ResultSchema } from "../lib/types";

const root = process.cwd();
const business = BusinessInputSchema.parse(JSON.parse(readFileSync(path.join(root, "public/demo/kedai-kopi-aminah.json"), "utf8")));
const brief = ResultSchema.parse({
  headline: "Recover RM642",
  decisions: [{
    priority: "urgent", title: "Recover duplicate payment", action: "Request a refund of RM642",
    reason: "Two bank payments cover one invoice", impactRm: 642, impactType: "one_off",
    impactCheckId: financialImpactChecks(business).find((c) => c.kind === "duplicate_payment")!.id,
    evidence: [
      { label: "Two payments", source: { table: "bank", keys: ["IBG0915S02", "IBG0916S02"] } },
      { label: "Ledger", source: { table: "payables", keys: ["LSS/2609/278"] } },
    ],
  }],
  verification: [{ check: "Invoice and bank payments matched", passed: true, status: "passed" }],
});

test("delivery rejects missing, invented or contradictory proof", () => {
  assert.deepEqual(validateResultDelivery(brief, business).decisions, brief.decisions);
  assert.throws(() => validateResultDelivery({ ...brief, verification: [] }, business), /verification/);
  assert.throws(() => validateResultDelivery({ ...brief, verification: [{ check: "Not run", passed: false, status: "not_checked" }] }, business), /actually passed/);
  assert.throws(() => validateResultDelivery({ ...brief, verification: [{ check: "Contradiction", passed: true, status: "failed" }] }, business), /must agree/);
  const decision = brief.decisions[0]!;
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [] }] }, business), /evidence/);
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [{ label: "Trust me" }] }] }, business), /not proof/);
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [{ label: "Payments", source: { table: "bank", keys: ["IBG0915S02", "invented"] } }] }] }, business), /invented/);
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [{ label: "Empty key", source: { table: "bank", keys: [" "] } }] }] }, business), /not found/);
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [{ label: "Assumed", basis: "assumption", source: decision.evidence[0]!.source }] }] }, business), /not proof/);
  assert.throws(() => validateResultDelivery({ ...brief, numbers: [{ label: "Profit", value: 10, source: { table: "sales", keys: ["1999-01"] } }] }, business), /not found/);
  assert.throws(() => validateResultDelivery({ ...brief, decisions: [{ ...decision, evidence: [{ label: "Bad URL", url: "javascript:alert(1)" }] }] }, business), /HTTP or HTTPS/);
  // Honest limitations remain visible alongside checks actually performed.
  assert.doesNotThrow(() => validateResultDelivery({ ...brief, verification: [...brief.verification,
    { check: "Programme live availability", passed: false, status: "not_checked", detail: "Not opened during this run" },
  ] }, business));
});

test("claims, interruption recovery and delivery are atomic", async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bizdecide-reliability-"));
  const oldMode = process.env.BIZDECIDE_STORE;
  process.env.BIZDECIDE_STORE = "local";
  process.chdir(dir);
  t.after(() => {
    process.chdir(root);
    if (oldMode === undefined) delete process.env.BIZDECIDE_STORE;
    else process.env.BIZDECIDE_STORE = oldMode;
    rmSync(dir, { recursive: true, force: true });
  });
  const store = await import("../lib/store");
  const businessId = await store.createBusiness(business);
  const create = () => store.createRequest(businessId, business.profile.name, "bookkeeping", "MY", "en");
  const age = (id: string) => {
    // Simulate a worker disappearing. No test sleeps or production clock overrides.
    const file = path.join(dir, ".data/db.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.requests[id].updatedAt = new Date(Date.now() - store.REQUEST_STALE_MS - 1000).toISOString();
    writeFileSync(file, JSON.stringify(data));
  };

  await t.test("two direct claims have exactly one winner", async () => {
    const id = await create();
    const claims = await Promise.all([store.claimRequest(id, "Worker A"), store.claimRequest(id, "Worker B")]);
    assert.equal(claims.filter(Boolean).length, 1);
    const winner = claims.find(Boolean)!;
    assert.equal(winner.status, "processing");
    assert.ok(winner.claimToken);
    await store.saveResult(id, brief, winner.claimToken);
  });

  await t.test("parallel queue consumers pick distinct requests", async () => {
    const ids = [await create(), await create()];
    const claims = await Promise.all([store.claimNextRequest("Worker A"), store.claimNextRequest("Worker B")]);
    assert.deepEqual(claims.map((r) => r!.id).sort(), ids.sort());
    assert.equal(await store.claimNextRequest("Worker C"), null);
    for (const claim of claims) await store.saveResult(claim!.id, brief, claim!.claimToken);
  });

  await t.test("a live question is preserved; stale waiting work is reclaimed once", async () => {
    const id = await create();
    const original = (await store.claimRequest(id, "Original worker"))!;
    const qid = await store.createQuestion({ requestId: id, question: "Business or personal?", options: ["Business", "Personal"], allowOther: true }, original.claimToken);
    await store.updateRequest(id, { status: "waiting_for_user" }, original.claimToken);
    assert.equal(await store.claimNextRequest("Worker B"), null);
    assert.equal((await store.getQuestion(qid))?.status, "open");
    age(id);
    const claims = await Promise.all([store.claimNextRequest("Worker B"), store.claimNextRequest("Worker C")]);
    assert.equal(claims.filter(Boolean).length, 1);
    const recovered = claims.find(Boolean)!;
    assert.notEqual(recovered.claimToken, original.claimToken);
    assert.equal((await store.getQuestion(qid))?.status, "expired");
    await assert.rejects(store.updateRequest(id, { status: "failed" }, original.claimToken), /not owned/);
    await assert.rejects(store.saveResult(id, brief, original.claimToken), /not owned/);
    await assert.rejects(store.saveLaneOutputs(id, { stale: true }, original.claimToken), /not owned/);
    assert.equal(await store.getResult(id), null);
    await store.saveResult(id, brief, recovered.claimToken);
    await assert.rejects(store.saveResult(id, brief, recovered.claimToken), /not owned/);
  });

  await t.test("a processing run recovers after its last progress update expires", async () => {
    const id = await create();
    const first = (await store.claimRequest(id, "Worker A"))!;
    age(id);
    await store.updateRequest(id, { progress: { step: "Still working" } }, first.claimToken);
    assert.equal(await store.claimNextRequest("Worker B"), null);
    age(id);
    const recovered = (await store.claimNextRequest("Worker B"))!;
    assert.equal(recovered.id, id);
    assert.notEqual(recovered.claimToken, first.claimToken);
    await store.saveResult(id, brief, recovered.claimToken);
  });

  await t.test("invalid delivery saves nothing, and a corrected brief completes both records", async () => {
    const id = await create();
    const run = (await store.claimRequest(id, "Worker"))!;
    await assert.rejects(store.saveResult(id, { ...brief, verification: [] }, run.claimToken), /verification/);
    await assert.rejects(store.saveResult(id, { ...brief, decisions: [{ ...brief.decisions[0]!, evidence: [] }] }, run.claimToken), /evidence/);
    await assert.rejects(store.saveResult(id, { ...brief, decisions: [{ ...brief.decisions[0]!, impactRm: 999 }] }, run.claimToken), /RM642.00/);
    assert.equal(await store.getResult(id), null);
    assert.equal((await store.getRequest(id))?.status, "processing");
    await assert.rejects(store.updateRequest(id, { status: "completed" }, run.claimToken), /saveResult/);
    await assert.rejects(store.saveResult(id, brief), /not owned/);
    await store.saveResult(id, brief, run.claimToken);
    assert.equal((await store.getRequest(id))?.status, "completed");
    assert.equal((await store.getResult(id))?.headline, brief.headline);
  });

  await t.test("approved actions and owner questions also have only one claimant", async () => {
    const id = await create();
    const run = (await store.claimRequest(id, "Worker"))!;
    await store.saveResult(id, brief, run.claimToken);
    const action = await store.createAction({ requestId: id, businessId, decisionIndex: 0, decisionTitle: "Refund", lang: "en" });
    const actions = await Promise.all([store.claimNextAction(), store.claimNextAction()]);
    assert.equal(actions.filter(Boolean).length, 1);
    assert.equal(actions.find(Boolean)!.id, action.id);
    await store.createMessage(id, businessId, "Why?");
    const messages = await Promise.all([store.claimNextMessage(), store.claimNextMessage()]);
    assert.equal(messages.filter(Boolean).length, 1);
  });

  await t.test("duplicate approvals and expired action/message workers cannot overwrite a recovered outcome", async () => {
    const id = await create();
    const run = (await store.claimRequest(id, "Worker"))!;
    await store.saveResult(id, brief, run.claimToken);
    const input = { requestId: id, businessId, decisionIndex: 0, decisionTitle: "Refund", lang: "en" as const };
    const approvals = await Promise.all([store.createAction(input), store.createAction(input)]);
    assert.equal(approvals[0]!.id, approvals[1]!.id);
    assert.equal((await store.listActions(id)).length, 1);
    const action = (await store.claimAction(approvals[0]!.id))!;
    const messageId = await store.createMessage(id, businessId, "Why this amount?");
    const message = (await store.claimMessage(messageId))!;
    const file = path.join(dir, ".data/db.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    data.actions[action.id].claimedAt = old;
    data.messages[messageId].claimedAt = old;
    writeFileSync(file, JSON.stringify(data));
    const recovered = (await store.claimAction(action.id))!;
    const recoveredMessage = (await store.claimMessage(messageId))!;
    assert.notEqual(recovered.claimToken, action.claimToken);
    const output = { status: "done" as const, summary: "Refund email ready", email: { subject: "Refund", body: "Please refund RM642 for the duplicate payment." } };
    await assert.rejects(store.completeAction(action.id, output, action.claimToken), /not owned/);
    await assert.rejects(store.answerMessage(messageId, "Stale answer", undefined, message.claimToken), /not owned/);
    assert.equal((await store.getAction(action.id))?.status, "working");
    await store.completeAction(action.id, output, recovered.claimToken);
    await store.answerMessage(messageId, "Current answer", undefined, recoveredMessage.claimToken);
    await assert.rejects(store.answerMessage(messageId, "Second answer", undefined, recoveredMessage.claimToken), /not owned/);
    assert.equal((await store.getMessage(messageId))?.answer, "Current answer");
    assert.equal((store.withoutClaimToken(recovered) as { claimToken?: string }).claimToken, undefined);
    assert.equal((store.withoutClaimToken(recoveredMessage) as { claimToken?: string }).claimToken, undefined);
  });

  await t.test("owner facts survive request recovery and a closed question cannot be answered again", async () => {
    const id = await create();
    const run = (await store.claimRequest(id, "Worker"))!;
    const qid = await store.createQuestion({ requestId: id, question: "Receipt?", options: ["Business", "Personal"], allowOther: false }, run.claimToken);
    await assert.rejects(store.answerQuestion(qid, "Invented option"), /offered answers/);
    await store.answerQuestion(qid, "Business");
    age(id);
    const recovered = (await store.claimRequest(id, "Replacement", store.REQUEST_STALE_MS))!;
    assert.equal((await store.listQuestions(id))[0]?.answer, "Business");
    await assert.rejects(store.answerQuestion(qid, "Personal"), /closed/);
    const pending = await store.createQuestion({ requestId: id, question: "More?", options: ["Yes", "No"], allowOther: false }, recovered.claimToken);
    await store.expireQuestion(pending, recovered.claimToken);
    await assert.rejects(store.answerQuestion(pending, "Yes"), /closed/);
    await store.saveResult(id, brief, recovered.claimToken);
  });
});
