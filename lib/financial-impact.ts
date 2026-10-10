import { createHash } from "node:crypto";
import type { BusinessInput, SourceRef } from "./types";

/** Calculated from uploaded rows, never from an agent's figures or cached lane outputs. */
export interface FinancialImpactCheck {
  id: string;
  kind: "duplicate_payment" | "missing_qr_settlement" | "missing_card_settlement" | "supplier_price_increase";
  impactRm: number;
  impactType: "one_off" | "monthly";
  sources: SourceRef[];
  formula: string;
  assumptions: string[];
}

// Use uploaded decimal values, including fractional quantities and unit prices.
// Binary floating point must not turn an exact half-cent into rounding down.
function decimal(n: number) {
  const [mantissa, exponent = "0"] = n.toString().split("e");
  const fractionDigits = (mantissa!.split(".")[1] ?? "").length;
  const scale = fractionDigits - Number(exponent);
  const value = BigInt(mantissa!.replace(".", ""));
  return { value: scale < 0 ? value * 10n ** BigInt(-scale) : value, scale: Math.max(scale, 0) };
}
function roundedRatio(numerator: bigint, denominator: bigint) {
  const value = (2n * numerator + denominator) / (2n * denominator);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : NaN;
}
const cents = (n: number) => {
  const d = decimal(n);
  return roundedRatio(d.value * 100n, 10n ** BigInt(d.scale));
};
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const day = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? t / 86_400_000 : NaN;
};
const id = (kind: FinancialImpactCheck["kind"], ...keys: string[]) =>
  `${kind}:${createHash("sha256").update(JSON.stringify(keys)).digest("hex").slice(0, 20)}`;
function sources(table: SourceRef["table"], keys: string[], item?: string): SourceRef[] {
  const result: SourceRef[] = [];
  for (let i = 0; i < keys.length; i += 50) result.push({ table, keys: keys.slice(i, i + 50), ...(item ? { item } : {}) });
  return result;
}

// Match invoice tokens, rather than letting INV-1 match INV-10.
function mentionsInvoice(text: string, invoice: string) {
  const parts = invoice.toUpperCase().match(/[A-Z0-9]+/g);
  return Boolean(parts?.length && new RegExp(`(^|[^A-Z0-9])${parts.join("[^A-Z0-9]*")}($|[^A-Z0-9])`).test(text.toUpperCase()));
}

export function financialImpactChecks(b: BusinessInput): FinancialImpactCheck[] {
  const checks: FinancialImpactCheck[] = [];
  const referenceCounts = new Map<string, number>();
  for (const row of b.bank) if (row.reference) referenceCounts.set(row.reference, (referenceCounts.get(row.reference) ?? 0) + 1);

  for (const invoice of b.payables) {
    if (!positive(invoice.amountRm) || !invoice.invoiceNo.trim()) continue;
    // A repeated ledger invoice could be a second bill: require an unambiguous obligation.
    const normalizedInvoice = invoice.invoiceNo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (b.payables.filter((p) => p.invoiceNo.toUpperCase().replace(/[^A-Z0-9]/g, "") === normalizedInvoice).length !== 1) continue;
    const payments = b.bank.filter((t) => positive(t.debitRm) && mentionsInvoice(`${t.description} ${t.reference ?? ""}`, invoice.invoiceNo));
    if (payments.length < 2 || payments.some((t) => !t.reference || referenceCounts.get(t.reference) !== 1)) continue;
    // Require a supplier match as well as the invoice number. Ignore corporate suffixes.
    const supplierWords = (invoice.supplier.toUpperCase().match(/[A-Z0-9]+/g) ?? [])
      .filter((w) => !["SDN", "BHD", "ENTERPRISE", "TRADING", "LTD", "LIMITED", "INC", "CO"].includes(w)).slice(0, 2);
    if (!supplierWords.length || payments.some((t) => supplierWords.some((w) => !new RegExp(`(^|[^A-Z0-9])${w}($|[^A-Z0-9])`).test(t.description.toUpperCase())))) continue;
    // Refunds/credits referencing this invoice make the outstanding recovery uncertain.
    if (b.bank.some((t) => positive(t.creditRm) && mentionsInvoice(`${t.description} ${t.reference ?? ""}`, invoice.invoiceNo))) continue;
    const paid = payments.reduce((sum, t) => sum + cents(t.debitRm!), 0);
    const extra = paid - cents(invoice.amountRm);
    if (!Number.isSafeInteger(extra) || extra <= 0) continue;
    checks.push({
      id: id("duplicate_payment", invoice.invoiceNo), kind: "duplicate_payment", impactRm: extra / 100, impactType: "one_off",
      sources: [...sources("bank", payments.map((t) => t.reference!)), { table: "payables", keys: [invoice.invoiceNo] }],
      formula: `Paid RM${(paid / 100).toFixed(2)} - invoice RM${invoice.amountRm.toFixed(2)} = RM${(extra / 100).toFixed(2)}`,
      assumptions: ["Recovery is a potential overpayment from the uploaded records; confirm that no refund or credit exists outside those records."],
    });
  }

  // Settlement checks use the full statement, not just the bank rows selected by the agent.
  const bankDays = b.bank.map((t) => day(t.date));
  if (bankDays.length && bankDays.every(Number.isFinite)) {
    const start = bankDays.reduce((a, b) => Math.min(a, b)), end = bankDays.reduce((a, b) => Math.max(a, b));
    for (const sale of b.sales) {
      const date = day(sale.period);
      if (!Number.isFinite(date) || date < start - 1 || date + 1 > end) continue;
      if (b.sales.filter((s) => s.period === sale.period).length !== 1) continue;
      const code = `${sale.period.slice(8, 10)}${sale.period.slice(5, 7)}${sale.period.slice(2, 4)}`;
      for (const [channel, column, kind] of [
        ["QR", "duitnowQrRm", "missing_qr_settlement"], ["CARD", "cardRm", "missing_card_settlement"],
      ] as const) {
        const amount = sale[column];
        if (!positive(amount) || !Number.isSafeInteger(cents(amount))) continue;
        const settled = b.bank.some((t) => positive(t.creditRm) && new RegExp(`\\b${channel}\\b`).test(t.description.toUpperCase()) &&
          new RegExp(`(^|\\D)${code}(\\D|$)`).test(t.description));
        if (settled) continue;
        checks.push({
          id: id(kind, sale.period), kind, impactRm: cents(amount) / 100, impactType: "one_off",
          sources: [{ table: "sales", keys: [sale.period] }],
          formula: `${channel} gross sales on ${sale.period} = RM${amount.toFixed(2)}; no dated settlement found in the full uploaded statement`,
          assumptions: [`${channel} query amount is gross sales, not a confirmed refund. Assumes next-day settlement and dated ${channel} bank descriptions; fees, weekends and other reference formats need confirmation.`],
        });
      }
    }
  }

  // Recompute from the entire supplier/item history; an agent cannot cherry-pick the volume or dates.
  const groups = new Map<string, BusinessInput["purchases"]>();
  for (const row of b.purchases) {
    const key = JSON.stringify([row.supplier, row.item]);
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  for (const rows of groups.values()) {
    if (rows.length < 2 || rows.some((r) => !positive(r.qty) || !positive(r.unitPriceRm) || !Number.isFinite(day(r.date)) || !r.invoiceNo?.trim())) continue;
    if (new Set(rows.map((r) => r.invoiceNo)).size !== rows.length || new Set(rows.map((r) => r.unit ?? "")).size !== 1) continue;
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const first = rows[0]!, last = rows[rows.length - 1]!;
    const span = day(last.date) - day(first.date);
    const base = decimal(first.unitPriceRm!), latest = decimal(last.unitPriceRm!);
    const priceScale = Math.max(base.scale, latest.scale);
    const change = latest.value * 10n ** BigInt(priceScale - latest.scale) - base.value * 10n ** BigInt(priceScale - base.scale);
    if (span <= 0 || change <= 0n) continue;
    const quantities = rows.map((r) => decimal(r.qty!));
    const quantityScale = quantities.reduce((scale, q) => Math.max(scale, q.scale), 0);
    const totalQuantity = quantities.reduce((sum, q) => sum + q.value * 10n ** BigInt(quantityScale - q.scale), 0n);
    const monthly = roundedRatio(change * totalQuantity * 365n * BigInt(rows.length - 1) * 100n,
      10n ** BigInt(priceScale + quantityScale) * BigInt(rows.length) * BigInt(span) * 12n);
    if (!Number.isSafeInteger(monthly) || monthly <= 0) continue;
    checks.push({
      id: id("supplier_price_increase", first.supplier, first.item), kind: "supplier_price_increase", impactRm: monthly / 100, impactType: "monthly",
      sources: sources("purchases", rows.map((r) => r.invoiceNo!), first.item),
      formula: `(${last.unitPriceRm} - ${first.unitPriceRm}) × (${rows.reduce((sum, r) => sum + r.qty!, 0)} / ${rows.length}) × (365 × ${rows.length - 1} / ${span}) / 12 = RM${(monthly / 100).toFixed(2)}/month`,
      assumptions: [`${first.supplier}, ${first.item}: projected avoidable price increase at historical order volume and frequency, assuming the baseline price can be negotiated; savings are not guaranteed.`],
    });
  }
  return checks;
}
