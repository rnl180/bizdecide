import type { Decision } from "./types";

export type ImpactKind = "monthly" | "one_off" | "financing";

type Impactful = Pick<Decision, "impactRm" | "impactType" | "title" | "action">;

/**
 * What kind of money a decision's impactRm is. Briefs delivered before impactType existed
 * don't say, so infer it from the wording: a loan or grant is funding, a recovery is one-off.
 */
export function impactKind(d: Impactful): ImpactKind {
  if (d.impactType) return d.impactType;
  const text = `${d.title} ${d.action}`.toLowerCase();
  if (/\b(fund|funding|financ\w*|loan|grant|pinjaman|pembiayaan|geran)\b/.test(text)) return "financing";
  if (/\b(recover|reclaim|refund|one[- ](off|time)|claim back|tuntut)/.test(text)) return "one_off";
  return "monthly";
}

/** Totals per kind. Only "monthly" is a recurring gain; never add the others to it. */
export function impactTotals(decisions: Impactful[]) {
  const totals: Record<ImpactKind, number> = { monthly: 0, one_off: 0, financing: 0 };
  for (const d of decisions) if (d.impactRm && d.impactRm > 0) totals[impactKind(d)] += d.impactRm;
  return totals;
}

/** "+RM82/mo", "+RM954 one-off", "RM40,000 funding"; fmt formats money in the market's currency. */
export function impactLabel(d: Impactful, fmt: (n: number) => string): string {
  if (!d.impactRm) return "";
  const kind = impactKind(d);
  if (kind === "financing") return `${fmt(d.impactRm)} funding`;
  const sign = d.impactRm > 0 ? "+" : "−";
  return kind === "one_off" ? `${sign}${fmt(d.impactRm)} one-off` : `${sign}${fmt(d.impactRm)}/mo`;
}
