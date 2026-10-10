"use client";

import { useLang } from "@/lib/i18n";

// Privacy notice under Malaysia's Personal Data Protection Act 2010 (notice and choice, s.7).
// Sole proprietors' business records identify them, so their uploads are personal data.
const COPY = {
  en: {
    title: "Privacy notice",
    updated: "Last updated 10 October 2026",
    intro:
      "BizDecide is an AI CFO for small businesses. This notice explains what we collect when you send a request, why, and who can see it. If you run your business as a sole proprietor, your business records are personal data under Malaysia's Personal Data Protection Act 2010.",
    sections: [
      [
        "What we collect",
        "Your business profile (name, market, sector, state, employees, declared annual sales, registration date, ownership details, your goal and language), the files you upload (sales, purchases, suppliers, bank statement lines, bills paid, and documents such as a registration certificate or receipts), your answers to our agents' questions, and messages you send on your brief page.",
      ],
      [
        "Why we use it",
        "Only to prepare your CFO brief: to analyse your numbers, check them, match you to funding programmes and answer your questions. We don't sell your data or use it for advertising.",
      ],
      [
        "Who processes it",
        "Your data is stored on BizDecide's server. Our AI agents run on Tencent WorkBuddy and read your data through a private link that expires after 15 minutes. WorkBuddy's AI services may process it outside Malaysia.",
      ],
      [
        "Who can see your brief",
        "Anyone who has the link to your request page can see your brief, including the figures in it. Links are random and are not listed anywhere, so share yours only with people you trust. The \"My requests\" list is saved only in your own browser.",
      ],
      [
        "How long we keep it",
        "We keep your data while BizDecide runs as a pilot. You can ask us to delete it at any time.",
      ],
      [
        "Your choices",
        "Everything except your business name and one sales or purchases file is optional. Upload only what you need; you can remove columns such as customer names first. To see, correct or delete your data, or to withdraw your consent, contact the BizDecide team at masarsoftware.com.",
      ],
    ],
  },
  ms: {
    title: "Notis privasi",
    updated: "Dikemas kini 10 Oktober 2026",
    intro:
      "BizDecide ialah CFO AI untuk perniagaan kecil. Notis ini menerangkan apa yang kami kumpul apabila anda menghantar permintaan, sebabnya, dan siapa yang boleh melihatnya. Jika perniagaan anda milikan tunggal, rekod perniagaan anda ialah data peribadi di bawah Akta Perlindungan Data Peribadi 2010.",
    sections: [
      [
        "Apa yang kami kumpul",
        "Profil perniagaan anda (nama, pasaran, sektor, negeri, pekerja, jualan tahunan yang diisytiharkan, tarikh pendaftaran, butiran pemilikan, matlamat dan bahasa anda), fail yang anda muat naik (jualan, belian, pembekal, baris penyata bank, bil dibayar, dan dokumen seperti sijil pendaftaran atau resit), jawapan anda kepada soalan ejen kami, dan mesej yang anda hantar di halaman ringkasan anda.",
      ],
      [
        "Mengapa kami menggunakannya",
        "Hanya untuk menyediakan ringkasan CFO anda: menganalisis angka anda, menyemaknya, memadankan anda dengan program pembiayaan dan menjawab soalan anda. Kami tidak menjual data anda atau menggunakannya untuk pengiklanan.",
      ],
      [
        "Siapa yang memprosesnya",
        "Data anda disimpan di pelayan BizDecide. Ejen AI kami berjalan di Tencent WorkBuddy dan membaca data anda melalui pautan peribadi yang tamat selepas 15 minit. Perkhidmatan AI WorkBuddy mungkin memprosesnya di luar Malaysia.",
      ],
      [
        "Siapa yang boleh melihat ringkasan anda",
        "Sesiapa yang mempunyai pautan ke halaman permintaan anda boleh melihat ringkasan anda, termasuk angka di dalamnya. Pautan adalah rawak dan tidak disenaraikan di mana-mana, jadi kongsi pautan anda hanya dengan orang yang anda percayai. Senarai \"Permintaan saya\" hanya disimpan dalam pelayar anda sendiri.",
      ],
      [
        "Berapa lama kami menyimpannya",
        "Kami menyimpan data anda sepanjang BizDecide berjalan sebagai perintis. Anda boleh meminta kami memadamnya pada bila-bila masa.",
      ],
      [
        "Pilihan anda",
        "Semua maklumat kecuali nama perniagaan dan satu fail jualan atau belian adalah pilihan. Muat naik hanya apa yang perlu; anda boleh membuang lajur seperti nama pelanggan dahulu. Untuk melihat, membetulkan atau memadam data anda, atau menarik balik persetujuan, hubungi pasukan BizDecide di masarsoftware.com.",
      ],
    ],
  },
} as const;

export function PrivacyNotice() {
  const c = COPY[useLang()];
  return (
    <article className="container container-narrow page privacy">
      <header className="page-head">
        <div>
          <h1>{c.title}</h1>
          <p className="muted">{c.updated}</p>
        </div>
      </header>
      <div className="card">
        <p className="lede">{c.intro}</p>
        {c.sections.map(([h, body]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
