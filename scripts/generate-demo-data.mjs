// Generates the demo business "Rock Cafe" (a fictional café in Petaling Jaya).
// Planted issues the agents should find:
//   1. Ladang Segar Dairy quietly raised milk price ~12% over Aug–Sep 2026
//   2. Invoice KB-0926 from Kopi Borneo Roasters appears twice (duplicate)
//   3. Harvey Norman RM2,399 in Sep is ambiguous (business equipment or personal?) -> live question
//   4. Owner declared RM240,000 annual sales, but uploaded sales add up to more -> SME category check
// Run: node scripts/generate-demo-data.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
// Seasonality: Dec holidays, Mar (Ramadan dip in daytime, Hari Raya bump in Apr)
const salesBase = [23800, 24600, 28900, 24100, 25300, 22400, 27800, 26200, 26900, 27400, 28100, 29300];

const sales = months.map((m, i) => ({ period: m, amountRm: Math.round(salesBase[i] * 1.22 / 10) * 10, channel: "counter + GrabFood" }));

const purchases = [];
let inv = 1000;
const add = (date, supplier, item, qty, unit, unitPriceRm, extra = {}) => {
  const totalRm = Math.round(qty * unitPriceRm * 100) / 100;
  purchases.push({ date, invoiceNo: extra.invoiceNo ?? `INV-${inv++}`, supplier, item, qty, unit, unitPriceRm, totalRm, ...(extra.note ? { note: extra.note } : {}) });
};

months.forEach((m, i) => {
  const vol = salesBase[i] / 26000; // volume scales with sales
  // Milk: steady RM7.20/L, then 7.70 (Aug) and 8.06 (Sep) = +12%
  const milkPrice = m === "2026-08" ? 7.7 : m === "2026-09" ? 8.06 : 7.2;
  add(`${m}-05`, "Ladang Segar Dairy Sdn Bhd", "Fresh milk (1L)", Math.round(300 * vol), "L", milkPrice);
  add(`${m}-19`, "Ladang Segar Dairy Sdn Bhd", "Fresh milk (1L)", Math.round(300 * vol), "L", milkPrice);
  add(`${m}-08`, "Kopi Borneo Roasters", "Arabica house blend", Math.round(40 * vol), "kg", 58, { invoiceNo: `KB-${m.slice(2, 4)}${m.slice(5)}` });
  add(`${m}-03`, "Kedai Runcit Hock Seng", "Sugar (1kg)", 60, "kg", 2.85);
  add(`${m}-03`, "Kedai Runcit Hock Seng", "Condensed milk (can)", 120, "can", 3.9);
  add(`${m}-10`, "PackPro Supplies", "Takeaway cups + lids (pack of 50)", Math.round(36 * vol), "pack", 24.5);
  add(`${m}-01`, "Roti Mesra Bakery", "Bread & buns (weekly standing order)", 4, "week", 310);
  add(`${m}-01`, "Telur Emas Farm", "Eggs (tray of 30)", 30, "tray", 15.5);
  add(`${m}-01`, "Sri Utama Properties", "Shop rent", 1, "month", 3500);
  add(`${m}-15`, "TNB", "Electricity", 1, "month", Math.round(820 + 90 * vol));
  add(`${m}-15`, "Air Selangor", "Water", 1, "month", 95);
  add(`${m}-28`, "Payroll", "Staff salaries (6 full-time)", 1, "month", 10200);
  add(`${m}-28`, "KWSP / PERKESO", "EPF + SOCSO employer contribution", 1, "month", 1480);
});

// Duplicate invoice (same invoice number, same amount, recorded twice)
const dup = purchases.find((p) => p.invoiceNo === "KB-2609");
purchases.push({ ...dup, date: "2026-09-09", note: "uploaded twice?" });

// Ambiguous purchase for the live question
purchases.push({
  date: "2026-09-14",
  invoiceNo: "HN-88213",
  supplier: "Harvey Norman Sunway Pyramid",
  item: "Electrical appliance",
  qty: 1,
  unit: "unit",
  unitPriceRm: 2399,
  totalRm: 2399,
  note: "paid with business account",
});

purchases.sort((a, b) => a.date.localeCompare(b.date));

const suppliers = [
  { name: "Ladang Segar Dairy Sdn Bhd", category: "Dairy", contact: "orders@ladangsegar.example", paymentTerms: "COD" },
  { name: "Kopi Borneo Roasters", category: "Coffee beans", contact: "+60 12-345 6789", paymentTerms: "14 days" },
  { name: "Kedai Runcit Hock Seng", category: "Dry goods", paymentTerms: "Cash" },
  { name: "PackPro Supplies", category: "Packaging", contact: "sales@packpro.example", paymentTerms: "30 days" },
  { name: "Roti Mesra Bakery", category: "Bakery", paymentTerms: "Weekly" },
  { name: "Telur Emas Farm", category: "Eggs", paymentTerms: "Cash" },
];

const business = {
  profile: {
    name: "Rock Cafe",
    sector: "F&B",
    state: "Selangor",
    employeesFullTime: 6,
    ssmNumber: "202301012345 (DEMO)",
    registeredSince: "2023-02",
    annualSalesDeclaredRm: 240000,
    ownershipFlags: ["women_owned", "bumiputera"],
    goal: "Open a second outlet in Subang Jaya next year",
  },
  sales,
  purchases,
  suppliers,
};

mkdirSync("public/demo", { recursive: true });
writeFileSync("public/demo/kedai-kopi-aminah.json", JSON.stringify(business, null, 2));

const toCsv = (rows, cols) =>
  [cols.join(","), ...rows.map((r) => cols.map((c) => (r[c] === undefined ? "" : /[,"]/.test(String(r[c])) ? `"${String(r[c]).replace(/"/g, '""')}"` : r[c])).join(","))].join("\n") + "\n";
writeFileSync("public/demo/sales.csv", toCsv(sales, ["period", "amountRm", "channel"]));
writeFileSync("public/demo/purchases.csv", toCsv(purchases, ["date", "invoiceNo", "supplier", "item", "qty", "unit", "unitPriceRm", "totalRm", "note"]));
writeFileSync("public/demo/suppliers.csv", toCsv(suppliers, ["name", "category", "contact", "paymentTerms"]));

const totalSales = sales.reduce((s, x) => s + x.amountRm, 0);
console.log(`Generated: ${sales.length} months sales (RM${totalSales.toLocaleString()}), ${purchases.length} purchase lines, ${suppliers.length} suppliers`);
