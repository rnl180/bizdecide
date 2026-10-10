// Builds the app's demo payload from the research pack in demo/kedai-kopi-aminah/.
// Output: public/demo/kedai-kopi-aminah.json + sample CSVs (sales, purchases, suppliers, bank).
// Run: node scripts/build-demo-from-pack.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "demo/kedai-kopi-aminah";

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some((x) => x !== "")) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== "")) rows.push(row);
  const [h, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
}
const read = (p) => parseCsv(readFileSync(`${SRC}/${p}`, "utf8"));
const num = (v) => (v === "" || v == null ? undefined : Number(v));

const p = JSON.parse(readFileSync(`${SRC}/business_profile.json`, "utf8"));

const profile = {
  name: p.business_name,
  sector: "F&B",
  state: p.state,
  employeesFullTime: p.full_time_employees,
  annualSalesDeclaredRm: p.annual_sales_declared_rm,
  ssmNumber: p.ssm_registration_no,
  registeredSince: p.registered_on?.slice(0, 7),
  ownershipFlags: [p.owner?.bumiputera && "bumiputera", p.owner?.gender === "female" && "women_owned"].filter(Boolean),
  goal: p.stated_goal,
};

// Extra facts the agent needs (owner age, household income unknown on purpose, etc.)
const profileExtras = {
  legalForm: p.legal_form,
  registeredOn: p.registered_on,
  city: p.city,
  owner: p.owner,
  sectorDetail: p.sector,
  premises: p.premises,
  pos: p.pos,
  accountingToday: p.accounting_today,
  householdIncomeMonthlyRm: p.household_income_monthly_rm, // null: agent must ASK
  existingFinancing: p.existing_financing,
  workingOwnerExcludedFromCount: p.working_owner_excluded_from_count,
};

// Closed days (Mondays, Hari Raya) stay in with RM0 and their note, so the Raya dip shows in the sales series.
const sales = read("sales_daily_2025-10_to_2026-09.csv")
  .map((r) => ({
    period: r.date,
    amountRm: num(r.total_rm),
    channel: "all",
    cashRm: num(r.cash_rm),
    duitnowQrRm: num(r.duitnow_qr_rm),
    cardRm: num(r.card_rm),
    deliveryGrossRm: num(r.delivery_platform_gross_rm),
    transactions: num(r.transactions),
    ...(r.note ? { note: r.note } : {}),
  }));

const purchases = read("invoices/_index_ground_truth.csv").map((r) => ({
  date: r.date,
  invoiceNo: r.invoice_no,
  supplier: r.supplier,
  item: r.item,
  qty: num(r.qty),
  unit: r.unit,
  unitPriceRm: num(r.unit_price_rm),
  totalRm: num(r.line_total_rm),
  invoiceTotalRm: num(r.invoice_total_rm),
  file: r.file,
}));

const suppliers = read("suppliers.csv").map((r) => ({
  id: r.supplier_id,
  name: r.name,
  category: r.products,
  contact: r.contact,
  paymentTerms: r.payment_terms,
  notifiedPriceChange: r.notified_price_change,
}));

const bank = read("bank/bank_statement_2026-09.csv").map((r) => ({
  date: r.date,
  description: r.description,
  reference: r.reference || undefined,
  debitRm: num(r.debit_rm),
  creditRm: num(r.credit_rm),
  balanceRm: num(r.balance_rm),
}));

const payables = read("payables_ledger.csv").map((r) => ({
  invoiceNo: r.invoice_no,
  supplier: r.supplier,
  invoiceDate: r.invoice_date,
  amountRm: num(r.amount_rm),
  paidDate: r.paid_date,
  method: r.method,
}));

mkdirSync("public/demo", { recursive: true });
writeFileSync(
  "public/demo/kedai-kopi-aminah.json",
  JSON.stringify({ disclaimer: p.DISCLAIMER, profile, profileExtras, sales, purchases, suppliers, bank, payables }, null, 2),
);

const toCsv = (rows) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => (v == null ? "" : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};
writeFileSync("public/demo/sales.csv", toCsv(sales));
writeFileSync("public/demo/purchases.csv", toCsv(purchases));
writeFileSync("public/demo/suppliers.csv", toCsv(suppliers));
writeFileSync("public/demo/bank.csv", toCsv(bank));

const total = sales.reduce((s, x) => s + x.amountRm, 0);
const open = sales.filter((x) => x.amountRm > 0).length;
console.log(`sales days ${sales.length}, ${open} open (RM${total.toFixed(2)}), purchase lines ${purchases.length}, suppliers ${suppliers.length}, bank rows ${bank.length}, payables ${payables.length}`);
