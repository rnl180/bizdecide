import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BusinessInput, Result } from "./types";

/**
 * Deterministic checks the server applies to every final brief, after the Verifier agent (Claude engine) or
 * submit_results (WorkBuddy). The model words the brief; these rules make sure the honest parts don't depend on it:
 * - notChecked[]: what the data can't show (lane errors, empty tables, the market's not_checkable.json), also added
 *   to verification[] as status "not_checked" so the page lists them without counting them in the score;
 * - the rejected false positive: cash-on-delivery invoices named as checked and not flagged;
 * - confidence: "high" only when the decision's evidence is keyed to rows and rests on no assumption;
 * - application packs: Shariah flag, ladder step and proposed-measure lines from the market pack.
 */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Lang = "en" | "ms";
type Text = Record<Lang, string>;

export interface FinalizeContext {
  market: string;
  language: Lang;
  business: (BusinessInput & { documents?: string[] }) | null; // for empty tables and rows that cover a gap
  laneData?: Record<string, Json>; // the Claude engine's lane outputs, keyed by agent name; WorkBuddy has none
}

const MARKETS = path.join(process.cwd(), "workbuddy", "knowledge", "markets");
const files = new Map<string, Promise<Json | null>>();

/** A market pack JSON file, read once per process. Null when the market has none. */
export function packFile(market: string, name: string): Promise<Json | null> {
  if (!/^[A-Z]{2}$/.test(market)) return Promise.resolve(null);
  const key = `${market}/${name}`;
  if (!files.has(key)) {
    files.set(
      key,
      readFile(path.join(MARKETS, market, name), "utf8").then(
        (t) => JSON.parse(t) as Json,
        () => null,
      ),
    );
  }
  return files.get(key)!;
}

// ---------- what could not be checked ----------

type Gap = { item: string; reason: string };

const LANE_FAILED: Record<Lang, (agent: string, error: string) => Gap> = {
  en: (agent, error) => ({ item: `${agent} checks`, reason: `The ${agent} agent failed, so its checks are missing: ${error}` }),
  ms: (agent, error) => ({ item: `Semakan ${agent}`, reason: `Ejen ${agent} gagal, jadi semakannya tiada: ${error}` }),
};

type Row = Record<string, unknown>;
const TABLES = ["sales", "purchases", "suppliers", "bank", "payables"] as const;

/** True when any of `fields` ("purchases.item") in the uploaded rows matches the pattern. */
function rowsMatch(business: FinalizeContext["business"], fields: string[], pattern: string) {
  if (!business) return false;
  const re = new RegExp(pattern, "i");
  return fields.some((f) => {
    const [table, field] = f.split(".") as [(typeof TABLES)[number], string];
    return ((business[table] ?? []) as Row[]).some((r) => typeof r[field] === "string" && re.test(r[field] as string));
  });
}

export async function notCheckedList(ctx: FinalizeContext): Promise<Gap[]> {
  const lang = ctx.language;
  const out: Gap[] = [];
  for (const [agent, data] of Object.entries(ctx.laneData ?? {})) {
    if (data?.error) out.push(LANE_FAILED[lang](agent, String(data.error).slice(0, 200)));
  }
  const pack = await packFile(ctx.market, "not_checkable.json");
  if (ctx.business) {
    for (const e of (pack?.when_empty ?? []) as { table: (typeof TABLES)[number]; item: Text; reason: Text }[]) {
      if (!(ctx.business[e.table] ?? []).length) out.push({ item: e.item[lang], reason: e.reason[lang] });
    }
  }
  for (const e of (pack?.always ?? []) as { item: Text; reason: Text; unless?: { fields: string[]; pattern: string } }[]) {
    if (e.unless && rowsMatch(ctx.business, e.unless.fields, e.unless.pattern)) continue;
    out.push({ item: e.item[lang], reason: e.reason[lang] });
  }
  const seen = new Set<string>();
  return out.filter((g) => !seen.has(g.item.toLowerCase()) && Boolean(seen.add(g.item.toLowerCase())));
}

// ---------- the false positive the Verifier rejects ----------

const COD_CHECK: Record<Lang, (keys: string) => { check: string; detail: string }> = {
  en: (keys) => ({
    check: `${keys}: cash on delivery, no bank line expected`,
    detail: "Checked against the supplier terms and the payables list: settled in cash when delivered, so not flagged.",
  }),
  ms: (keys) => ({
    check: `${keys}: bayar tunai semasa penghantaran, tiada baris bank dijangka`,
    detail: "Disemak dengan terma pembekal dan senarai bayaran: diselesaikan secara tunai semasa penghantaran, jadi tidak ditanda.",
  }),
};

function codCheck(result: Result, ctx: FinalizeContext) {
  const nd = ctx.laneData?.Reconciliation?.normal_do_not_flag;
  const keys: string[] = nd?.cashOnDeliveryInStatementPeriod?.length ? nd.cashOnDeliveryInStatementPeriod : (nd?.cashOnDeliveryInvoices ?? []);
  if (!keys.length) return;
  const text = JSON.stringify(result.verification).toLowerCase();
  if (keys.some((k) => text.includes(k.toLowerCase()))) return; // the Verifier already named them
  result.verification.push({ ...COD_CHECK[ctx.language](keys.slice(0, 6).join(", ")), passed: true, status: "passed" });
}

// ---------- worded confidence ----------

const DOWNGRADED: Text = {
  en: "Some figures rest on an assumption or are not linked to rows in your files.",
  ms: "Sesetengah angka bergantung pada andaian atau tidak dipautkan kepada baris dalam fail anda.",
};

/** high = every figure keyed to rows, nothing assumed. A decision that claims more is lowered to medium. */
function settleConfidence(result: Result, lang: Lang) {
  for (const d of result.decisions) {
    const keyed = d.evidence.some((e) => e.source);
    const assumed = d.evidence.some((e) => e.basis === "assumption");
    if (!d.confidence) {
      d.confidence = keyed && !assumed ? "high" : "medium";
    } else if (d.confidence === "high" && (!keyed || assumed)) {
      d.confidence = "medium";
      d.confidenceNote = DOWNGRADED[lang];
    }
  }
}

// ---------- funding ladder: matched -> eligible -> document_ready, Shariah flag, proposed measures ----------

/**
 * Facts about each pack that come from the market pack, not the model: the Shariah flag (Y / N; blank stays unknown),
 * the ladder step (never "approved"), the document checklist the Funding lane marked from the data when the Verifier
 * left it empty, and the Budget 2027 lines, always labelled as proposed.
 */
async function settlePacks(result: Result, ctx: FinalizeContext) {
  if (!result.applicationPacks?.length) return;
  const lang = ctx.language;
  const db = await packFile(ctx.market, "funding_db.json");
  const proposed = await packFile(ctx.market, "proposed_measures.json");
  const candidates: Json[] = ctx.laneData?.Funding?.funding?.candidates ?? [];
  for (const p of result.applicationPacks) {
    const row = Array.isArray(db) ? (db as Json[]).find((r) => r.id === p.programId) : undefined;
    const flag = String(row?.shariah ?? "").trim().toUpperCase();
    if (flag.startsWith("Y")) p.shariah = true;
    else if (flag.startsWith("N")) p.shariah = false;
    else delete p.shariah;

    const lane = candidates.find((c) => c.id === p.programId);
    if (!p.checklist.length && lane?.checklist?.length) {
      p.checklist = (lane.checklist as Json[]).map((c) => ({ item: c.item, status: c.status, detail: (lang === "ms" ? c.detailMs : c.detail) || undefined }));
    }
    const allReady = p.checklist.length > 0 && p.checklist.every((c) => c.status === "ready");
    p.ladder = p.verdict === "eligible" ? (allReady ? "document_ready" : "eligible") : "matched";

    const notes = ((proposed?.measures ?? []) as Json[])
      .filter((m) => m.program_ids?.[p.programId])
      .map((m) => `${proposed!.label[lang]}: ${(m.note?.[lang] ?? m.measure).replace("{share}", m.program_ids[p.programId])}`);
    if (notes.length) p.proposedNotes = notes;
    else delete p.proposedNotes;
  }
}

// ---------- all together ----------

/** Applies the server's rules to a final brief in place and returns it. Never throws: a rule that fails is skipped. */
export async function finalizeResult(result: Result, ctx: FinalizeContext): Promise<Result> {
  const step = async (name: string, fn: () => unknown) => {
    try {
      await fn();
    } catch (e) {
      console.error(`[verifier-checks] ${name}`, e);
    }
  };
  // status always matches passed; not_checked stays as the model set it
  for (const v of result.verification) {
    if (v.status !== "not_checked") v.status = v.passed ? "passed" : "failed";
    else v.passed = false;
  }
  await step("cod", () => codCheck(result, ctx));
  await step("confidence", () => settleConfidence(result, ctx.language));
  await step("packs", () => settlePacks(result, ctx));
  await step("notChecked", async () => {
    const gaps = await notCheckedList(ctx);
    result.notChecked = gaps;
    const listed = new Set(result.verification.map((v) => v.check.toLowerCase()));
    for (const g of gaps) {
      if (!listed.has(g.item.toLowerCase())) result.verification.push({ check: g.item, passed: false, status: "not_checked", detail: g.reason });
    }
  });
  return result;
}
