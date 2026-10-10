// Minimal CSV parser (handles quotes and commas inside quotes). Runs in the browser.
export function parseCsv(text: string): Record<string, string>[] {
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
    else if (ch === ",") {
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
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => normalizeKey(h));
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
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

// Accepts flexible column names so owners can upload whatever their POS or Excel exports.
export function toSales(rows: Record<string, string>[]) {
  return rows
    .map((r) => ({
      period: pick(r, "period", "month", "date") ?? "",
      amountRm: num(pick(r, "amountrm", "amount", "sales", "total", "revenue")) ?? NaN,
      channel: pick(r, "channel", "source"),
    }))
    .filter((s) => s.period && Number.isFinite(s.amountRm));
}

export function toPurchases(rows: Record<string, string>[]) {
  return rows
    .map((r) => ({
      date: pick(r, "date", "invoicedate") ?? "",
      invoiceNo: pick(r, "invoiceno", "invoice", "invoicenumber", "ref"),
      supplier: pick(r, "supplier", "vendor", "from") ?? "",
      item: pick(r, "item", "description", "product") ?? "",
      qty: num(pick(r, "qty", "quantity")),
      unit: pick(r, "unit", "uom"),
      unitPriceRm: num(pick(r, "unitpricerm", "unitprice", "price")),
      totalRm: num(pick(r, "totalrm", "total", "amount", "amountrm")) ?? NaN,
      note: pick(r, "note", "notes", "remarks"),
    }))
    .filter((p) => p.date && p.supplier && Number.isFinite(p.totalRm));
}

export function toSuppliers(rows: Record<string, string>[]) {
  return rows
    .map((r) => ({
      name: pick(r, "name", "supplier", "vendor") ?? "",
      category: pick(r, "category", "type"),
      contact: pick(r, "contact", "phone", "email"),
      paymentTerms: pick(r, "paymentterms", "terms"),
    }))
    .filter((s) => s.name);
}
