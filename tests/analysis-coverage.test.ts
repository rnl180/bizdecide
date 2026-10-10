import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const run = (script: string, data: unknown, extra: string[] = []) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bizdecide-coverage-"));
  try {
    const file = path.join(dir, "business.json");
    writeFileSync(file, JSON.stringify(data));
    return JSON.parse(execFileSync(process.env.PYTHON_BIN || "python3", [path.join(root, script), "--data", file, ...extra], {
      encoding: "utf8", timeout: 10_000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const classify = "workbuddy/skills/sme-classifier/scripts/classify.py";
const financial = "workbuddy/skills/financial-analyzer/scripts/analyze.py";
const base = { profile: { name: "Coverage test", sector: "Retail", market: "MY" }, sales: [], purchases: [], bank: [], payables: [], suppliers: [] };

test("monthly uploads complete all stages and disclose unavailable daily reconciliation", () => {
  const b = { ...base, sales: [{ period: "2026-09", amountRm: 10000, duitnowQrRm: 2000, deliveryGrossRm: 1000 }],
    bank: [{ date: "2026-09-30", description: "DELIVERY W/E 3009", reference: "D1", creditRm: 700 }] };
  const result = run("workbuddy/run_all.py", b);
  assert.deepEqual(result.errors, {});
  assert.equal(result.keyNumbers.salesTotal, 10000);
  assert.equal(result.keyNumbers.turnover12m, null);
  assert.equal(result.sme.salesUsed, undefined, "unknown annual sales must not be sent as a known annual figure");
  assert.ok(result.limitations.financial.some((x: string) => x.includes("monthly sales")));
  assert.ok(result.funding.candidates.every((p: { screen: string }) => p.screen !== "passes code checks"));
  assert.ok(result.funding.candidates.find((p: { id: string }) => p.id === "PUNB-GROW")?.notes.some((x: string) => x.includes("Annual turnover unknown")));
});

test("classifier uses declared annual turnover when only a partial period is uploaded", () => {
  const b = { ...base, profile: { ...base.profile, annualSalesDeclaredRm: 600000 }, sales: [{ period: "2026-09", amountRm: 10000 }] };
  const result = run(classify, b);
  assert.equal(result.salesUsed, 600000);
  assert.equal(result.category, "Small");
  assert.match(result.salesSource, /declared annual/);
  assert.equal(result.observedSales.completeYear, false);
  assert.equal(result.declaredVsActual, undefined, "a monthly total is not comparable with an annual declaration");
  const unknown = run(classify, { ...b, profile: base.profile });
  assert.equal(unknown.salesUsed, null);
  assert.equal(unknown.category, null);
  assert.ok(unknown.unknownForEligibility.includes("annualSales"));
});

test("annual turnover uses only a complete consecutive year, with older rows excluded", () => {
  const sales = Array.from({ length: 12 }, (_, i) => ({ period: `2025-${String(i + 1).padStart(2, "0")}`, amountRm: 1000 }));
  const b = { ...base, sales: [{ period: "2024-12", amountRm: 99999 }, ...sales] };
  assert.equal(run(classify, b).salesUsed, 12000);
  const result = run(financial, b);
  assert.equal(result.turnover12m, 12000);
  assert.equal(result.salesTotal, 111999);
  // Twelve entries with a calendar gap still do not cover a complete year.
  const gapped = { ...b, sales: b.sales.filter((s) => s.period !== "2025-06") };
  assert.equal(run(financial, gapped).turnover12m, null);
  const partialDays = { ...base, sales: sales.map((s) => ({ ...s, period: `${s.period}-01` })) };
  assert.equal(run(financial, partialDays).turnover12m, null);
});

test("a malformed cached lane leaves other lanes and a repairable error available", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bizdecide-broken-lane-"));
  try {
    writeFileSync(path.join(dir, "financial.json"), "{broken-json");
    const demo = JSON.parse(readFileSync(path.join(root, "public/demo/kedai-kopi-aminah.json"), "utf8"));
    const result = run("workbuddy/run_all.py", demo, ["--inputs", dir]);
    assert.match(result.errors.financial, /JSONDecodeError/);
    assert.equal(result.sme.salesUsed, 252571.08);
    assert.ok(result.candidateDecisions.some((c: { type: string }) => c.type === "supplier_price_creep"));
    assert.equal(result.keyNumbers.turnover12m, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
