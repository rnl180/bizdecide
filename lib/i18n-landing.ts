import type { Lang } from "@/lib/i18n";

/** Landing page copy (hero, "found" card and marketing sections) in English and Bahasa Melayu. */

export type Priority = "urgent" | "important" | "opportunity";

export type LandingStrings = {
  langLabel: string;
  hero: {
    eyebrow: string;
    h1: [string, string];
    lede: string;
    ctaFiles: string;
    ctaDemo: string;
    trust: string[];
  };
  /** The sample brief shown beside the headline. Amounts are display strings; the first one counts up. */
  card: {
    cafe: string;
    place: string;
    badge: string;
    found: string;
    foundLabel: string;
    saved: string;
    savedLabel: string;
    rows: { priority: Priority; tag: string; title: string; amount: string; status: string; done?: boolean }[];
    chips: string[];
    note: string;
  };
  vs: { kicker: string; title: string; them: string; us: string; rows: [string, string][] };
  grid: { kicker: string; title: string; tiles: { title: string; body: string }[] };
  how: { kicker: string; title: string; steps: { title: string; body: string }[]; agents: string[]; running: string };
  stats: { kicker: string; title: string; newTab: string; items: { value: string; label: string; source: string; href: string }[] };
  faq: { kicker: string; title: string; privacyLink: string; items: [string, string][] };
  cta: { title: string; sub: string; button: string };
};

// Citations stay in their original wording in both languages.
const SOURCES = [
  {
    source: "SME Corp Malaysia / DOSM, 2023",
    href: "https://smecorp.gov.my/index.php/en/policies/2020-02-11-08-01-24/profile-and-importance-to-the-economy",
  },
  {
    source: "Airwallex SME Outlook 2026 (n=415), The Star",
    href: "https://www.thestar.com.my/business/business-news/2026/10/01/rising-costs-top-concern-for-malaysian-smes-as-growth-remains-priority",
  },
  {
    source: "ACCCIM M-BECS H1 2026 (n=791), Malay Mail",
    href: "https://www.malaymail.com/news/malaysia/2026/07/23/acccim-survey-finds-malaysian-businesses-still-struggling-with-financing-access-alternative-channels-underutilised/228669",
  },
  {
    source: "Ministry of Entrepreneur Development and Cooperatives, The Star, Aug 2026",
    href: "https://www.thestar.com.my/news/nation/2026/08/01/more-businesses-to-receive-msme-funding",
  },
] as const;

const en: LandingStrings = {
  langLabel: "Language",
  hero: {
    eyebrow: "AI CFO for Malaysian SMEs · skills for Tencent WorkBuddy",
    h1: ["ChatGPT gives you advice.", "BizDecide gets your money back."],
    lede: "Drop your POS sales, supplier invoices and bank statement. Six AI agents check every ringgit, find where money is leaking and, when you tap Approve, write the refund request for you.",
    ctaFiles: "Drop your files",
    ctaDemo: "See it on a sample kopitiam",
    trust: ["No login, no setup", "Every ringgit traced to an invoice", "Nothing is sent without your OK"],
  },
  card: {
    cafe: "Rock Cafe",
    place: "Petaling Jaya, Selangor",
    badge: "Sample brief · fictional café",
    found: "RM954.40",
    foundLabel: "found to recover",
    saved: "+RM985/yr",
    savedLabel: "supplier overcharge stopped",
    rows: [
      { priority: "urgent", tag: "Urgent", title: "Invoice LSS/2609/278 paid twice", amount: "RM642", status: "Refund email drafted", done: true },
      { priority: "urgent", tag: "Urgent", title: "DuitNow QR settlement for 18 Sep never arrived", amount: "RM312.40", status: "Bank query ready" },
      { priority: "important", tag: "Important", title: "Kopi O powder up 12% at Cap Bintang", amount: "RM985/yr", status: "Approve to ask for quotes" },
      { priority: "opportunity", tag: "Opportunity", title: "TEKUN Niaga fits the RM40,000 kitchen plan", amount: "", status: "Application pack ready" },
    ],
    chips: ["SME Corp: Micro", "Bank reconciles ✓", "PUNB: RM47k short"],
    note: "Computed in code from 12 months of the café's books, not guessed by a chatbot.",
  },
  vs: {
    kicker: "Why not just ask ChatGPT?",
    title: "A chatbot talks. A CFO team does the work.",
    them: "ChatGPT",
    us: "BizDecide",
    rows: [
      ["You paste a few numbers and it guesses", "Reads 12 months of your sales, invoices and bank lines"],
      ["Generic tips that fit any business", "Three decisions, each with the ringgit impact and the invoice that proves it"],
      ["Doesn't know DuitNow, delivery-app payouts or card MDR", "Matches every DuitNow QR, card and delivery payout to your bank"],
      ["Can make up funding schemes", "Checks 20 real Malaysian programmes (TEKUN, MARA, SJPP, CGC…) against your numbers"],
      ["Stops at advice", "Tap Approve and it drafts the refund email or funding pack for you"],
    ],
  },
  grid: {
    kicker: "Built for Malaysia",
    title: "What your CFO team checks, every time",
    tiles: [
      { title: "Double payments", body: "Every supplier invoice matched to your bank. Paid twice? We find it and ask for it back." },
      {
        title: "DuitNow, card & delivery settlements",
        body: "DuitNow QR should land the next day, cards at about 1.5% MDR, delivery apps at about 70% of gross. Anything missing is flagged.",
      },
      { title: "Supplier price creep", body: "Item by item, invoice by invoice. A quiet 12% rise on kopi powder costs RM985 a year." },
      {
        title: "SME Corp category",
        body: "Micro, Small or Medium under the 2024 definition (by sales or staff, whichever is lower) and how far you are from the next tier.",
      },
      {
        title: "Funding you actually qualify for",
        body: "20 programmes (TEKUN, MARA, SJPP, CGC, PUNB, AIM, BSN…) checked against your real numbers, with an application pack.",
      },
      {
        title: "Approve, and it's done",
        body: "Refund requests, bank queries and supplier emails written in Bahasa Melayu or English, ready to send from your Gmail.",
      },
      { title: "Ask your CFO", body: "Follow-up questions answered from your own books, with the evidence." },
      { title: "Skills for accountants", body: "The same agents as Tencent WorkBuddy skills. Run them for every client." },
    ],
  },
  how: {
    kicker: "How it works",
    title: "One request. Six agents. Three decisions.",
    steps: [
      { title: "Drop your files", body: "POS sales, supplier invoices, bank statement. CSV, PDF or photo. We work out which is which." },
      { title: "Agents work in parallel", body: "Each agent takes one job. If something is unclear, they ask you one quick question instead of guessing." },
      { title: "Three decisions with proof", body: "Each with the ringgit impact and the invoice or bank line behind it, verified before you see it." },
      { title: "Approve. It's done.", body: "One tap and your CFO team drafts the email, the bank query or the funding pack." },
    ],
    agents: ["Bookkeeper", "Reconciliation", "Procurement", "Classifier", "Funding", "Verifier"],
    running: "The same skills run in Tencent WorkBuddy",
  },
  stats: {
    kicker: "The problem",
    title: "Every tauke needs a CFO. Almost none can afford one.",
    newTab: "(opens in a new tab)",
    items: [
      { value: "1.1 million", label: "MSMEs in Malaysia, 96.9% of all businesses", ...SOURCES[0] },
      { value: "67%", label: "say rising costs are their top pressure; 1 in 5 name supplier price rises", ...SOURCES[1] },
      { value: "50.6%", label: "don't know the development finance institutions that could fund them", ...SOURCES[2] },
      { value: "~140", label: "government financing schemes, hard to navigate", ...SOURCES[3] },
    ],
  },
  faq: {
    kicker: "Questions owners ask",
    title: "Before you upload anything.",
    privacyLink: "Read the privacy notice",
    items: [
      [
        "What do I need to upload?",
        "Only your business name and one sales or purchases file. Everything else helps but is optional: POS sales, supplier invoices, a bank statement, bills paid. CSV, PDF or photos all work, and we work out which file is which.",
      ],
      [
        "Who can see my numbers?",
        "Your data is stored on BizDecide's server and used only to prepare your brief. We don't sell it or use it for advertising. Our AI agents process the numbers your brief needs, which may happen outside Malaysia. Anyone with your brief's link can open it, so share the link only with people you trust.",
      ],
      [
        "Does BizDecide send emails or applications for me?",
        "Not without your OK. When you tap Approve, your CFO team drafts the email or letter. You read it, then send it yourself from your own Gmail, or print it.",
      ],
      [
        "How do I know the numbers are right?",
        "Every figure is computed in code from your own files, not guessed by a chatbot. A Verifier agent reconciles the totals and checks every figure and link before you see the brief, and each decision shows the invoice or bank line behind it.",
      ],
      [
        "Will BizDecide get my loan approved?",
        "No. BizDecide tells you which programmes fit your numbers and prepares the documents. The agency or bank makes the final decision.",
      ],
      ["Which languages does it speak?", "English and Bahasa Melayu. Your brief comes back in the language you choose."],
      ["Can I delete my data?", "Yes. Ask the BizDecide team at masarsoftware.com to see, correct or delete your data at any time."],
    ],
  },
  cta: {
    title: "Your books already know where the money is.",
    sub: "Let your CFO team find it.",
    button: "Drop your files",
  },
};

const ms: LandingStrings = {
  langLabel: "Bahasa",
  hero: {
    eyebrow: "CFO AI untuk PKS Malaysia · kemahiran untuk Tencent WorkBuddy",
    h1: ["ChatGPT beri nasihat.", "BizDecide dapatkan semula duit anda."],
    lede: "Muat naik jualan POS, invois pembekal dan penyata bank anda. Enam ejen AI menyemak setiap ringgit, mencari ke mana duit bocor dan, bila anda tekan Lulus, menulis permintaan bayaran balik untuk anda.",
    ctaFiles: "Muat naik fail anda",
    ctaDemo: "Cuba dengan kopitiam contoh",
    trust: ["Tiada log masuk, tiada persediaan", "Setiap ringgit dijejak ke invois", "Tiada apa dihantar tanpa kelulusan anda"],
  },
  card: {
    cafe: "Rock Cafe",
    place: "Petaling Jaya, Selangor",
    badge: "Contoh laporan · kafe rekaan",
    found: "RM954.40",
    foundLabel: "boleh dituntut semula",
    saved: "+RM985/thn",
    savedLabel: "kenaikan harga pembekal dihentikan",
    rows: [
      { priority: "urgent", tag: "Segera", title: "Invois LSS/2609/278 dibayar dua kali", amount: "RM642", status: "Emel bayaran balik disediakan", done: true },
      { priority: "urgent", tag: "Segera", title: "Bayaran DuitNow QR 18 Sep tidak masuk", amount: "RM312.40", status: "Pertanyaan bank sedia" },
      { priority: "important", tag: "Penting", title: "Serbuk Kopi O naik 12% di Cap Bintang", amount: "RM985/thn", status: "Lulus untuk minta sebut harga" },
      { priority: "opportunity", tag: "Peluang", title: "TEKUN Niaga sesuai untuk pelan dapur RM40,000", amount: "", status: "Pek permohonan sedia" },
    ],
    chips: ["SME Corp: Mikro", "Baki bank sepadan ✓", "PUNB: kurang RM47k"],
    note: "Dikira dengan kod daripada 12 bulan buku akaun kafe, bukan diteka oleh chatbot.",
  },
  vs: {
    kicker: "Kenapa tidak tanya ChatGPT saja?",
    title: "Chatbot bercakap. Pasukan CFO membuat kerja.",
    them: "ChatGPT",
    us: "BizDecide",
    rows: [
      ["Anda tampal beberapa nombor dan ia meneka", "Membaca 12 bulan jualan, invois dan transaksi bank anda"],
      ["Tip umum untuk semua perniagaan", "Tiga keputusan, setiap satu dengan nilai ringgit dan invois sebagai bukti"],
      ["Tidak kenal DuitNow, bayaran aplikasi penghantaran atau MDR kad", "Memadankan setiap DuitNow QR, kad dan bayaran penghantaran dengan bank anda"],
      ["Boleh mereka-reka skim pembiayaan", "Menyemak 20 program sebenar Malaysia (TEKUN, MARA, SJPP, CGC…) dengan angka anda"],
      ["Berhenti pada nasihat", "Tekan Lulus dan ia menyediakan emel bayaran balik atau pek pembiayaan untuk anda"],
    ],
  },
  grid: {
    kicker: "Dibina untuk Malaysia",
    title: "Apa yang pasukan CFO anda semak, setiap kali",
    tiles: [
      { title: "Bayaran berganda", body: "Setiap invois pembekal dipadankan dengan bank. Terbayar dua kali? Kami jumpa dan tuntut semula." },
      {
        title: "Bayaran DuitNow, kad & penghantaran",
        body: "DuitNow QR patut masuk keesokan hari, kad dengan MDR kira-kira 1.5%, aplikasi penghantaran kira-kira 70% daripada jualan kasar. Yang hilang akan ditanda.",
      },
      { title: "Kenaikan harga senyap", body: "Barang demi barang, invois demi invois. Kenaikan senyap 12% pada serbuk kopi bernilai RM985 setahun." },
      {
        title: "Kategori SME Corp",
        body: "Mikro, Kecil atau Sederhana mengikut definisi 2024 (ikut jualan atau pekerja, yang lebih rendah) dan berapa jauh ke tahap seterusnya.",
      },
      {
        title: "Pembiayaan yang anda benar-benar layak",
        body: "20 program (TEKUN, MARA, SJPP, CGC, PUNB, AIM, BSN…) disemak dengan angka sebenar anda, berserta pek permohonan.",
      },
      {
        title: "Lulus, dan siap",
        body: "Permintaan bayaran balik, pertanyaan bank dan emel pembekal ditulis dalam BM atau Inggeris, sedia untuk dihantar dari Gmail anda.",
      },
      { title: "Tanya CFO anda", body: "Soalan susulan dijawab daripada buku akaun anda sendiri, dengan bukti." },
      { title: "Kemahiran untuk akauntan", body: "Ejen yang sama sebagai kemahiran Tencent WorkBuddy. Gunakan untuk setiap pelanggan." },
    ],
  },
  how: {
    kicker: "Cara ia berfungsi",
    title: "Satu permintaan. Enam ejen. Tiga keputusan.",
    steps: [
      { title: "Muat naik fail", body: "Jualan POS, invois pembekal, penyata bank. CSV, PDF atau gambar. Kami kenal pasti setiap satu." },
      { title: "Ejen bekerja serentak", body: "Setiap ejen ambil satu tugas. Jika ada yang kurang jelas, mereka tanya anda satu soalan ringkas, bukan meneka." },
      { title: "Tiga keputusan dengan bukti", body: "Setiap satu dengan nilai ringgit dan invois atau transaksi bank di sebaliknya, disahkan sebelum anda melihatnya." },
      { title: "Lulus. Siap.", body: "Satu tekan dan pasukan CFO anda menyediakan emel, pertanyaan bank atau pek pembiayaan." },
    ],
    agents: ["Penyimpan kira", "Penyesuaian", "Perolehan", "Pengelas", "Pembiayaan", "Penyemak"],
    running: "Kemahiran yang sama berjalan di Tencent WorkBuddy",
  },
  stats: {
    kicker: "Masalahnya",
    title: "Setiap tauke perlukan CFO. Hampir tiada yang mampu.",
    newTab: "(dibuka dalam tab baharu)",
    items: [
      { value: "1.1 juta", label: "PMKS di Malaysia, 96.9% daripada semua perniagaan", ...SOURCES[0] },
      { value: "67%", label: "kata kenaikan kos ialah tekanan utama; 1 daripada 5 menyebut kenaikan harga pembekal", ...SOURCES[1] },
      { value: "50.6%", label: "tidak tahu institusi kewangan pembangunan yang boleh membiayai mereka", ...SOURCES[2] },
      { value: "~140", label: "skim pembiayaan kerajaan, sukar diteroka", ...SOURCES[3] },
    ],
  },
  faq: {
    kicker: "Soalan lazim pemilik",
    title: "Sebelum anda muat naik apa-apa.",
    privacyLink: "Baca notis privasi",
    items: [
      [
        "Apa yang perlu saya muat naik?",
        "Hanya nama perniagaan dan satu fail jualan atau belian. Selebihnya membantu tetapi pilihan: jualan POS, invois pembekal, penyata bank, bil yang dibayar. CSV, PDF atau gambar boleh digunakan, dan kami kenal pasti setiap fail.",
      ],
      [
        "Siapa yang boleh melihat angka saya?",
        "Data anda disimpan di pelayan BizDecide dan digunakan hanya untuk menyediakan ringkasan anda. Kami tidak menjualnya atau menggunakannya untuk pengiklanan. Ejen AI kami memproses angka yang diperlukan untuk ringkasan anda, yang mungkin berlaku di luar Malaysia. Sesiapa yang mempunyai pautan ringkasan anda boleh membukanya, jadi kongsi pautan hanya dengan orang yang anda percayai.",
      ],
      [
        "Adakah BizDecide menghantar e-mel atau permohonan untuk saya?",
        "Tidak tanpa kebenaran anda. Apabila anda tekan Lulus, pasukan CFO anda menyediakan draf e-mel atau surat. Anda membacanya, kemudian menghantarnya sendiri dari Gmail anda, atau mencetaknya.",
      ],
      [
        "Bagaimana saya tahu angkanya betul?",
        "Setiap angka dikira dengan kod daripada fail anda sendiri, bukan diteka oleh chatbot. Ejen Penyemak menyelaraskan jumlah dan menyemak setiap angka serta pautan sebelum anda melihat ringkasan, dan setiap keputusan menunjukkan invois atau baris bank di sebaliknya.",
      ],
      [
        "Adakah BizDecide akan meluluskan pinjaman saya?",
        "Tidak. BizDecide memberitahu program yang sesuai dengan angka anda dan menyediakan dokumennya. Agensi atau bank yang membuat keputusan akhir.",
      ],
      ["Bahasa apa yang digunakan?", "Bahasa Inggeris dan Bahasa Melayu. Ringkasan anda dihantar dalam bahasa yang anda pilih."],
      ["Bolehkah saya memadam data saya?", "Boleh. Hubungi pasukan BizDecide di masarsoftware.com untuk melihat, membetulkan atau memadam data anda pada bila-bila masa."],
    ],
  },
  cta: {
    title: "Buku akaun anda sudah tahu di mana duitnya.",
    sub: "Biar pasukan CFO anda mencarinya.",
    button: "Muat naik fail anda",
  },
};

export const LANDING: Record<Lang, LandingStrings> = { en, ms };
