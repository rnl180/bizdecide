import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { financialImpactChecks, type FinancialImpactCheck } from "../lib/financial-impact";
import { validateResultDelivery } from "../lib/result-delivery";
import { BusinessInputSchema, ResultSchema, type BusinessInput } from "../lib/types";
import { money } from "../lib/markets";

const demo = BusinessInputSchema.parse(JSON.parse(readFileSync("public/demo/kedai-kopi-aminah.json", "utf8")));
const checks = financialImpactChecks(demo);
const refund = checks.find((c) => c.kind === "duplicate_payment")!;
function report(check: FinancialImpactCheck) {
  return ResultSchema.parse({
    headline: "Supported decision",
    decisions: [{ priority: "important", title: "Review this financial effect", action: "Prepare the query", reason: "Supported by uploaded records",
      impactCheckId: check.id, impactRm: check.impactRm, impactType: check.impactType,
      evidence: check.sources.map((source) => ({ label: "Uploaded records", source, basis: "data" })),
    }], verification: [{ check: "Agent reviewed evidence", passed: true }],
  });
}
const minimal = (data: Partial<BusinessInput>) => BusinessInputSchema.parse({ profile: { name: "Shop", sector: "Retail" }, ...data });

test("server independently computes demo amounts and records the conditions behind them", () => {
  assert.equal(refund.impactRm, 642);
  assert.equal(checks.find((c) => c.kind === "missing_qr_settlement")!.impactRm, 312.4);
  assert.equal(checks.find((c) => c.kind === "supplier_price_increase")!.impactRm, 82.13);
  assert.equal(money("MY", 2)(82.13), "RM82.13");
  for (const check of checks) {
    const saved = validateResultDelivery(report(check), demo);
    assert.ok(saved.verification.some((v) => v.check === "Server recalculated financial impacts from uploaded data" && v.passed));
    assert.ok(check.assumptions.every((a) => saved.assumptions.includes(a)));
  }
});

test("genuine references and an agent's passed check cannot hide an incorrect financial effect", () => {
  const base = report(refund), d = base.decisions[0]!;
  for (const amount of [999, 642.01, 641.99, 0, -642, 642.001]) {
    assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...d, impactRm: amount }] }, demo), /RM642.00/);
  }
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...d, impactType: "monthly" }] }, demo), /impactType/);
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...d, impactCheckId: undefined }] }, demo), /get_impact_checks/);
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...d, impactCheckId: "invented" }] }, demo), /get_impact_checks/);
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...d, evidence: d.evidence.slice(0, 1) }] }, demo), /payables/);
  assert.throws(() => validateResultDelivery({ ...base, decisions: [d, { ...d, title: "Count it again" }] }, demo), /already counted/);
  const changed = structuredClone(demo);
  changed.payables.find((p) => p.invoiceNo === "LSS/2609/278")!.amountRm = 640;
  assert.throws(() => validateResultDelivery(base, changed), /RM644.00/);
  // Proposed funding can still be useful, but a URL cannot establish a verified financial gain.
  const funding = { ...d, impactCheckId: undefined, impactRm: 40000, impactType: "financing" as const,
    evidence: [{ label: "Programme", url: "https://example.com/programme" }] };
  assert.throws(() => validateResultDelivery({ ...base, decisions: [funding] }, demo), /get_impact_checks/);
  assert.doesNotThrow(() => validateResultDelivery({ ...base, decisions: [{ ...funding, impactRm: undefined }] }, demo));
  assert.deepEqual(base.assumptions, [], "validation must not mutate the caller's report");
});

test("overpayment subtracts the invoice and rejects ambiguous, refunded or unrelated payments", () => {
  const b = minimal({
    payables: [{ invoiceNo: "INV-1", supplier: "Acme Dairy", amountRm: 100 }],
    bank: [
      { date: "2026-01-01", description: "ACME DAIRY INV-1", reference: "P1", debitRm: 60 },
      { date: "2026-01-02", description: "ACME DAIRY INV-1", reference: "P2", debitRm: 60 },
    ],
  });
  assert.equal(financialImpactChecks(b)[0]!.impactRm, 20, "two partial payments do not imply a whole-invoice refund");
  const variants = [
    { ...b, bank: [b.bank[0]!] },
    { ...b, bank: b.bank.map((t) => ({ ...t, reference: "P1" })) },
    { ...b, bank: b.bank.map((t) => ({ ...t, description: "OTHER SUPPLIER INV-1" })) },
    { ...b, bank: b.bank.map((t) => ({ ...t, description: "ACME DAIRY INV-10" })) },
    { ...b, payables: [...b.payables, { ...b.payables[0]!, invoiceNo: "INV/1" }] },
    { ...b, bank: [...b.bank, { date: "2026-01-03", description: "REFUND INV-1", reference: "R1", creditRm: 20 }] },
  ];
  for (const variant of variants) assert.deepEqual(financialImpactChecks(variant), []);
  const combined = { ...b,
    payables: [...b.payables, { ...b.payables[0]!, invoiceNo: "INV-2" }],
    bank: b.bank.map((t) => ({ ...t, description: "ACME DAIRY INV-1 AND INV-2", debitRm: 100 })),
  };
  assert.deepEqual(financialImpactChecks(combined), [], "a combined transfer cannot be counted in full against both invoices");
});

test("supplier projections use complete history, exact cents and the monthly period", () => {
  const b = minimal({ purchases: [
    { date: "2026-01-01", invoiceNo: "A", supplier: "Acme", item: "Milk", qty: 10, unit: "l", unitPriceRm: 10, totalRm: 100 },
    { date: "2026-01-31", invoiceNo: "B", supplier: "Acme", item: "Milk", qty: 20, unit: "l", unitPriceRm: 12, totalRm: 240 },
  ] });
  const check = financialImpactChecks(b)[0]!;
  assert.equal(check.impactRm, 30.42); // (12 - 10) * 15 * (365 / 30) / 12
  assert.equal(check.impactType, "monthly");
  const base = report(check), decision = base.decisions[0]!;
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...decision, impactRm: 365 }] }, b), /RM30.42/);
  assert.throws(() => validateResultDelivery({ ...base, decisions: [{ ...decision,
    evidence: [{ label: "Latest invoice only", source: { ...check.sources[0]!, keys: ["B"] } }],
  }] }, b), /'A'/);
  assert.deepEqual(financialImpactChecks({ ...b, purchases: b.purchases.map((p) => ({ ...p, date: "2026-01-01" })) }), []);
  assert.deepEqual(financialImpactChecks({ ...b, purchases: b.purchases.map((p, i) => ({ ...p, unit: i ? "kg" : "l" })) }), []);
  const fractional = { ...b, purchases: b.purchases.map((p, i) => ({ ...p, unitPriceRm: i ? 0.135 : 0.125, qty: 100 })) };
  assert.equal(financialImpactChecks(fractional)[0]!.impactRm, 1.01, "unit prices may have sub-cent precision; round only the final monthly effect");
});

test("settlement calculations scan the entire bank statement and respect its end date", () => {
  const b = minimal({
    sales: [
      { period: "2026-01-01", amountRm: 150, duitnowQrRm: 100, cardRm: 50 },
      { period: "2026-01-03", amountRm: 90, duitnowQrRm: 90 },
    ], bank: [
      { date: "2026-01-01", description: "OPENING", balanceRm: 100 },
      { date: "2026-01-02", description: "CARD MERCHANT SETTLEMENT 010126", reference: "C1", creditRm: 49.25 },
      { date: "2026-01-03", description: "CLOSING", balanceRm: 149.25 },
    ],
  });
  const computed = financialImpactChecks(b);
  assert.equal(computed.length, 1, "settled cards with fees and QR due after statement end are not missing");
  assert.equal(computed[0]!.impactRm, 100);
  assert.equal(computed[0]!.kind, "missing_qr_settlement");
  const laterCredit = { date: "2026-01-03", description: "DUITNOW QR MERCHANT SETTLEMENT 010126", reference: "Q1", creditRm: 100 };
  const settled = { ...b, bank: [...b.bank, laterCredit] };
  assert.deepEqual(financialImpactChecks(settled), []);
  assert.throws(() => validateResultDelivery(report(computed[0]!), settled), /get_impact_checks/);
  const missingCard = { ...b, bank: b.bank.filter((t) => t.reference !== "C1") };
  assert.equal(financialImpactChecks(missingCard).find((c) => c.kind === "missing_card_settlement")!.impactRm, 50);
});
