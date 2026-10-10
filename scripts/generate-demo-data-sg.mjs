// Generates the Singapore demo business "Mei Ling Kopi & Toast" (FICTIONAL kopitiam-style café in Tampines).
// Same top-level keys and row shapes as public/demo/kedai-kopi-aminah.json. profile.market = "SG".
// Money fields keep their *Rm names but hold SGD (see workbuddy/knowledge/markets/README.md).
// duitnowQrRm holds SGQR/PayNow QR sales: the key is kept so the existing skills read it unchanged.
//
// Planted findings (answer key: docs/ANSWER_KEY_SG.md):
//   1. Sin Hock Dairy raises evaporated creamer from S$62.40 to S$69.60 a carton (+11.5%) in three quiet steps, Jul–Sep 2026.
//   2. Chop Seng Huat invoice CSH 4480 (S$448.70) is paid twice: 17 Sep (FAST) and 18 Sep (PayNow). Ledger shows it once.
//   3. EEG near-miss: a 30% deposit (S$2,223.60) was paid to the chiller vendor on 21 Sep 2026, before any
//      Energy Efficiency Grant application. EEG treats that as retrospective, so the chiller loses up to S$4,760 of grant.
//
// Deterministic: fixed seed, no Date.now(). Run: node scripts/generate-demo-data-sg.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const SLUG = "mei-ling-kopi-toast";
const OUT = "public/demo/sg";

// ---------- deterministic helpers ----------
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260930);
const jitter = (pct) => 1 + (rnd() * 2 - 1) * pct;
const r2 = (x) => Math.round(x * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const day = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const ddmmyy = (d) => iso(d).slice(8, 10) + iso(d).slice(5, 7) + iso(d).slice(2, 4);
const ddmm = (d) => iso(d).slice(8, 10) + iso(d).slice(5, 7);
const dow = (d) => d.getUTCDay(); // 0 Sun .. 6 Sat

// ---------- 1. daily sales, 1 Oct 2025 – 30 Sep 2026 ----------
// Closed every Tuesday (rest day) and 16–19 Feb 2026 (Chinese New Year falls on Tue 17 Feb 2026).
const CNY_CLOSED = new Set(["2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19"]);
const MONTH_FACTOR = { "2025-10": 1.0, "2025-11": 0.98, "2025-12": 1.06, "2026-01": 1.03, "2026-02": 0.93, "2026-03": 0.97, "2026-04": 1.0, "2026-05": 1.01, "2026-06": 0.97, "2026-07": 1.02, "2026-08": 1.04, "2026-09": 1.03 };
const DOW_FACTOR = { 0: 1.2, 1: 0.9, 3: 0.92, 4: 0.95, 5: 1.05, 6: 1.25 };
const BASE_DAY = 1250;

const sales = [];
for (let d = day("2025-10-01"); d <= day("2026-09-30"); d = addDays(d, 1)) {
  const s = iso(d);
  if (dow(d) === 2 || CNY_CLOSED.has(s)) continue;
  let note;
  let f = MONTH_FACTOR[s.slice(0, 7)] * DOW_FACTOR[dow(d)];
  if (s >= "2026-02-09" && s <= "2026-02-15") { f *= 1.18; note = "Pre-CNY rush"; }
  if (s >= "2026-02-20" && s <= "2026-02-22") { f *= 0.7; note = "CNY week, shorter hours"; }
  const amount = r2(BASE_DAY * f * jitter(0.06));
  const qr = r2(amount * 0.34 * jitter(0.08));
  const card = r2(amount * 0.2 * jitter(0.1));
  const delivery = r2(amount * 0.2 * jitter(0.12));
  const cash = r2(amount - qr - card - delivery);
  sales.push({
    period: s, amountRm: amount, channel: "all", cashRm: cash, duitnowQrRm: qr, cardRm: card, deliveryGrossRm: delivery,
    transactions: Math.round(amount / (7.6 * jitter(0.05))), ...(note ? { note } : {}),
  });
}
const saleOn = Object.fromEntries(sales.map((x) => [x.period, x]));

// ---------- 2. suppliers ----------
const S = {
  S01: { id: "S01", name: "Chop Seng Huat Coffee Powder (fictional)", short: "CHOP SENG HUAT", category: "Kopi powder, teh dust, chocolate malt powder", contact: "Mr. Ong (sales) | orders@senghuat.example | +65-0000-0101 (fictional)", paymentTerms: "7 days, bank transfer", notifiedPriceChange: "No" },
  S02: { id: "S02", name: "Sin Hock Dairy Trading (fictional)", short: "SIN HOCK DAIRY", category: "Evaporated creamer, sweetened condensed creamer, fresh milk", contact: "Ms. Lee | sales@sinhockdairy.example | +65-0000-0102 (fictional)", paymentTerms: "7 days, bank transfer", notifiedPriceChange: "No" },
  S03: { id: "S03", name: "Wah Sing Bakery (fictional)", short: "WAH SING BAKERY", category: "Bread loaves, kaya, butter (daily delivery, fortnightly bill)", contact: "Uncle Lim | +65-0000-0103 (fictional)", paymentTerms: "Cash on billing", notifiedPriceChange: "No" },
  S04: { id: "S04", name: "Ah Kow Eggs & Provisions (fictional)", short: "AH KOW EGGS", category: "Eggs, sugar, margarine", contact: "Ah Kow | ahkow@provisions.example | +65-0000-0104 (fictional)", paymentTerms: "14 days, bank transfer", notifiedPriceChange: "No" },
  S05: { id: "S05", name: "Lim Packaging Supplies (fictional)", short: "LIM PACKAGING", category: "Takeaway cups, drink bags, straws", contact: "Ms. Priya | sales@limpack.example | +65-0000-0105 (fictional)", paymentTerms: "7 days, bank transfer", notifiedPriceChange: "No" },
  S06: { id: "S06", name: "CoolServe Refrigeration Pte Ltd (fictional)", short: "COOLSERVE REFRIGERATION", category: "Commercial refrigeration equipment (one-off order)", contact: "Mr. Rizal | quotes@coolserve.example | +65-0000-0106 (fictional)", paymentTerms: "30% deposit on order, balance on delivery", notifiedPriceChange: "n/a" },
};

// ---------- 3. purchase invoices, mid-Jun to Sep 2026 ----------
const purchases = [];
const payables = [];
function invoice(date, sup, invoiceNo, lines, payDays, method) {
  const rows = lines.map(([item, qty, unit, price]) => ({ item, qty, unit, unitPriceRm: price, totalRm: r2(qty * price) }));
  const total = r2(rows.reduce((a, x) => a + x.totalRm, 0));
  for (const x of rows) purchases.push({ date, invoiceNo, supplier: sup.name, ...x, invoiceTotalRm: total, file: null });
  payables.push({ invoiceNo, supplier: sup.name, invoiceDate: date, amountRm: total, paidDate: iso(addDays(day(date), payDays)), method });
  return total;
}

// S01 coffee powder: fortnightly Thursdays, prices flat
["2026-06-18", "2026-07-02", "2026-07-16", "2026-07-30", "2026-08-13", "2026-08-27", "2026-09-10", "2026-09-24"].forEach((d, i) =>
  invoice(d, S.S01, `CSH ${4402 + i * 13 + (i % 3)}`, [
    ["Kopi powder Nanyang roast 1kg", 20, "kg", 14.8],
    ["Teh dust 1kg", 6, "kg", 11.5],
    ["Chocolate malt powder 2kg", 3, "tin", 27.9],
  ], d === "2026-09-24" ? 6 : 7, "transfer"));

// S02 dairy: fortnightly Wednesdays. PLANTED #1: evaporated creamer creeps 62.40 -> 64.80 -> 67.20 -> 69.60 (+11.5%)
const creamer = { "2026-06-17": 62.4, "2026-07-01": 62.4, "2026-07-15": 64.8, "2026-07-29": 64.8, "2026-08-12": 67.2, "2026-08-26": 67.2, "2026-09-09": 69.6, "2026-09-23": 69.6 };
Object.entries(creamer).forEach(([d, price], i) =>
  invoice(d, S.S02, `SHD/26/0${388 + i * 14}`, [
    ["Evaporated creamer 390g (carton of 48)", 4, "carton", price],
    ["Sweetened condensed creamer 1kg (carton of 12)", 2, "carton", 46.8],
    ["Fresh milk 1L (case of 12)", 2, "case", 32.4],
  ], 7, "transfer"));

// S03 bakery: fortnightly bill on Saturdays, paid cash on billing (normal: no bank line)
["2026-06-20", "2026-07-04", "2026-07-18", "2026-08-01", "2026-08-15", "2026-08-29", "2026-09-12", "2026-09-26"].forEach((d, i) =>
  invoice(d, S.S03, `WSB-${1120 + i * 2}`, [
    ["White bread loaf (kaya toast)", 168, "loaf", 2.1],
    ["Kaya 1kg", 6, "tub", 9.5],
    ["Butter 250g", 14, "block", 4.6],
  ], 0, "cash"));

// S04 eggs & provisions: fortnightly Mondays, 14 days
["2026-06-22", "2026-07-06", "2026-07-20", "2026-08-03", "2026-08-17", "2026-08-31", "2026-09-14"].forEach((d, i) =>
  invoice(d, S.S04, `AK/26/${String(711 + i * 9).padStart(4, "0")}`, [
    ["Eggs (tray of 30)", 24, "tray", 7.8],
    ["Fine sugar 10kg", 2, "bag", 16.9],
    ["Margarine 2kg", 2, "tub", 13.5],
  ], 14, "transfer"));

// S05 packaging: monthly
["2026-07-06", "2026-08-05", "2026-09-04"].forEach((d) =>
  invoice(d, S.S05, `LPS${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}`, [
    ["Takeaway cup 12oz + lid (pack of 50)", 20, "pack", 4.2],
    ["Drink takeaway bag (1kg)", 4, "kg", 6.8],
    ["Straws (pack of 100)", 10, "pack", 1.9],
  ], 7, "transfer"));

// S06 PLANTED #3: 30% deposit on the chiller, paid by PayNow on 21 Sep 2026, before any EEG application.
const CHILLER = { quoteNo: "CS-Q-2609-114", exGst: 6800 };
CHILLER.gst = r2(CHILLER.exGst * 0.09);
CHILLER.total = r2(CHILLER.exGst + CHILLER.gst);
CHILLER.deposit = r2(CHILLER.total * 0.3);
invoice("2026-09-21", S.S06, "CSR-DI-2609-114", [
  [`30% deposit: 2-door upright chiller, inverter (quote ${CHILLER.quoteNo}, S$6,800 + GST)`, 1, "deposit", CHILLER.deposit],
], 0, "transfer (PayNow)");

purchases.sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
payables.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNo.localeCompare(b.invoiceNo));

// ---------- 4. bank statement, September 2026 ----------
const START = day("2026-09-01"), END = day("2026-09-30");
const tx = []; // {date, order, description, reference, debitRm|creditRm}
const credit = (date, description, reference, amt, order = 1) => tx.push({ date, order, description, reference, creditRm: r2(amt) });
const debit = (date, description, reference, amt, order = 2) => tx.push({ date, order, description, reference, debitRm: r2(amt) });

// QR and card/NETS settle T+1 (card net of 1.6% MDR); sales from 31 Aug to 29 Sep land inside September
for (let d = day("2026-08-31"); d < END; d = addDays(d, 1)) {
  const x = saleOn[iso(d)];
  if (!x) continue;
  const settle = iso(addDays(d, 1));
  const ref = `26${iso(d).slice(5, 7)}${iso(d).slice(8, 10)}`;
  credit(settle, `SGQR MERCHANT SETTLEMENT ${ddmmyy(d)}`, `QR${ref}`, x.duitnowQrRm);
  credit(settle, `NETS/CARD MERCHANT SETTLEMENT ${ddmmyy(d)} NET MDR`, `CM${ref}`, x.cardRm * 0.984);
}
// Delivery platform pays 70% of gross every Wednesday for the week ending the previous Sunday
for (let d = START; d <= END; d = addDays(d, 1)) {
  if (dow(d) !== 3) continue;
  const we = addDays(d, -3);
  let gross = 0;
  for (let k = 0; k < 7; k++) gross += saleOn[iso(addDays(we, -k))]?.deliveryGrossRm ?? 0;
  credit(iso(d), `FOOD DELIVERY PLATFORM PAYOUT W/E ${ddmm(we)}`, `FDP${ddmm(d)}`, gross * 0.7, 0);
}
// Cash banked on Mondays, Thursdays and Saturdays: 85% of cash takings since the last deposit, rounded down to S$10
let cashPool = 0;
for (let d = day("2026-08-29"); d <= END; d = addDays(d, 1)) {
  cashPool += saleOn[iso(d)]?.cashRm ?? 0;
  if (d >= START && [1, 4, 6].includes(dow(d))) {
    const amt = Math.floor((cashPool * 0.85) / 10) * 10;
    credit(iso(d), "CASH DEPOSIT CDM TAMPINES", `CDM${ddmm(d)}`, amt, 0);
    cashPool = 0;
  }
}
// Fixed costs
debit("2026-09-01", "FAST TRF RENT SEP2026 KOH PROPERTY HOLDINGS (DEMO)", "RENT0926", 5800, 0);
debit("2026-09-07", "GIRO FIBRE BROADBAND SEP2026", "NET0926", 58.85);
debit("2026-09-10", "GIRO UTILITIES ELEC/WATER/GAS AUG2026", "UTIL0826", 1386.4);
debit("2026-09-14", "CPF CONTRIBUTION AUG2026 (INCL SDL)", "CPF0826", 2724.0); // 3 local staff + SDL for all 4
debit("2026-09-25", "PAYNOW TRF TAN MEI LING (OWNER DRAWING)", "OWN0925", 3000);
[["A", 2080], ["B", 1920], ["C", 1840], ["D", 1900]].forEach(([s, amt], i) => debit("2026-09-28", `SALARY SEP2026 STAFF ${s}`, `SAL09${i + 1}`, amt, 3));
// Supplier payments from the payables ledger (cash ones never touch the bank)
for (const p of payables) {
  if (!p.paidDate.startsWith("2026-09") || p.method === "cash") continue;
  const sup = Object.values(S).find((s) => s.name === p.supplier);
  const mmdd = ddmm(day(p.paidDate)).slice(2) + ddmm(day(p.paidDate)).slice(0, 2);
  if (p.method.includes("PayNow")) debit(p.paidDate, `PAYNOW TRF ${sup.short} DEPOSIT INV ${p.invoiceNo}`, `PN${mmdd}${sup.id}`, p.amountRm);
  else debit(p.paidDate, `FAST TRF ${sup.short} INV ${p.invoiceNo}`, `FAST${mmdd}${sup.id}`, p.amountRm);
}
// PLANTED #2: the 10 Sep coffee-powder invoice is paid again the day after its normal payment
const dupInv = payables.find((p) => p.supplier === S.S01.name && p.invoiceDate === "2026-09-10");
const dupDate = addDays(day(dupInv.paidDate), 1);
debit(iso(dupDate), `PAYNOW TRF ${S.S01.short} ${dupInv.invoiceNo.replace(" ", "")}`, `PN${iso(dupDate).slice(5, 7)}${iso(dupDate).slice(8, 10)}S01`, dupInv.amountRm);

tx.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || (a.creditRm ? 0 : 1) - (b.creditRm ? 0 : 1) || a.description.localeCompare(b.description));
const OPENING = 24300;
let bal = OPENING;
// same key order as the MY demo: date, description, reference, debitRm, creditRm, balanceRm (undefined keys drop out of the JSON)
const bank = [{ date: "2026-09-01", description: "OPENING BALANCE", reference: undefined, debitRm: undefined, creditRm: undefined, balanceRm: OPENING }];
for (const t of tx) {
  bal = r2(bal + (t.creditRm ?? 0) - (t.debitRm ?? 0));
  bank.push({ date: t.date, description: t.description, reference: t.reference, debitRm: t.debitRm, creditRm: t.creditRm, balanceRm: bal });
}

// ---------- 5. profile ----------
const disclaimer = "Fictional business created for a hackathon demo. All names, numbers, licence numbers and IDs are invented. Any resemblance to a real business is accidental.";
const profile = {
  market: "SG",
  name: "Mei Ling Kopi & Toast",
  sector: "F&B",
  state: "East",
  employeesFullTime: 4,
  ssmNumber: "53999999X (FICTIONAL UEN)",
  registeredSince: "2019-06",
  ownershipFlags: ["local_30"],
  goal: "S$15,000 for a new energy-efficient drinks chiller and an automated dishwasher, plus a cash buffer for higher electricity and supply costs. Wants to use the Energy Efficiency Grant and EDGE.",
};
const profileExtras = {
  legalForm: "Sole proprietorship (registered with ACRA under the Business Names Registration Act 2014)",
  registeredOn: "2019-06-03",
  city: "Tampines (HDB town), East Region",
  owner: { name: "Tan Mei Ling (fictional)", gender: "female", age: 46, citizenship: "Singapore Citizen" },
  localShareholdingPct: 100,
  sectorDetail: "Services - F&B (kopitiam-style café: kopi, teh, kaya toast, half-boiled eggs)",
  ssic: "56 (Food and beverage service activities)",
  sfaLicence: "SFA food shop licence, valid (licence no. DEMO-0000, fictional)",
  premises: "Rented HDB shop unit (not home-based, not a hawker centre stall), S$5,800/month, tenancy to Jun 2028",
  pos: "POS with SGQR/PayNow, NETS and card terminal; one food-delivery platform",
  accountingToday: "Spreadsheet + photos of invoices; accountant once a year for the owner's income tax",
  staff: [
    { id: "A", role: "Drinks (kopi/teh)", residency: "Singapore Citizen", since: "2019-07", cpf: true },
    { id: "B", role: "Kitchen (toast, eggs)", residency: "Singapore Permanent Resident", since: "2020-03", cpf: true },
    { id: "C", role: "Cashier and service", residency: "Singapore Citizen", since: "2022-11", cpf: true },
    { id: "D", role: "Kitchen helper", residency: "Work Permit holder", since: "2024-05", cpf: false },
  ],
  cpfNote: "Owner says CPF has been paid on time every month in 2026 for staff A, B and C (CPF e-statements not uploaded).",
  quotes: [
    { quoteNo: CHILLER.quoteNo, date: "2026-09-17", vendor: S.S06.name, item: "2-door upright drinks chiller, inverter, 4-tick (model DEMO-UC2-INV)", amountExGstRm: CHILLER.exGst, gstRm: CHILLER.gst, totalRm: CHILLER.total, status: "Ordered; delivery booked for 20 Oct 2026" },
    { quoteNo: "FKE-Q-26-0412", date: "2026-09-24", vendor: "FreshKleen Kitchen Equipment Pte Ltd (fictional)", item: "Automated dishwasher, hood type, 20 L water tank (model DEMO-HD20)", amountExGstRm: 4600, gstRm: 414, totalRm: 5014, status: "Quote only; nothing signed or paid" },
  ],
  grantApplicationsSubmitted: [],
  grantNote: "No grant applications submitted yet. Owner plans to apply for the Energy Efficiency Grant (chiller) and EDGE (dishwasher) in October 2026.",
  gstRegistered: false,
  existingFinancing: "None",
  workingOwnerExcludedFromCount: true,
};

const business = { disclaimer, profile, profileExtras, sales, purchases, suppliers: Object.values(S).map(({ short, ...s }) => s), bank, payables };

// ---------- 6. write ----------
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/${SLUG}.json`, JSON.stringify(business, null, 2) + "\n");
const toCsv = (rows) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => (v == null ? "" : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};
writeFileSync(`${OUT}/sales.csv`, toCsv(sales));
writeFileSync(`${OUT}/purchases.csv`, toCsv(purchases));
writeFileSync(`${OUT}/suppliers.csv`, toCsv(business.suppliers));
writeFileSync(`${OUT}/bank.csv`, toCsv(bank));

const total = sales.reduce((a, x) => a + x.amountRm, 0);
console.log(`${SLUG}: sales days ${sales.length} (S$${total.toFixed(2)}), purchase lines ${purchases.length}, suppliers ${business.suppliers.length}, bank rows ${bank.length} (closing S$${bal.toFixed(2)}), payables ${payables.length}`);
console.log(`chiller: ex-GST ${CHILLER.exGst}, GST ${CHILLER.gst}, total ${CHILLER.total}, deposit ${CHILLER.deposit}; duplicate ${dupInv.invoiceNo} S$${dupInv.amountRm}`);
