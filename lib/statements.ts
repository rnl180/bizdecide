import type { BusinessInput } from "./types";

/**
 * The small figure cards and statements on the brief: sales, purchases and the bank, added up in code from the
 * owner's own rows. No profit line: the files hold no rent, wages, assets or liabilities, so a profit would be made up.
 */

export type Channel = "cash" | "qr" | "card" | "delivery" | "other";

export type Statements = {
  /** The last 12 months of sales, as SME Corp counts turnover, split by how customers paid when the file says. */
  sales?: { total: number; from: string; to: string; channels: { key: Channel; amount: number }[] };
  purchases?: { total: number; from: string; to: string; suppliers: number };
  /** Opening + money in − money out should equal closing; `reconciles` says whether it does. */
  bank?: { from: string; to: string; opening: number; moneyIn: number; moneyOut: number; closing: number; reconciles: boolean };
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const CHANNEL_COLUMNS: [Exclude<Channel, "other">, string][] = [
  ["cash", "cashRm"],
  ["qr", "duitnowQrRm"],
  ["card", "cardRm"],
  ["delivery", "deliveryGrossRm"],
];

export function buildStatements(b: Pick<BusinessInput, "sales" | "purchases" | "bank">): Statements | null {
  const out: Statements = {};

  const months = [...new Set((b.sales ?? []).map((s) => s.period.slice(0, 7)))].sort().slice(-12);
  const keep = new Set(months);
  const sales = (b.sales ?? []).filter((s) => keep.has(s.period.slice(0, 7))).sort((x, y) => x.period.localeCompare(y.period));
  if (sales.length) {
    const total = sales.reduce((a, s) => a + num(s.amountRm), 0);
    const rows = sales as Record<string, unknown>[];
    const channels: { key: Channel; amount: number }[] = CHANNEL_COLUMNS.filter(([, col]) => rows.some((s) => s[col] !== undefined)).map(
      ([key, col]) => ({ key, amount: r2(rows.reduce((a, s) => a + num(s[col]), 0)) }),
    );
    const rest = total - channels.reduce((a, c) => a + c.amount, 0);
    if (channels.length && Math.abs(rest) >= 1) channels.push({ key: "other", amount: r2(rest) });
    out.sales = { total: r2(total), from: sales[0]!.period, to: sales.at(-1)!.period, channels };
  }

  const purchases = [...(b.purchases ?? [])].sort((x, y) => x.date.localeCompare(y.date));
  if (purchases.length) {
    out.purchases = {
      total: r2(purchases.reduce((a, p) => a + num(p.totalRm), 0)),
      from: purchases[0]!.date,
      to: purchases.at(-1)!.date,
      suppliers: new Set(purchases.map((p) => p.supplier)).size,
    };
  }

  const bank = b.bank ?? [];
  const lines = bank.filter((x) => !/opening balance/i.test(x.description));
  const withBalance = bank.filter((x) => typeof x.balanceRm === "number");
  if (lines.length && withBalance.length) {
    const moneyIn = lines.reduce((a, x) => a + num(x.creditRm), 0);
    const moneyOut = lines.reduce((a, x) => a + num(x.debitRm), 0);
    const first = bank[0]!;
    // The opening balance line when there is one, else worked back from the first line's balance.
    const opening = /opening balance/i.test(first.description)
      ? num(first.balanceRm)
      : num(first.balanceRm) - num(first.creditRm) + num(first.debitRm);
    const closing = num(withBalance.at(-1)!.balanceRm);
    out.bank = {
      from: bank[0]!.date,
      to: bank.at(-1)!.date,
      opening: r2(opening),
      moneyIn: r2(moneyIn),
      moneyOut: r2(moneyOut),
      closing: r2(closing),
      reconciles: Math.abs(opening + moneyIn - moneyOut - closing) < 0.01,
    };
  }

  return out.sales || out.purchases || out.bank ? out : null;
}
