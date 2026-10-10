import MY from "../workbuddy/knowledge/markets/MY/market.json";

/**
 * BizDecide is built for Malaysia: one market pack, workbuddy/knowledge/markets/MY/ (see the README there).
 * The app reads only market.json; the agents read the rest. The pack layout keeps other countries possible
 * later (import its market.json here and add it to PACKS), but nothing outside Malaysia is offered today.
 */
export interface MarketPack {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  currencyName: string; // "ringgit", "dollar": used in marketing copy
  locale: string;
  regionLabel: string;
  regions: string[];
  registry: { name: string; fullName: string; sinceLabel: string };
  ownershipFlags: { id: string; label: string }[];
  ownershipHelp: string;
  demo?: string;
  /** Bahasa Melayu labels for the intake form (optional). */
  ms?: { regionLabel?: string; currencyName?: string; sinceLabel?: string; ownershipFlags?: Record<string, string>; ownershipHelp?: string };
}

/** The pack with its form labels in the owner's language. */
export function localize(pack: MarketPack, lang: "en" | "ms"): MarketPack {
  const t = lang === "ms" ? pack.ms : undefined;
  if (!t) return pack;
  return {
    ...pack,
    regionLabel: t.regionLabel ?? pack.regionLabel,
    currencyName: t.currencyName ?? pack.currencyName,
    registry: { ...pack.registry, sinceLabel: t.sinceLabel ?? pack.registry.sinceLabel },
    ownershipFlags: pack.ownershipFlags.map((f) => ({ ...f, label: t.ownershipFlags?.[f.id] ?? f.label })),
    ownershipHelp: t.ownershipHelp ?? pack.ownershipHelp,
  };
}

const PACKS: MarketPack[] = [MY];

export const MARKETS: { code: string; name: string; pack?: MarketPack }[] = PACKS.map((p) => ({ code: p.code, name: p.name, pack: p }));

export const DEFAULT_MARKET = "MY";
export const marketPack = (code: string | undefined) => PACKS.find((p) => p.code === (code ?? DEFAULT_MARKET));

/** Money in a market's currency, whole units: RM12,345 or S$12,345. Unknown or missing market → Malaysia. */
export function money(market?: string) {
  const p = marketPack(market) ?? marketPack(DEFAULT_MARKET)!;
  return (n: number) => `${p.currencySymbol}${Math.abs(n).toLocaleString(p.locale, { maximumFractionDigits: 0 })}`;
}
