/**
 * One-drop intake: the owner drops every file at once and we work out which is which.
 * Uses the column matching in lib/csv.ts (English and Bahasa Melayu headers), then keeps the extra columns
 * the agents need (DuitNow QR / card / delivery split per day, invoice totals, price-change notes).
 */
import {
  guessMapping,
  missingRequired,
  normalizeDate,
  toBank,
  toPayables,
  toPurchases,
  toSales,
  toSuppliers,
  type CsvKind,
  type Mapping,
  type SaleRow,
} from "./csv";

export const KINDS: CsvKind[] = ["sales", "purchases", "suppliers", "bank", "payables"];

type Row = Record<string, string>;

/** "RM1,234.50", "(12.00)", "1 234,5" → number. */
export function toNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  let s = String(v).trim();
  if (!s) return undefined;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-\s]|RM|MYR/gi, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : undefined;
}

const cols = (rows: Row[]) => Object.keys(rows[0] ?? {});
const findCol = (rows: Row[], ...words: string[]) => {
  const c = cols(rows);
  return words.map((w) => c.find((k) => k === w)).find(Boolean) ?? words.map((w) => c.find((k) => k.includes(w))).find(Boolean);
};
const numericShare = (rows: Row[], col?: string) => {
  if (!col) return 0;
  const vals = rows.map((r) => r[col] ?? "").filter((v) => v !== "").slice(0, 40);
  return vals.length ? vals.filter((v) => toNum(v) !== undefined).length / vals.length : 0;
};

/** Price lists and invoice-line exports often have qty and unit price but no line total: add it. */
function withLineTotals(rows: Row[]): Row[] {
  const m = guessMapping("purchases", rows);
  if (m.totalrm || !m.qty || !m.unitpricerm) return rows;
  return rows.map((r) => {
    const q = toNum(r[m.qty!]);
    const p = toNum(r[m.unitpricerm!]);
    return q !== undefined && p !== undefined ? { ...r, totalrm: String(Math.round(q * p * 100) / 100) } : r;
  });
}

export function prepare(kind: CsvKind, rows: Row[]): Row[] {
  return kind === "purchases" ? withLineTotals(rows) : rows;
}

/** Rows in the app's shape, with the extra columns the agents use. */
export function convertRows(kind: CsvKind, raw: Row[], mapping?: Mapping): unknown[] {
  const rows = prepare(kind, raw);
  if (kind === "sales") return withSalesSplit(toSales(rows, mapping), rows, mapping);
  if (kind === "purchases") return withInvoiceTotals(toPurchases(rows, mapping), rows, mapping);
  if (kind === "suppliers") return withSupplierNotes(toSuppliers(rows, mapping), rows, mapping);
  if (kind === "bank") return toBank(rows, mapping);
  return toPayables(rows, mapping);
}

// Daily sales split by payment channel is what lets the agents check every DuitNow QR / card settlement.
function withSalesSplit(sales: SaleRow[], rows: Row[], mapping?: Mapping): SaleRow[] {
  const dateCol = (mapping ?? guessMapping("sales", rows)).period;
  const split = {
    cashRm: findCol(rows, "cashrm", "cash", "tunai"),
    duitnowQrRm: findCol(rows, "duitnowqrrm", "duitnowqr", "duitnow", "qrpay", "qr"),
    cardRm: findCol(rows, "cardrm", "card", "kad"),
    deliveryGrossRm: findCol(rows, "deliverygrossrm", "deliveryplatformgrossrm", "deliverygross", "delivery", "penghantaran"),
    transactions: findCol(rows, "transactions", "txn", "bills"),
    note: findCol(rows, "note", "notes", "catatan", "remarks"),
  };
  if (!dateCol || !Object.values(split).some(Boolean)) return sales;
  const byDay = new Map<string, Row>();
  for (const r of rows) {
    const d = normalizeDate(r[dateCol] ?? "", "dmy");
    if (d) byDay.set(d, r);
  }
  if (byDay.size < rows.length * 0.9) return sales; // not one row per day: leave as is
  return sales.map((s) => {
    const r = byDay.get(s.period);
    if (!r) return s;
    const extra: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(split)) {
      if (!col) continue;
      if (key === "note") {
        if (r[col]) extra.note = r[col];
      } else {
        const n = toNum(r[col]);
        if (n !== undefined) extra[key] = n;
      }
    }
    return { ...s, ...extra };
  });
}

function withInvoiceTotals(purchases: ReturnType<typeof toPurchases>, rows: Row[], mapping?: Mapping) {
  const invCol = findCol(rows, "invoicetotalrm", "invoicetotal");
  const fileCol = findCol(rows, "file", "invoicefile");
  if (!invCol && !fileCol) return purchases;
  const m = mapping ?? guessMapping("purchases", rows);
  const key = (inv?: string, item?: string) => `${inv ?? ""}|${item ?? ""}`;
  const byKey = new Map(rows.map((r) => [key(m.invoiceno ? r[m.invoiceno] : undefined, m.item ? r[m.item] : undefined), r]));
  return purchases.map((p) => {
    const r = byKey.get(key(p.invoiceNo, p.item));
    if (!r) return p;
    const inv = invCol ? toNum(r[invCol]) : undefined;
    return { ...p, ...(inv !== undefined ? { invoiceTotalRm: inv } : {}), ...(fileCol && r[fileCol] ? { file: r[fileCol] } : {}) };
  });
}

function withSupplierNotes(suppliers: ReturnType<typeof toSuppliers>, rows: Row[], mapping?: Mapping) {
  const noteCol = findCol(rows, "notifiedpricechange", "notified", "pricechange");
  const catCol = findCol(rows, "products", "items", "barang");
  if (!noteCol && !catCol) return suppliers;
  const nameCol = (mapping ?? guessMapping("suppliers", rows)).name;
  const byName = new Map(rows.map((r) => [nameCol ? r[nameCol] : "", r]));
  return suppliers.map((s) => {
    const r = byName.get(s.name);
    if (!r) return s;
    return {
      ...s,
      ...(noteCol && r[noteCol] ? { notifiedPriceChange: r[noteCol] } : {}),
      ...(!s.category && catCol && r[catCol] ? { category: r[catCol] } : {}),
    };
  });
}

const NAME_HINTS: Record<CsvKind, RegExp> = {
  sales: /sale|jualan|pos|revenue|hasil|daily/i,
  purchases: /purchase|belian|invoice|invois|price|harga/i,
  suppliers: /supplier|pembekal|vendor/i,
  bank: /bank|statement|penyata/i,
  payables: /payable|ledger|bills?[-_ ]|paid|bayar|lejar/i,
};

/** Which kind of file this is, best first. Empty when nothing fits (the owner then picks). */
export function detectKind(fileName: string, rows: Row[]): { kind: CsvKind; rows: number; score: number }[] {
  const c = cols(rows);
  const has = (re: RegExp) => c.some((k) => re.test(k));
  const out: { kind: CsvKind; rows: number; score: number }[] = [];
  for (const kind of KINDS) {
    const r = prepare(kind, rows);
    const m = guessMapping(kind, r);
    if (missingRequired(kind, m).length) continue;
    const n = convertRows(kind, rows).length;
    if (!n) continue;
    let score = Object.values(m).filter(Boolean).length * 2 + Math.min(n / Math.max(rows.length, 1), 1) * 2;
    if (NAME_HINTS[kind].test(fileName)) score += 3;
    if (kind === "sales" && has(/cash|tunai|duitnow|qr|card|kad|delivery/)) score += 4;
    if (kind === "sales" && has(/supplier|vendor|pembekal/)) score -= 6;
    if (kind === "bank" && m.balancerm) score += 4;
    if (kind === "bank" && numericShare(r, m.description) > 0.7) score -= 10; // a "description" full of numbers isn't a bank statement
    if (kind === "payables" && (m.paiddate || m.method)) score += 3;
    if (kind === "suppliers" && has(/date|tarikh/)) score -= 4;
    out.push({ kind, rows: n, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------- profile from files ----------

export interface ProfileGuess {
  name?: string;
  sector?: string;
  state?: string;
  employeesFullTime?: number;
  ssmNumber?: string;
  registeredSince?: string;
  ownershipFlags?: string[];
  goal?: string;
  extras?: Record<string, unknown>;
}

const SECTOR_WORDS: [string, RegExp][] = [
  ["F&B", /f\s*&\s*b|food|kopitiam|caf[eé]|restoran|restaurant|makanan|minuman|beverage|catering/i],
  ["Retail", /retail|runcit|kedai runcit|shop|boutique|butik/i],
  ["Manufacturing", /manufactur|pembuatan|factory|kilang/i],
  ["Agriculture", /agri|pertanian|farm|ladang|plantation/i],
  ["Construction", /construct|pembinaan|kontraktor|contractor/i],
  ["Services", /service|perkhidmatan|salon|workshop|bengkel|clinic|klinik|consult/i],
];

export function sectorFromText(text?: string): string | undefined {
  if (!text) return undefined;
  return SECTOR_WORDS.find(([, re]) => re.test(text))?.[0];
}

/** A business_profile.json (SSM-style keys) or an exported BizDecide profile. */
export function profileFromJson(p: Record<string, unknown>): ProfileGuess | null {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const name = s("business_name") ?? s("businessName") ?? s("name");
  if (!name) return null;
  const owner = (p.owner && typeof p.owner === "object" ? p.owner : undefined) as Record<string, unknown> | undefined;
  const registered = s("registered_on") ?? s("registeredOn") ?? s("registeredSince");
  const employees = p.full_time_employees ?? p.employeesFullTime ?? p.employees;
  const flags = [owner?.bumiputera === true && "bumiputera", owner?.gender === "female" && "women_owned"].filter(Boolean) as string[];
  const extras: Record<string, unknown> = {
    legalForm: p.legal_form,
    registeredOn: s("registered_on") ?? s("registeredOn"),
    city: p.city,
    owner,
    sectorDetail: p.sector,
    premises: p.premises,
    pos: p.pos,
    accountingToday: p.accounting_today,
    existingFinancing: p.existing_financing,
    workingOwnerExcludedFromCount: p.working_owner_excluded_from_count,
  };
  if ("household_income_monthly_rm" in p) extras.householdIncomeMonthlyRm = p.household_income_monthly_rm; // null = agent asks
  return {
    name,
    sector: sectorFromText(s("sector")) ?? s("sector"),
    state: s("state"),
    employeesFullTime: typeof employees === "number" ? employees : undefined,
    ssmNumber: s("ssm_registration_no") ?? s("ssmNumber"),
    registeredSince: registered?.slice(0, 7),
    ownershipFlags: Array.isArray(p.ownershipFlags) ? (p.ownershipFlags as string[]) : flags,
    goal: s("stated_goal") ?? s("goal"),
    extras: Object.fromEntries(Object.entries(extras).filter(([, v]) => v !== undefined)),
  };
}

const FNB = /kopi|coffee|teh\b|tea\b|susu|milk|gula|sugar|roti|bread|kaya|ayam|chicken|beras|rice|mee\b|noodle|santan|telur|egg|cawan|cup|lpg|gas memasak/i;

/** Sector from what the business buys: three or more food & drink items → F&B. */
export function sectorFromPurchases(items: string[]): string | undefined {
  return items.filter((i) => FNB.test(i)).length >= 3 ? "F&B" : undefined;
}

// ---------- one-line summaries for the file list ----------

const range = (dates: string[]) => {
  const d = dates.filter(Boolean).sort();
  return d.length ? [d[0]!, d[d.length - 1]!] : undefined;
};

export function summarize(kind: CsvKind, rows: unknown[]) {
  if (kind === "sales") {
    const s = rows as SaleRow[];
    const total = s.reduce((a, x) => a + (x.amountRm || 0), 0);
    const months = new Set(s.map((x) => x.period.slice(0, 7))).size;
    const split = s.some((x) => (x as Record<string, unknown>).duitnowQrRm !== undefined);
    return { count: s.length, months, total, range: range(s.map((x) => x.period)), split };
  }
  if (kind === "purchases") {
    const p = rows as ReturnType<typeof toPurchases>;
    return { count: p.length, suppliers: new Set(p.map((x) => x.supplier)).size, total: p.reduce((a, x) => a + (x.totalRm || 0), 0), range: range(p.map((x) => x.date)) };
  }
  if (kind === "bank") {
    const b = rows as ReturnType<typeof toBank>;
    return { count: b.length, range: range(b.map((x) => x.date)) };
  }
  if (kind === "payables") {
    const b = rows as ReturnType<typeof toPayables>;
    return { count: b.length, total: b.reduce((a, x) => a + (x.amountRm || 0), 0), range: range(b.map((x) => x.paidDate ?? x.invoiceDate ?? "")) };
  }
  return { count: rows.length };
}

/** Sales in the last 12 months of the file: what SME Corp counts as annual turnover. */
export function annualSales(rows: SaleRow[]) {
  const months = [...new Set(rows.map((x) => x.period.slice(0, 7)))].sort().slice(-12);
  const keep = new Set(months);
  return { months: months.length, total: rows.filter((x) => keep.has(x.period.slice(0, 7))).reduce((a, x) => a + (x.amountRm || 0), 0) };
}
