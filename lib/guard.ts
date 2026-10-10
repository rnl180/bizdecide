import { NextResponse } from "next/server";
import path from "node:path";
import type { BusinessInput } from "./types";

/**
 * Small request guards shared by the public API routes: per-IP rate limits,
 * upload-path checks and sanity limits on uploaded business data.
 * In-memory on purpose: production is one Node process behind Nginx.
 */

// ---------- client IP ----------

/** Nginx sets X-Real-IP (and X-Forwarded-For). Without a proxy (laptop) everything is "local". */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.split(",")[0]?.trim();
  if (real) return real.slice(0, 64);
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd.slice(0, 64);
  return "local";
}

// ---------- rate limit ----------

type Hits = { times: number[]; windowMs: number };

const MAX_KEYS = 10_000; // (bucket, ip) pairs kept in memory
const PRUNE_EVERY_MS = 60_000;

// On globalThis so every route bundle (and dev hot reloads) share one table.
const state = ((globalThis as Record<symbol, unknown>)[Symbol.for("bizdecide.rateLimit")] ??= {
  hits: new Map<string, Hits>(),
  lastPrune: 0,
}) as { hits: Map<string, Hits>; lastPrune: number };

function prune(now: number) {
  state.lastPrune = now;
  for (const [key, h] of state.hits) {
    const newest = h.times[h.times.length - 1] ?? 0;
    if (now - newest >= h.windowMs) state.hits.delete(key);
  }
  // Still full (many distinct IPs inside one window): drop the oldest keys.
  if (state.hits.size >= MAX_KEYS) {
    let drop = state.hits.size - Math.floor(MAX_KEYS * 0.9);
    for (const key of state.hits.keys()) {
      if (drop-- <= 0) break;
      state.hits.delete(key);
    }
  }
}

/**
 * Sliding-window limit of `limit` requests per `windowSeconds` for each (bucket, client IP).
 * Returns null when allowed, or a 429 response to return as-is.
 */
export function rateLimit(req: Request, bucket: string, limit: number, windowSeconds: number): NextResponse | null {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  if (now - state.lastPrune > PRUNE_EVERY_MS || state.hits.size >= MAX_KEYS) prune(now);

  const key = `${bucket}:${clientIp(req)}`;
  let h = state.hits.get(key);
  if (!h) {
    h = { times: [], windowMs };
    state.hits.set(key, h);
  }
  h.windowMs = windowMs;
  while (h.times.length && now - h.times[0]! >= windowMs) h.times.shift();

  if (h.times.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((h.times[0]! + windowMs - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  h.times.push(now);
  return null;
}

// ---------- uploaded document paths ----------

// Exactly what /api/upload returns: uploads/<uuid v4>/<name made of [A-Za-z0-9_.-], max 80 chars>.
const UPLOAD_REL = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[\w.\-]{1,80}$/;
// In local store mode (the VPS Docker deploy) /api/upload returns the absolute path under .data/.
const LOCAL_DATA_ROOT = path.join(process.cwd(), ".data") + "/";

/** True only for a path /api/upload could have produced. Never "..", backslashes or other folders. */
export function isUploadPath(p: unknown): p is string {
  if (typeof p !== "string" || p.length > 400) return false;
  if (p.includes("..") || p.includes("\\") || p.includes("\0")) return false;
  const rel = p.startsWith(LOCAL_DATA_ROOT) ? p.slice(LOCAL_DATA_ROOT.length) : p;
  if (rel.startsWith("/")) return false;
  if (!UPLOAD_REL.test(rel)) return false;
  return !/\/\.+$/.test(rel); // file name can't be just dots
}

// ---------- business data sanity checks ----------

const MAX_ROWS = 50_000;
const MAX_SUPPLIERS = 2_000;
const MAX_MONEY = 100_000_000;
const MAX_EMPLOYEES = 100_000;
const MAX_PROBLEMS = 5;
const MIN_DATE = "2000-01-01";
const MONEY_FIELDS = ["amountRm", "totalRm", "unitPriceRm", "debitRm", "creditRm", "balanceRm"] as const;

const show = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v) ?? String(v);
  return `'${s.length > 40 ? s.slice(0, 40) + "…" : s}'`;
};

function isCalendarDate(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Problem with a date value, or null when it's fine. `monthOk` also allows YYYY-MM. */
function dateProblem(v: unknown, maxDate: string, monthOk: boolean): string | null {
  const format = monthOk ? "YYYY-MM or YYYY-MM-DD" : "YYYY-MM-DD";
  const s = typeof v === "string" ? v : "";
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)) && isCalendarDate(+m[1]!, +m[2]!, +m[3]!)) {
    if (s < MIN_DATE || s > maxDate) return `${show(v)} is out of range (${MIN_DATE} to ${maxDate})`;
    return null;
  }
  if (monthOk && (m = s.match(/^(\d{4})-(\d{2})$/)) && +m[2]! >= 1 && +m[2]! <= 12) {
    if (s < MIN_DATE.slice(0, 7) || s > maxDate.slice(0, 7)) return `${show(v)} is out of range (${MIN_DATE.slice(0, 7)} to ${maxDate.slice(0, 7)})`;
    return null;
  }
  return `${show(v)} is not a date (use ${format})`;
}

/**
 * Checks the parsed business data for values no real SME upload has.
 * Returns up to 5 short, human-readable problems; an empty list means OK.
 */
export function validateBusinessData(business: BusinessInput): string[] {
  const problems: string[] = [];
  const full = () => problems.length >= MAX_PROBLEMS;
  const add = (msg: string) => {
    if (!full()) problems.push(msg);
  };
  const maxDate = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10); // today + 1 day (UTC)

  const sales = business.sales ?? [];
  const purchases = business.purchases ?? [];
  const suppliers = business.suppliers ?? [];
  const bank = business.bank ?? [];
  const payables = business.payables ?? [];

  if (!sales.length && !purchases.length) add("Add at least one sales or purchase row");

  const sizes: [string, unknown[], number][] = [
    ["sales", sales, MAX_ROWS],
    ["purchases", purchases, MAX_ROWS],
    ["bank", bank, MAX_ROWS],
    ["payables", payables, MAX_ROWS],
    ["suppliers", suppliers, MAX_SUPPLIERS],
  ];
  for (const [name, rows, max] of sizes) {
    if (rows.length > max) add(`Too many ${name} rows (${rows.length}; max ${max.toLocaleString("en-US")})`);
  }
  if (full()) return problems;

  const emp = business.profile?.employeesFullTime;
  if (typeof emp === "number" && emp > MAX_EMPLOYEES) add(`employeesFullTime ${emp} is too large (max ${MAX_EMPLOYEES.toLocaleString("en-US")})`);
  const declared = business.profile?.annualSalesDeclaredRm;
  if (typeof declared === "number" && !(Math.abs(declared) <= MAX_MONEY)) {
    add(`annualSalesDeclaredRm ${declared} is too large (max ${MAX_MONEY.toLocaleString("en-US")})`);
  }

  const checkMoney = (label: string, row: Record<string, unknown>) => {
    for (const f of MONEY_FIELDS) {
      const v = row[f];
      if (v === undefined || v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) add(`${label}: ${f} ${show(v)} is not a number`);
      else if (Math.abs(v) > MAX_MONEY) add(`${label}: ${f} ${v} is too large (max ${MAX_MONEY.toLocaleString("en-US")})`);
    }
  };
  const checkDate = (label: string, field: string, v: unknown, monthOk = false, optional = false) => {
    if (optional && (v === undefined || v === null || (typeof v === "string" && !v.trim()))) return;
    const p = dateProblem(v, maxDate, monthOk);
    if (p) add(`${label}: ${field} ${p}`);
  };

  for (let i = 0; i < sales.length && !full(); i++) {
    const r = sales[i] as Record<string, unknown>;
    checkDate(`sales row ${i + 1}`, "period", r.period, true);
    checkMoney(`sales row ${i + 1}`, r);
  }
  for (let i = 0; i < purchases.length && !full(); i++) {
    const r = purchases[i] as Record<string, unknown>;
    checkDate(`purchases row ${i + 1}`, "date", r.date);
    checkMoney(`purchases row ${i + 1}`, r);
  }
  for (let i = 0; i < bank.length && !full(); i++) {
    const r = bank[i] as Record<string, unknown>;
    checkDate(`bank row ${i + 1}`, "date", r.date);
    checkMoney(`bank row ${i + 1}`, r);
  }
  for (let i = 0; i < payables.length && !full(); i++) {
    const r = payables[i] as Record<string, unknown>;
    checkDate(`payables row ${i + 1}`, "invoiceDate", r.invoiceDate, false, true);
    checkDate(`payables row ${i + 1}`, "paidDate", r.paidDate, false, true);
    checkMoney(`payables row ${i + 1}`, r);
  }
  return problems;
}
