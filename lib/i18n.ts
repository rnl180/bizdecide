import { useEffect, useSyncExternalStore } from "react";
import type { Service } from "./types";

/** Intake form copy in English and Bahasa Melayu. Market-specific labels come from the market pack (see lib/markets.ts). */
export type Lang = "en" | "ms";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
];

// ---------- the viewer's language, shared by every page in this browser ----------

const LANG_KEY = "bizdecide.lang";
const LANG_EVENT = "bizdecide:lang-change";

function readLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ms" ? v : null;
  } catch {
    return null; // storage blocked
  }
}

export function setLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked: the choice just won't persist */
  }
  window.dispatchEvent(new Event(LANG_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === LANG_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(LANG_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANG_EVENT, onChange);
  };
}

/** The language picked in this browser, else `fallback` (e.g. the language a brief was requested in). */
export function useLang(fallback: Lang = "en"): Lang {
  const lang = useSyncExternalStore(subscribe, readLang, () => null) ?? fallback;
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return lang;
}

const en = {
  langLabel: "Language",
  eyebrow: (market: string) => `AI CFO for SMEs in ${market}`,
  h1: ["Upload your numbers.", "Get three decisions."],
  lede: "Every tauke deserves a CFO. BizDecide reads your sales, purchases and suppliers, then a team of AI agents tells you exactly what to do next: where money is leaking, which supplier to switch, which funding you qualify for.",
  getStarted: "Get started",
  tryDemo: "Try the demo café",
  points: (currency: string) => [
    "Works with CSV exports from your POS, bank or Excel",
    `Every decision comes with its ${currency} impact and evidence`,
    "Checks its own work and only asks you when it must",
  ],
  howTitle: "How it works",
  how: (currency: string) => [
    ["Upload your numbers", "Sales, purchases and suppliers. Column names don't need to be perfect."],
    ["AI agents get to work", "Bookkeeping, supplier prices, SME category and funding, then a verifier checks every figure."],
    ["Get three decisions", `Ranked by urgency, each with its ${currency} impact and the evidence behind it.`],
  ],
  agentsAria: "Agents on Tencent WorkBuddy",
  agents: ["Bookkeeper", "Procurement", "Classifier", "Funding", "Verifier"],
  skillsAsk: "Already use WorkBuddy?",
  skillsGet: "Get these as skills",

  kicker: "Get started",
  startTitle: "Start your request",
  startSub: ["Three short steps. You only ", "need", " your business name and one sales or purchases file."],
  steps: [
    { title: "Your business", sub: "Market, name and sector" },
    { title: "Your numbers", sub: "Sales, purchases, suppliers" },
    { title: "Choose a service", sub: "Review and send" },
  ],
  progressAria: "Progress",
  exploring: "Just exploring?",
  exploringBody: "Load a real-looking café with a year of numbers, or download the sample files to see the format.",
  loadDemoCafe: "Load the demo café",
  stepOf: (n: number) => `Step ${n} of 3`,
  next: (title: string) => `Next: ${title.toLowerCase()}`,
  back: "Back",
  hints: ["Only the business name is required.", "Add sales or purchases to continue.", "This page updates by itself once you send."],

  s1Title: "Tell us about your business",
  s1Sub: "Fields marked with a red asterisk are required. Everything else is optional.",
  marketTitle: "Choose your market",
  marketSub: (names: string[]) =>
    `Funding programmes, SME categories and tax rules depend on the country. We have data for ${names.join(" and ")} today.`,
  soon: "Soon",
  marketNames: {} as Record<string, string>,
  basics: "Basics",
  businessName: "Business name",
  namePh: "e.g. Kedai Kopi Aminah",
  nameErr: "Add your business name to continue.",
  sector: "Sector",
  sectors: {} as Record<string, string>,
  selectRegion: (label: string) => `Select a ${label.toLowerCase()}`,
  moreTitle: "More about your business",
  optional: "Optional",
  moreSub: "Helps the agents check your SME category and match you to funding.",
  employees: "Full-time employees",
  employeesPh: "e.g. 6",
  annualSales: "Annual sales",
  salesPh: "e.g. 240000",
  salesHelp: "Your own estimate. We compare it with your uploaded sales.",
  goal: "What are you planning next?",
  goalPh: "e.g. Open a second outlet",
  ownership: "Ownership",

  s2Title: "Add your numbers",
  s2Sub: "CSV exports from your POS, bank or Excel. Column names don't need to be perfect.",
  numbersErr: "Add a sales or purchases file to continue.",
  salesOrPurchases: "Sales or purchases",
  done: "Done",
  addOne: "Add at least one",
  analyseSub: "This is what the agents analyse. Both together give the best results.",
  sales: "Sales",
  salesCols: "Columns: period, amount. StoreHub sales exports work too.",
  purchases: "Purchases",
  purchasesCols: "Columns: date, supplier, item, qty, unit price, total",
  extraTitle: "Extra detail",
  extraSub: "Makes supplier and funding advice sharper.",
  suppliers: "Suppliers",
  suppliersCols: "Columns: name, category, contact",
  documents: "Documents",
  docsCols: (registry: string) => `${registry} certificate, receipts`,
  uploaded: "Uploaded",
  removeFile: { sales: "Remove sales file", purchases: "Remove purchases file", suppliers: "Remove suppliers file" },
  removeDoc: (name: string) => `Remove ${name}`,
  rows: (n: string) => `${n} rows`,
  notAdded: "Not added",
  readErr: (file: string) => `Couldn't read any rows from ${file}. Check the column headers.`,
  uploadFailed: (file: string) => `${file}: upload failed, please try again`,
  bank: "Bank statement",
  bankCols: "Columns: date, description, debit, credit, balance",
  payables: "Bills paid",
  payablesCols: "Columns: invoice no, supplier, invoice date, amount, paid date",
  removeExtra: { bank: "Remove bank statement", payables: "Remove bills file" },
  mapTitle: "Which column is which?",
  mapHelp: (file: string) => `We couldn't match the columns in ${file} on our own. Pick them below.`,
  mapUse: "Use these columns",
  mapCancel: "Cancel",
  mapSkip: "Not in this file",
  mapRequired: "Pick the columns marked *.",
  mapFields: {
    period: "Date",
    amountrm: "Sales amount",
    channel: "Channel",
    date: "Date",
    supplier: "Supplier",
    invoiceno: "Invoice no",
    item: "Item",
    unitpricerm: "Unit price",
    qty: "Quantity",
    unit: "Unit",
    totalrm: "Total",
    name: "Supplier name",
    category: "Category",
    contact: "Contact",
    paymentterms: "Payment terms",
    description: "Description",
    reference: "Reference",
    debitrm: "Money out",
    creditrm: "Money in",
    balancerm: "Balance",
    paiddate: "Paid date",
    invoicedate: "Invoice date",
    method: "Payment method",
  } as Record<string, string>,
  colsUsed: "Columns used",
  changeCols: "Change",
  warnTitle: "Please check",
  warn: {
    negative: (n: number) => `${n} negative amount${n === 1 ? "" : "s"}. Refunds are fine; otherwise check ${n === 1 ? "it" : "them"}.`,
    duplicate: (n: number) => `${n} row${n === 1 ? "" : "s"} look${n === 1 ? "s" : ""} exactly duplicated.`,
    outlier: (n: number, v: string) => `${n} unusually large amount${n === 1 ? "" : "s"}, e.g. ${v}. Check for a typo.`,
    future: (n: number) => `${n} date${n === 1 ? " is" : "s are"} in the future.`,
  },
  privacyAgree: ["I agree to the ", "privacy notice", ". BizDecide's AI agents will read the numbers I upload to prepare my brief."],
  privacyErr: "Please agree to the privacy notice to send.",
  docsMax: "You can attach up to 20 documents.",
  drop: {
    sample: "Sample",
    uploading: "Uploading…",
    click: "Click to upload",
    addMore: "Add more",
    orDrag: "or drag and drop",
    docLimit: "PDF or photo, up to 10 MB each",
    csv: "CSV file",
  },

  s3Title: "What do you need today?",
  s3Sub: "Pick one service, check the summary, then send. You can always come back for another.",
  demoLoaded: "Demo café loaded.",
  demoLoadedBody: (name: string) => ` ${name}'s profile and a year of numbers are filled in. Pick a service and send.`,
  notReady: "Add a business name and at least a sales or purchases file before sending.",
  serviceAria: "Service",
  services: null as Record<Service, { title: string; blurb: string }> | null, // null = use SERVICE_LABELS
  recommended: "Recommended",
  summaryHead: "What we'll send",
  sumBusiness: "Business",
  sumMarket: "Market",
  sumSector: (region: string) => `Sector and ${region.toLowerCase()}`,
  docsUploaded: (n: number) => `${n} uploaded`,
  none: "None",
  sending: "Sending to your CFO…",
  getDecisions: "Get my decisions",
  errSave: "Couldn't save your business",
  errRequest: "Couldn't create the request",
  errGeneric: "Something went wrong",
};
export type Strings = typeof en;

const ms: Strings = {
  langLabel: "Bahasa",
  eyebrow: (market) => `CFO AI untuk PKS di ${market}`,
  h1: ["Muat naik angka anda.", "Dapatkan tiga keputusan."],
  lede: "Setiap tauke layak ada CFO. BizDecide membaca jualan, belian dan pembekal anda, kemudian satu pasukan ejen AI memberitahu apa yang perlu dibuat seterusnya: di mana duit bocor, pembekal mana patut ditukar, dan pembiayaan mana yang anda layak.",
  getStarted: "Mula sekarang",
  tryDemo: "Cuba kafe demo",
  points: (currency) => [
    "Boleh guna fail CSV daripada POS, bank atau Excel anda",
    `Setiap keputusan disertakan kesan dalam ${currency} dan buktinya`,
    "Menyemak kerjanya sendiri dan hanya bertanya bila perlu",
  ],
  howTitle: "Cara ia berfungsi",
  how: (currency) => [
    ["Muat naik angka anda", "Jualan, belian dan pembekal. Nama lajur tak perlu tepat."],
    ["Ejen AI mula bekerja", "Simpan kira, harga pembekal, kategori PKS dan pembiayaan, kemudian penyemak memeriksa setiap angka."],
    ["Dapatkan tiga keputusan", `Disusun ikut keutamaan, setiap satu dengan kesan dalam ${currency} dan bukti di sebaliknya.`],
  ],
  agentsAria: "Ejen di Tencent WorkBuddy",
  agents: ["Penyimpan kira", "Perolehan", "Pengelas", "Pembiayaan", "Penyemak"],
  skillsAsk: "Sudah guna WorkBuddy?",
  skillsGet: "Dapatkan sebagai skill",

  kicker: "Mula",
  startTitle: "Mulakan permintaan anda",
  startSub: ["Tiga langkah ringkas. Anda hanya ", "perlu", " nama perniagaan dan satu fail jualan atau belian."],
  steps: [
    { title: "Perniagaan anda", sub: "Pasaran, nama dan sektor" },
    { title: "Angka anda", sub: "Jualan, belian, pembekal" },
    { title: "Pilih perkhidmatan", sub: "Semak dan hantar" },
  ],
  progressAria: "Kemajuan",
  exploring: "Sekadar melihat?",
  exploringBody: "Muatkan kafe contoh dengan angka setahun, atau muat turun fail sampel untuk lihat formatnya.",
  loadDemoCafe: "Muatkan kafe demo",
  stepOf: (n) => `Langkah ${n} daripada 3`,
  next: (title) => `Seterusnya: ${title.toLowerCase()}`,
  back: "Kembali",
  hints: ["Hanya nama perniagaan yang wajib.", "Tambah jualan atau belian untuk teruskan.", "Halaman ini dikemas kini sendiri selepas anda hantar."],

  s1Title: "Ceritakan tentang perniagaan anda",
  s1Sub: "Ruangan bertanda asterisk merah wajib diisi. Selebihnya pilihan.",
  marketTitle: "Pilih pasaran anda",
  marketSub: (names) =>
    `Program pembiayaan, kategori PKS dan peraturan cukai bergantung pada negara. Buat masa ini kami ada data untuk ${names.join(" dan ")}.`,
  soon: "Akan datang",
  marketNames: { SG: "Singapura", PH: "Filipina" },
  basics: "Asas",
  businessName: "Nama perniagaan",
  namePh: "cth. Kedai Kopi Aminah",
  nameErr: "Masukkan nama perniagaan untuk teruskan.",
  sector: "Sektor",
  sectors: { Retail: "Runcit", Services: "Perkhidmatan", Manufacturing: "Pembuatan", Agriculture: "Pertanian", Construction: "Pembinaan" },
  selectRegion: (label) => `Pilih ${label.toLowerCase()}`,
  moreTitle: "Maklumat lanjut perniagaan",
  optional: "Pilihan",
  moreSub: "Membantu ejen menyemak kategori PKS anda dan memadankan anda dengan pembiayaan.",
  employees: "Pekerja sepenuh masa",
  employeesPh: "cth. 6",
  annualSales: "Jualan tahunan",
  salesPh: "cth. 240000",
  salesHelp: "Anggaran anda sendiri. Kami bandingkan dengan jualan yang dimuat naik.",
  goal: "Apa rancangan anda seterusnya?",
  goalPh: "cth. Buka cawangan kedua",
  ownership: "Pemilikan",

  s2Title: "Tambah angka anda",
  s2Sub: "Fail CSV daripada POS, bank atau Excel anda. Nama lajur tak perlu tepat.",
  numbersErr: "Tambah fail jualan atau belian untuk teruskan.",
  salesOrPurchases: "Jualan atau belian",
  done: "Siap",
  addOne: "Tambah sekurang-kurangnya satu",
  analyseSub: "Inilah yang dianalisis oleh ejen. Kedua-duanya sekali memberi hasil terbaik.",
  sales: "Jualan",
  salesCols: "Lajur: tempoh, jumlah. Fail eksport jualan StoreHub juga boleh.",
  purchases: "Belian",
  purchasesCols: "Lajur: tarikh, pembekal, barang, kuantiti, harga seunit, jumlah",
  extraTitle: "Maklumat tambahan",
  extraSub: "Menjadikan nasihat pembekal dan pembiayaan lebih tepat.",
  suppliers: "Pembekal",
  suppliersCols: "Lajur: nama, kategori, hubungan",
  documents: "Dokumen",
  docsCols: (registry) => `Sijil ${registry}, resit`,
  uploaded: "Dimuat naik",
  removeFile: { sales: "Buang fail jualan", purchases: "Buang fail belian", suppliers: "Buang fail pembekal" },
  removeDoc: (name) => `Buang ${name}`,
  rows: (n) => `${n} baris`,
  notAdded: "Belum ditambah",
  readErr: (file) => `Tiada baris yang dapat dibaca daripada ${file}. Semak tajuk lajur.`,
  uploadFailed: (file) => `${file}: gagal dimuat naik, sila cuba lagi`,
  bank: "Penyata bank",
  bankCols: "Lajur: tarikh, keterangan, debit, kredit, baki",
  payables: "Bil dibayar",
  payablesCols: "Lajur: no invois, pembekal, tarikh invois, jumlah, tarikh bayar",
  removeExtra: { bank: "Buang penyata bank", payables: "Buang fail bil" },
  mapTitle: "Lajur mana untuk apa?",
  mapHelp: (file) => `Kami tidak dapat memadankan lajur dalam ${file} sendiri. Pilih di bawah.`,
  mapUse: "Guna lajur ini",
  mapCancel: "Batal",
  mapSkip: "Tiada dalam fail ini",
  mapRequired: "Pilih lajur yang bertanda *.",
  mapFields: {
    period: "Tarikh",
    amountrm: "Jumlah jualan",
    channel: "Saluran",
    date: "Tarikh",
    supplier: "Pembekal",
    invoiceno: "No invois",
    item: "Barang",
    unitpricerm: "Harga seunit",
    qty: "Kuantiti",
    unit: "Unit",
    totalrm: "Jumlah",
    name: "Nama pembekal",
    category: "Kategori",
    contact: "Hubungan",
    paymentterms: "Terma bayaran",
    description: "Keterangan",
    reference: "Rujukan",
    debitrm: "Wang keluar",
    creditrm: "Wang masuk",
    balancerm: "Baki",
    paiddate: "Tarikh bayar",
    invoicedate: "Tarikh invois",
    method: "Kaedah bayaran",
  },
  colsUsed: "Lajur digunakan",
  changeCols: "Tukar",
  warnTitle: "Sila semak",
  warn: {
    negative: (n) => `${n} amaun negatif. Bayaran balik tidak mengapa; jika bukan, sila semak.`,
    duplicate: (n) => `${n} baris kelihatan berulang sepenuhnya.`,
    outlier: (n, v) => `${n} amaun luar biasa besar, contohnya ${v}. Semak jika ada salah taip.`,
    future: (n) => `${n} tarikh adalah pada masa hadapan.`,
  },
  privacyAgree: ["Saya bersetuju dengan ", "notis privasi", ". Ejen AI BizDecide akan membaca angka yang saya muat naik untuk menyediakan ringkasan saya."],
  privacyErr: "Sila bersetuju dengan notis privasi untuk menghantar.",
  docsMax: "Anda boleh melampirkan sehingga 20 dokumen.",
  drop: {
    sample: "Sampel",
    uploading: "Memuat naik…",
    click: "Klik untuk muat naik",
    addMore: "Tambah lagi",
    orDrag: "atau seret dan lepas",
    docLimit: "PDF atau foto, sehingga 10 MB setiap satu",
    csv: "Fail CSV",
  },

  s3Title: "Apa yang anda perlukan hari ini?",
  s3Sub: "Pilih satu perkhidmatan, semak ringkasan, kemudian hantar. Anda boleh kembali untuk perkhidmatan lain.",
  demoLoaded: "Kafe demo dimuatkan.",
  demoLoadedBody: (name) => ` Profil ${name} dan angka setahun sudah diisi. Pilih perkhidmatan dan hantar.`,
  notReady: "Masukkan nama perniagaan dan sekurang-kurangnya satu fail jualan atau belian sebelum menghantar.",
  serviceAria: "Perkhidmatan",
  services: {
    cfo_brief: { title: "Taklimat CFO bulanan", blurb: "Tiga keputusan paling penting bulan ini." },
    bookkeeping: { title: "Tutup akaun saya", blurb: "Untung rugi, ke mana duit pergi, apa yang tak seimbang." },
    procurement: { title: "Semak pembekal saya", blurb: "Kenaikan harga tersembunyi, pilihan lebih murah, pesanan seterusnya." },
    funding: { title: "Cari pembiayaan", blurb: "Program yang perniagaan ini layak hari ini, dengan pek permohonan." },
  },
  recommended: "Disyorkan",
  summaryHead: "Apa yang akan kami hantar",
  sumBusiness: "Perniagaan",
  sumMarket: "Pasaran",
  sumSector: (region) => `Sektor dan ${region.toLowerCase()}`,
  docsUploaded: (n) => `${n} dimuat naik`,
  none: "Tiada",
  sending: "Menghantar kepada CFO anda…",
  getDecisions: "Dapatkan keputusan saya",
  errSave: "Tidak dapat menyimpan perniagaan anda",
  errRequest: "Tidak dapat membuat permintaan",
  errGeneric: "Ada masalah, sila cuba lagi",
};

export const INTAKE: Record<Lang, Strings> = { en, ms };
