// Minimal CSV parser (handles quotes and separators inside quotes). Runs in the browser.
// Excel in Malaysia often saves with ';' or tabs, so the separator is detected from the header line.
function splitCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, ""); // Excel's byte-order mark
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const first = text.slice(0, text.search(/\r?\n|$/));
  const count = (d: string) => first.split(d).length - 1;
  const best = [",", ";", "\t"].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : ",";
}

export function parseCsv(text: string): Record<string, string>[] {
  return parseCsvTable(text).rows;
}

/** Rows keyed by normalised header, plus the original header labels (for "which column is which?"). */
export function parseCsvTable(text: string): { headers: { key: string; label: string }[]; rows: Record<string, string>[] } {
  const rows = splitCsv(text);
  if (rows.length < 2) return { headers: [], rows: [] };
  const header = rows[0]!.map((h) => normalizeKey(h));
  return {
    headers: rows[0]!.map((label, i) => ({ key: header[i]!, label: label.trim() })).filter((h) => h.key),
    rows: rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()]))),
  };
}

function normalizeKey(h: string) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const num = (v: string | undefined) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v.replace(/rm/i, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
};
const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
  return undefined;
};

export type SaleRow = {
  period: string; // YYYY-MM-DD (or YYYY-MM for monthly figures)
  amountRm: number; // negative for refunds
  channel?: string; // e.g. "dine-in", "takeaway", or the payment method
  payment?: string; // payment method column the bill was paid from, "split" when more than one
  pos?: string; // which POS export the row came from
  refund?: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthOf = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1; // 0 = not a month name

function ymd(year: number, month: number, day: number) {
  const y = year < 100 ? 2000 + year : year;
  const t = new Date(Date.UTC(y, month - 1, day));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== month - 1 || t.getUTCDate() !== day) return undefined;
  return t.toISOString().slice(0, 10);
}

// Turns the date formats POS and Excel exports use into YYYY-MM-DD (YYYY-MM for month-only values).
// Slash dates are day-first, the Malaysian convention, unless order says otherwise.
export function normalizeDate(value: string, order: "dmy" | "mdy" = "dmy"): string | undefined {
  const v = value.trim();
  let m: RegExpMatchArray | null;
  // A timestamp with a time zone (e.g. ...T16:30:00Z) belongs to the Malaysian (UTC+8) calendar day.
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(v)) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t + 8 * 3600_000).toISOString().slice(0, 10);
  }
  if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/))) return ymd(+m[1]!, +m[2]!, +m[3]!);
  if ((m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/)))
    return order === "mdy" ? ymd(+m[3]!, +m[1]!, +m[2]!) : ymd(+m[3]!, +m[2]!, +m[1]!);
  if ((m = v.match(/^(?:[a-z]+,?\s+)?(\d{1,2})[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{4})/i)) && monthOf(m[2]!))
    return ymd(+m[3]!, monthOf(m[2]!), +m[1]!);
  if ((m = v.match(/^(?:[a-z]+,?\s+)?([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i)) && monthOf(m[1]!))
    return ymd(+m[3]!, monthOf(m[1]!), +m[2]!);
  if ((m = v.match(/^(\d{4})-(\d{2})$/)) && +m[2]! >= 1 && +m[2]! <= 12) return v;
  if ((m = v.match(/^([a-z]{3,9})\.?[\s-]+(\d{4})$/i)) && monthOf(m[1]!))
    return `${m[2]}-${String(monthOf(m[1]!)).padStart(2, "0")}`;
  return undefined;
}

// Reads slash dates month-first only when some value can't be day-first (e.g. 09/13/2026).
function dateOrder(values: string[]): "dmy" | "mdy" {
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m && +m[1]! <= 12 && +m[2]! > 12) return "mdy";
  }
  return "dmy";
}

// StoreHub's help centre doesn't name its date column, so use the first column whose values read as dates.
function findDateKey(rows: Record<string, string>[]) {
  const keys = Object.keys(rows[0] ?? {});
  const candidates = [...keys.filter((k) => k.includes("date")), ...keys.filter((k) => !k.includes("date") && /time|day|period|month/.test(k))];
  return candidates.find((k) => {
    const v = rows.find((r) => r[k])?.[k];
    return v !== undefined && normalizeDate(v) !== undefined;
  });
}

const isTrue = (v: string | undefined) => /^(true|yes|y|1)$/i.test((v ?? "").trim());

function channelLabel(v: string | undefined) {
  if (!v) return undefined;
  if (/^dine[\s_-]*in$/i.test(v.trim())) return "dine-in";
  if (/^take[\s_-]*away$/i.test(v.trim())) return "takeaway";
  return v.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

// StoreHub 'Offline Transactions' CSV: one column per payment method, starting at 'Cash'
// (then 'Credit', 'Debit' and any custom methods). Keep only columns that hold numbers.
const NOT_PAYMENT = /^(total|iscancelled|transactiontype|ordertype|type|register|einvoice)/;
function paymentKeys(rows: Record<string, string>[]) {
  const keys = Object.keys(rows[0] ?? {});
  const start = keys.indexOf("cash");
  if (start < 0) return [];
  return keys.slice(start).filter((k) => !NOT_PAYMENT.test(k) && rows.every((r) => !r[k] || num(r[k]) !== undefined));
}
function paidWith(r: Record<string, string>, keys: string[]) {
  const used = keys.filter((k) => (num(r[k]) ?? 0) !== 0);
  return used.length > 1 ? "split" : used[0];
}

export type SalesFormat = "storehub-transactions" | "storehub-sales-over-time" | "generic";

// Recognises a POS export from its headers (as normalised by parseCsv). Columns follow StoreHub's help centre:
// care.storehub.com/en/articles/15898099 (Offline Transactions) and /5726887 (Sales Over Time).
export function detectSalesFormat(rows: Record<string, string>[]): SalesFormat {
  const keys = new Set(Object.keys(rows[0] ?? {}));
  const has = (...k: string[]) => k.every((x) => keys.has(x));
  if (has("iscancelled", "transactiontype", "total")) return "storehub-transactions";
  if (has("totalsales", "netsales") && ["totaldiscount", "servicecharge", "totalsalesreturned", "pax"].some((k) => keys.has(k)))
    return "storehub-sales-over-time";
  return "generic";
}

const isPeriod = (v: string) => /^\d{4}-\d{2}(-\d{2})?$/.test(v);
const validSale = (s: SaleRow) => isPeriod(s.period) && Number.isFinite(s.amountRm);

// Accepts flexible column names so owners can upload whatever their POS or Excel exports.
// StoreHub exports are recognised and mapped to net sales; anything else goes through the generic aliases.
export function toSales(rows: Record<string, string>[], mapping?: Mapping): SaleRow[] {
  const format = detectSalesFormat(rows);
  if (format === "generic" || mapping) {
    const m = applyMapping(rows, mapping ?? guessMapping("sales", rows));
    const order = dateOrder(m.map((r) => r.period ?? ""));
    return m
      .filter((r) => !/^(cancel|void)/i.test(r.status ?? ""))
      .map((r) => ({
        period: normalizeDate(r.period ?? "", order) ?? "",
        amountRm: num(r.amountrm) ?? NaN,
        channel: r.channel || undefined,
      }))
      .filter(validSale);
  }

  const dateKey = findDateKey(rows);
  if (!dateKey) return [];
  const order = dateOrder(rows.map((r) => r[dateKey] ?? ""));
  const period = (r: Record<string, string>) => normalizeDate(r[dateKey] ?? "", order) ?? "";

  // 'Sales Over Time' (Daily): 'Net Sales' = Total Sales - Tax - Service Charge - Rounding - Returns,
  // so discounts and refunds are already out and StoreHub never counts cancelled bills here.
  if (format === "storehub-sales-over-time")
    return rows
      .map((r) => ({
        period: period(r),
        amountRm: num(r.netsales) ?? NaN,
        channel: channelLabel(pick(r, "transactionchannel", "ordertype")),
        pos: "storehub",
      }))
      .filter(validSale);

  // 'Offline Transactions': one row per bill. 'Total' is what the customer paid (after discounts).
  // Drop cancelled (voided) bills; 'Return' rows are listed as positive amounts, so make them negative.
  const payKeys = paymentKeys(rows);
  return rows
    .filter((r) => !isTrue(r.iscancelled) && !/cancel|void/i.test(`${r.type ?? ""} ${r.transactiontype ?? ""}`))
    .map((r) => {
      const refund = /return|refund/i.test(r.transactiontype ?? "");
      const total = num(r.total) ?? NaN;
      const payment = paidWith(r, payKeys);
      return {
        period: period(r),
        amountRm: refund ? -Math.abs(total) : total,
        channel: channelLabel(r.ordertype) ?? payment,
        payment,
        pos: "storehub",
        refund: refund || undefined,
      };
    })
    .filter(validSale);
}

export function toPurchases(rows: Record<string, string>[], mapping?: Mapping) {
  const m = applyMapping(rows, mapping ?? guessMapping("purchases", rows));
  const order = dateOrder(m.map((r) => r.date ?? ""));
  return m
    .map((r) => ({
      date: normalizeDate(r.date ?? "", order) ?? "",
      invoiceNo: r.invoiceno || undefined,
      supplier: r.supplier ?? "",
      item: r.item ?? "",
      qty: num(r.qty),
      unit: r.unit || undefined,
      unitPriceRm: num(r.unitpricerm),
      totalRm: num(r.totalrm) ?? NaN,
      note: pick(r, "note", "notes", "remarks", "catatan"),
    }))
    .filter((p) => isPeriod(p.date) && p.supplier && Number.isFinite(p.totalRm));
}

export function toSuppliers(rows: Record<string, string>[], mapping?: Mapping) {
  return applyMapping(rows, mapping ?? guessMapping("suppliers", rows))
    .map((r) => ({
      name: r.name ?? "",
      category: r.category || undefined,
      contact: r.contact || undefined,
      paymentTerms: r.paymentterms || undefined,
    }))
    .filter((s) => s.name);
}

/** Bank statement lines. Takes debit/credit columns, or one signed amount column (negative = money out). */
export function toBank(rows: Record<string, string>[], mapping?: Mapping) {
  const m = applyMapping(rows, mapping ?? guessMapping("bank", rows));
  const order = dateOrder(m.map((r) => r.date ?? ""));
  return m
    .map((r) => {
      const signed = num(r.amountrm);
      return {
        date: normalizeDate(r.date ?? "", order) ?? "",
        description: r.description ?? "",
        reference: r.reference || undefined,
        debitRm: num(r.debitrm) ?? (signed !== undefined && signed < 0 ? -signed : undefined),
        creditRm: num(r.creditrm) ?? (signed !== undefined && signed > 0 ? signed : undefined),
        balanceRm: num(r.balancerm),
      };
    })
    .filter((b) => isPeriod(b.date) && b.description && (b.debitRm !== undefined || b.creditRm !== undefined || b.balanceRm !== undefined));
}

/** Supplier bills the owner says they paid (invoice, amount, when and how). */
export function toPayables(rows: Record<string, string>[], mapping?: Mapping) {
  const m = applyMapping(rows, mapping ?? guessMapping("payables", rows));
  const order = dateOrder(m.map((r) => r.invoicedate ?? r.paiddate ?? ""));
  return m
    .map((r) => ({
      invoiceNo: r.invoiceno ?? "",
      supplier: r.supplier ?? "",
      invoiceDate: normalizeDate(r.invoicedate ?? "", order),
      amountRm: num(r.amountrm) ?? NaN,
      paidDate: normalizeDate(r.paiddate ?? "", order),
      method: r.method || undefined,
    }))
    .filter((p) => p.invoiceNo && p.supplier && Number.isFinite(p.amountRm));
}

// ---------- Column matching: English and Bahasa Melayu headers ----------

export type CsvKind = "sales" | "purchases" | "suppliers" | "bank" | "payables";
/** Our field key → the file's (normalised) column key. */
export type Mapping = Record<string, string | undefined>;
type Field = { key: string; aliases: string[]; type: "date" | "number" | "text"; required?: boolean };

// Order matters: specific fields first, so e.g. "paid date" isn't taken as the invoice date.
export const FIELDS: Record<CsvKind, Field[]> = {
  sales: [
    { key: "period", aliases: ["period", "date", "month", "day", "tarikh", "bulan", "tempoh", "hari"], type: "date", required: true },
    { key: "amountrm", aliases: ["amountrm", "amount", "netsales", "nett", "totalsales", "sales", "revenue", "total", "jumlahjualan", "jualan", "jumlah", "amaun", "hasil", "pendapatan"], type: "number", required: true },
    { key: "channel", aliases: ["channel", "source", "saluran"], type: "text" },
  ],
  purchases: [
    { key: "date", aliases: ["date", "invoicedate", "tarikh", "tarikhinvois"], type: "date", required: true },
    { key: "supplier", aliases: ["supplier", "vendor", "from", "pembekal", "penjual"], type: "text", required: true },
    { key: "invoiceno", aliases: ["invoiceno", "invoicenumber", "invoice", "ref", "noinvois", "invois", "rujukan"], type: "text" },
    { key: "item", aliases: ["item", "description", "product", "barang", "keterangan", "produk", "perkara"], type: "text" },
    { key: "unitpricerm", aliases: ["unitpricerm", "unitprice", "price", "hargaseunit", "harga"], type: "number" },
    { key: "qty", aliases: ["qty", "quantity", "kuantiti"], type: "number" },
    { key: "unit", aliases: ["unit", "uom"], type: "text" },
    { key: "totalrm", aliases: ["totalrm", "total", "amount", "amountrm", "jumlah", "amaun"], type: "number", required: true },
  ],
  suppliers: [
    { key: "name", aliases: ["name", "supplier", "vendor", "nama", "pembekal"], type: "text", required: true },
    { key: "category", aliases: ["category", "type", "kategori", "jenis"], type: "text" },
    { key: "contact", aliases: ["contact", "phone", "email", "telefon", "emel", "hubungan"], type: "text" },
    { key: "paymentterms", aliases: ["paymentterms", "terms", "termabayaran", "terma"], type: "text" },
  ],
  bank: [
    { key: "date", aliases: ["date", "transactiondate", "postingdate", "tarikh"], type: "date", required: true },
    { key: "description", aliases: ["description", "details", "particulars", "narration", "transaction", "keterangan", "butiran"], type: "text", required: true },
    { key: "reference", aliases: ["reference", "ref", "chequeno", "rujukan"], type: "text" },
    { key: "debitrm", aliases: ["debitrm", "debit", "withdrawal", "moneyout", "dr", "pengeluaran", "keluar"], type: "number" },
    { key: "creditrm", aliases: ["creditrm", "credit", "deposit", "moneyin", "cr", "kredit", "masuk", "simpanan"], type: "number" },
    { key: "balancerm", aliases: ["balancerm", "balance", "baki"], type: "number" },
    { key: "amountrm", aliases: ["amountrm", "amount", "amaun", "jumlah"], type: "number" },
  ],
  payables: [
    { key: "invoiceno", aliases: ["invoiceno", "invoicenumber", "invoice", "noinvois", "invois"], type: "text", required: true },
    { key: "paiddate", aliases: ["paiddate", "paymentdate", "datepaid", "tarikhbayar", "tarikhdibayar"], type: "date" },
    { key: "invoicedate", aliases: ["invoicedate", "date", "tarikhinvois", "tarikh"], type: "date" },
    { key: "supplier", aliases: ["supplier", "vendor", "pembekal"], type: "text", required: true },
    { key: "amountrm", aliases: ["amountrm", "amount", "total", "jumlah", "amaun"], type: "number", required: true },
    { key: "method", aliases: ["method", "paymentmethod", "kaedahbayaran", "kaedah"], type: "text" },
  ],
};

function looksLike(rows: Record<string, string>[], col: string, type: Field["type"]) {
  if (type === "text") return true;
  const vals = rows.map((r) => r[col] ?? "").filter((v) => v !== "").slice(0, 50);
  if (!vals.length) return false;
  const ok = vals.filter((v) => (type === "number" ? num(v) !== undefined : normalizeDate(v) !== undefined)).length;
  return ok / vals.length >= 0.7;
}

/** Best guess of which column holds each field: exact header names first, then headers containing a known word. */
export function guessMapping(kind: CsvKind, rows: Record<string, string>[]): Mapping {
  const cols = Object.keys(rows[0] ?? {});
  const taken = new Set<string>();
  const out: Mapping = {};
  for (const f of FIELDS[kind]) {
    const col = f.aliases.map((a) => cols.find((c) => c === a && !taken.has(c))).find(Boolean);
    if (col) (out[f.key] = col), taken.add(col);
  }
  for (const f of FIELDS[kind]) {
    if (out[f.key]) continue;
    const col = f.aliases
      .map((a) => cols.find((c) => !taken.has(c) && c.includes(a) && looksLike(rows, c, f.type)))
      .find(Boolean);
    if (col) (out[f.key] = col), taken.add(col);
  }
  return out;
}

/** Copies each mapped column onto our field key, so the converters can read r.period, r.amountrm, ... */
export function applyMapping(rows: Record<string, string>[], mapping: Mapping): Record<string, string>[] {
  const pairs = Object.entries(mapping).filter((e): e is [string, string] => Boolean(e[1]));
  return rows.map((r) => {
    const out = { ...r };
    for (const [field, col] of pairs) out[field] = r[col] ?? "";
    return out;
  });
}

export const missingRequired = (kind: CsvKind, mapping: Mapping) => FIELDS[kind].filter((f) => f.required && !mapping[f.key]).map((f) => f.key);

// ---------- Sanity checks shown to the owner (they don't block the upload) ----------

export type DataWarning = { code: "negative" | "duplicate" | "outlier" | "future"; count: number; example?: number };

/** items: one entry per row with its date (YYYY-MM[-DD]), amount, and a key that identifies an exact duplicate. */
export function dataWarnings(items: { date: string; amount: number; key: string; refund?: boolean }[]): DataWarning[] {
  const out: DataWarning[] = [];
  const negative = items.filter((x) => x.amount < 0 && !x.refund).length;
  if (negative) out.push({ code: "negative", count: negative });
  const seen = new Map<string, number>();
  for (const x of items) seen.set(x.key, (seen.get(x.key) ?? 0) + 1);
  const dupes = [...seen.values()].reduce((s, n) => s + (n > 1 ? n - 1 : 0), 0);
  if (dupes) out.push({ code: "duplicate", count: dupes });
  const pos = items.map((x) => x.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const median = pos[Math.floor(pos.length / 2)] ?? 0;
  const big = items.filter((x) => median > 0 && pos.length >= 3 && x.amount > Math.max(20 * median, 10_000));
  if (big.length) out.push({ code: "outlier", count: big.length, example: Math.max(...big.map((x) => x.amount)) });
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const future = items.filter((x) => (x.date.length === 7 ? x.date > today.slice(0, 7) : x.date > today)).length;
  if (future) out.push({ code: "future", count: future });
  return out;
}
