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
const { action } = await api(`/api/requests/${requestId}/actions`, { decisionIndex: 0, lang: "en" });
assert.equal(action.status, "queued");
const work = await tool("wait_for_request", { waitSeconds: 5 });
assert.equal(work.action.id, action.id);
const ownerProof = await api(`/api/requests/${requestId}/rows?table=bank&keys=${finding.source.keys.join(",")}`);
assert.deepEqual(work.sourceRows[0].rows, ownerProof.rows);
assert.equal(work.sourceRows[1].rows.length, 1);
const rejected = await rpc("tools/call", { name: "complete_action", arguments: { actionId: action.id, summary: "Ready" } });
assert.equal(rejected.isError, true);
assert.match(rejected.content[0].text, /Attach/);
assert.equal((await api(`/api/requests/${requestId}/actions`)).actions[0].status, "working");
const email = {
  subject: "Refund request: invoice LSS/2609/278",
  body: "Dear Fresh Dairy Farm Enterprise,\n\nWe paid invoice LSS/2609/278 (RM642) twice: 15 September 2026, reference IBG0915S02, and 16 September 2026, reference IBG0916S02. Please arrange a refund or credit note for the additional RM642.\n\nThank you,\nRock Cafe",
};
await tool("complete_action", { actionId: action.id, summary: "Demo refund request ready to send", channel: "note", email });
const saved = (await api(`/api/requests/${requestId}/actions`)).actions[0];
assert.equal(saved.status, "done");
assert.deepEqual(saved.email, email);
assert.equal((await api(`/api/requests/${requestId}`)).request.status, "completed");
console.log(`MCP refund workflow passed. Local demo: ${base}/r/${requestId}`);
