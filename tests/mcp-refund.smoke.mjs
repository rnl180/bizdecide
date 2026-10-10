// Run against a fresh local server: BIZDECIDE_MCP_KEY=<local key> node tests/mcp-refund.smoke.mjs
// Simulates WorkBuddy's MCP calls; it does not run WorkBuddy or send any email.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.env.BIZDECIDE_TEST_URL || "http://127.0.0.1:3100";
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname), "Use a local test server");
const business = JSON.parse(readFileSync(new URL("../public/demo/kedai-kopi-aminah.json", import.meta.url), "utf8"));
let rpcId = 0;
async function api(route, body) {
  const res = await fetch(`${base}${route}`, body === undefined ? {} : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  assert.ok(res.ok, JSON.stringify(data));
  return data;
}
async function rpc(method, params) {
  const res = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${process.env.BIZDECIDE_MCP_KEY || ""}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const data = await res.json();
  assert.ok(res.ok && !data.error, JSON.stringify(data));
  return data.result;
}
async function tool(name, args) {
  const result = await rpc("tools/call", { name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
}

await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "bizdecide-refund-smoke", version: "1" } });
const { id: businessId } = await api("/api/businesses", { business });
const { id: requestId } = await api("/api/requests", { businessId, service: "bookkeeping" });
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "submitted");
const contenders = await Promise.all([tool("wait_for_request", { waitSeconds: 5 }), tool("wait_for_request", { waitSeconds: 5 })]);
assert.equal(contenders.filter((r) => r.status === "new_request").length, 1);
assert.equal(contenders.filter((r) => r.status === "idle").length, 1);
const picked = contenders.find((r) => r.status === "new_request");
assert.equal(picked.request.id, requestId, "Use a fresh server with no earlier pending work");
assert.equal(picked.request.goal, business.profile.goal);
assert.equal(picked.request.language, business.profile.language || "en");
const claimToken = picked.request.claimToken;
assert.ok(claimToken);
assert.equal((await api(`/api/requests/${requestId}`)).request.claimToken, undefined);
await tool("update_request", { requestId, claimToken, step: "Plan", detail: "Check uploaded payments against invoices, verify the effect, then prepare the approved refund email." });
const poll = await tool("ask_user", { requestId, claimToken, question: "Is the mixed receipt business or personal?",
  options: ["Business", "Personal"], allowOther: false, waitSeconds: 0 });
assert.equal(poll.status, "pending");
await api(`/api/questions/${poll.questionId}/answer`, { answer: "Business" });
assert.equal((await tool("get_answer", { questionId: poll.questionId, claimToken })).answer, "Business");
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "processing");
const link = await tool("get_data_link", { businessId });
const analysis = JSON.parse(execFileSync(process.env.PYTHON_BIN || "python3", [
  "workbuddy/run_all.py", "--data", link.url,
], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }));
assert.deepEqual(analysis.errors, {});
const finding = analysis.candidateDecisions.find((d) => d.type === "duplicate_payment");
assert.equal(finding.impactRm, 642);
const { checks } = await tool("get_impact_checks", { businessId });
const refundCheck = checks.find((c) => c.kind === "duplicate_payment");
assert.equal(refundCheck.impactRm, 642);
assert.equal(checks.find((c) => c.kind === "supplier_price_increase").impactRm, 82.13);
const decision = {
  priority: "urgent", title: "Recover RM642 paid twice", action: "Request a refund for invoice LSS/2609/278.",
  impactRm: finding.impactRm, impactType: "one_off", reason: "Two bank payments cover one invoice.",
  impactCheckId: refundCheck.id,
  evidence: [
    { label: "Bank payments", source: finding.source },
    { label: "Invoice", source: finding.detail.ledgerSource },
  ], confidence: "high",
};
const result = { headline: "Demo MCP test: RM642 to recover", decisions: [decision], verification: [{ check: "Matched invoice against two distinct bank payments", passed: true, status: "passed" }], agentsUsed: ["Demo MCP test client"] };
const staleRun = await rpc("tools/call", { name: "submit_results", arguments: { requestId, claimToken: "old-worker-token", result } });
assert.equal(staleRun.isError, true);
assert.match(staleRun.content[0].text, /not owned/);
const invalidBrief = await rpc("tools/call", { name: "submit_results", arguments: { requestId, claimToken, result: { ...result, verification: [] } } });
assert.equal(invalidBrief.isError, true);
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "processing");
assert.equal((await api(`/api/requests/${requestId}`)).result, null);
const wrongMoney = await rpc("tools/call", { name: "submit_results", arguments: { requestId, claimToken,
  result: { ...result, decisions: [{ ...decision, impactRm: 999 }] },
} });
assert.equal(wrongMoney.isError, true);
assert.match(wrongMoney.content[0].text, /RM642.00/);
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "processing");
assert.equal((await api(`/api/requests/${requestId}`)).result, null);
await tool("submit_results", { requestId, claimToken, result });
assert.ok((await api(`/api/requests/${requestId}`)).result.verification.some((v) => v.check === "Server recalculated financial impacts from uploaded data" && v.passed));
const approvals = await Promise.all([
  api(`/api/requests/${requestId}/actions`, { decisionIndex: 0, lang: "en" }),
  api(`/api/requests/${requestId}/actions`, { decisionIndex: 0, lang: "en" }),
]);
const { action } = approvals[0];
assert.equal(approvals[1].action.id, action.id);
assert.equal(action.status, "queued");
const work = await tool("wait_for_request", { waitSeconds: 5 });
assert.equal(work.action.id, action.id);
assert.ok(work.action.claimToken);
assert.equal((await api(`/api/requests/${requestId}/actions`)).actions[0].claimToken, undefined);
const staleAction = await rpc("tools/call", { name: "complete_action", arguments: { actionId: action.id,
  claimToken: "old-action-worker", status: "failed", summary: "Stale worker output" } });
assert.equal(staleAction.isError, true);
assert.match(staleAction.content[0].text, /not owned/);
const ownerProof = await api(`/api/requests/${requestId}/rows?table=bank&keys=${finding.source.keys.join(",")}`);
assert.deepEqual(work.sourceRows[0].rows, ownerProof.rows);
assert.equal(work.sourceRows[1].rows.length, 1);
const rejected = await rpc("tools/call", { name: "complete_action", arguments: { actionId: action.id, claimToken: work.action.claimToken, summary: "Ready" } });
assert.equal(rejected.isError, true);
assert.match(rejected.content[0].text, /Attach/);
assert.equal((await api(`/api/requests/${requestId}/actions`)).actions[0].status, "working");
const email = {
  subject: "Refund request: invoice LSS/2609/278",
  body: "Dear Fresh Dairy Farm Enterprise,\n\nWe paid invoice LSS/2609/278 (RM642) twice: 15 September 2026, reference IBG0915S02, and 16 September 2026, reference IBG0916S02. Please arrange a refund or credit note for the additional RM642.\n\nThank you,\nRock Cafe",
};
await tool("complete_action", { actionId: action.id, claimToken: work.action.claimToken, summary: "Demo refund request ready to send", channel: "note", email });
const saved = (await api(`/api/requests/${requestId}/actions`)).actions[0];
assert.equal(saved.status, "done");
assert.deepEqual(saved.email, email);
assert.equal(saved.outcome, undefined, "Preparing a draft must not imply it was sent or paid");
const outcomePath = `/api/requests/${requestId}/actions/${action.id}/outcome`;
const sent = await api(outcomePath, { status: "sent", revision: 0 });
assert.equal(sent.action.claimToken, undefined);
assert.equal(sent.action.outcome.source, "owner_reported");
const recorded = await api(outcomePath, { status: "recorded", revision: 1, amountRm: 321.25, note: "Smoke fixture: partial refund, owner report only" });
assert.equal(recorded.action.outcome.amountRm, 321.25);
for (const [route, body, status] of [
  [outcomePath, { status: "sent", revision: 1 }, 409],
  [outcomePath, { status: "recorded", revision: 2, amountRm: -1, note: "Invalid" }, 400],
  [`/api/requests/wrong-request/actions/${action.id}/outcome`, { status: "sent", revision: 2 }, 404],
]) {
  const response = await fetch(`${base}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, status);
}
assert.equal((await api(`/api/requests/${requestId}/actions`)).actions[0].outcome.amountRm, 321.25);
assert.equal((await api(`/api/requests/${requestId}`)).result.decisions[0].impactRm, 642);
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "completed");
const { id: messageId } = await api(`/api/requests/${requestId}/messages`, { question: "Why is the refund RM642?" });
const ownerQuestion = await tool("wait_for_request", { waitSeconds: 5 });
assert.equal(ownerQuestion.message.id, messageId);
assert.ok(ownerQuestion.message.claimToken);
assert.equal((await api(`/api/requests/${requestId}/messages`)).messages[0].claimToken, undefined);
assert.equal((await api(`/api/requests/${requestId}`)).messages[0].claimToken, undefined);
const staleReply = await rpc("tools/call", { name: "reply_to_owner", arguments: { messageId, claimToken: "old-message-worker", answer: "A stale answer" } });
assert.equal(staleReply.isError, true);
await tool("reply_to_owner", { messageId, claimToken: ownerQuestion.message.claimToken,
  answer: "The two payments total RM1,284 against an invoice for RM642. The potential overpayment is RM642." });
assert.equal((await api(`/api/requests/${requestId}/messages`)).messages[0].status, "answered");
console.log(`MCP refund workflow passed. Local demo: ${base}/r/${requestId}`);
