"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { LandingHero, LandingSections } from "@/components/Landing";
import { LANDING } from "@/lib/i18n-landing";
import { RecentRequests } from "@/components/MyRequests";
import { SERVICE_ICONS } from "@/components/RequestMeta";
import { saveRequest } from "@/lib/myRequests";
import {
  FIELDS,
  dataWarnings,
  detectSalesFormat,
  guessMapping,
  missingRequired,
  parseCsvTable,
  toBank,
  toPayables,
  toPurchases,
  type CsvKind,
  type DataWarning,
  type Mapping,
  type SaleRow,
} from "@/lib/csv";
import { INTAKE, useLang, type Strings } from "@/lib/i18n";
import { QUICK } from "@/lib/i18n-quick";
import {
  KINDS,
  annualSales,
  convertRows,
  detectKind,
  prepare,
  profileFromJson,
  sectorFromPurchases,
  summarize,
  type ProfileGuess,
} from "@/lib/intake";
import { DEFAULT_MARKET, localize, marketPack, money } from "@/lib/markets";
import { SERVICE_LABELS, SERVICES, type Service } from "@/lib/types";

type Table = ReturnType<typeof parseCsvTable>;
type Loaded = { rows: unknown[]; fileName: string };
type RawCsv = { fileName: string; headers: { key: string; label: string }[]; rows: Record<string, string>[]; mapping: Mapping };
type MapperState = RawCsv & { kind: CsvKind; error?: string };
type Doc = { name: string; path: string };

const MAX_DOCS = 20;
const SECTORS = ["F&B", "Retail", "Services", "Manufacturing", "Agriculture", "Construction"];
const KIND_ICON: Record<CsvKind, IconName> = { sales: "chart", purchases: "receipt", suppliers: "truck", bank: "landmark", payables: "calculator" };
const DEMO_FILES: Record<CsvKind, string> = {
  sales: "sales.csv",
  purchases: "purchases.csv",
  suppliers: "suppliers.csv",
  bank: "bank-statement.csv",
  payables: "bills-paid.csv",
};

// Sanity checks shown under each file. They warn; they never block the upload.
function warningsFor(kind: CsvKind, rows: unknown[]): DataWarning[] {
  if (kind === "sales") {
    const r = rows as SaleRow[];
    const perBill = r.some((x) => x.payment !== undefined); // POS transaction exports: equal bills are normal
    return dataWarnings(r.map((x, i) => ({ date: x.period, amount: x.amountRm, refund: x.refund, key: perBill ? String(i) : `${x.period}|${x.amountRm}|${x.channel ?? ""}` })));
  }
  if (kind === "purchases")
    return dataWarnings(
      (rows as ReturnType<typeof toPurchases>).map((x) => ({ date: x.date, amount: x.totalRm, key: `${x.date}|${x.invoiceNo ?? ""}|${x.supplier}|${x.item}|${x.qty ?? ""}|${x.totalRm}` })),
    );
  if (kind === "bank")
    return dataWarnings(
      (rows as ReturnType<typeof toBank>).map((x) => ({
        date: x.date,
        amount: x.creditRm ?? x.debitRm ?? 0,
        key: `${x.date}|${x.description}|${x.reference ?? ""}|${x.debitRm ?? ""}|${x.creditRm ?? ""}|${x.balanceRm ?? ""}`,
      })),
    );
  if (kind === "payables")
    return dataWarnings((rows as ReturnType<typeof toPayables>).map((x) => ({ date: x.invoiceDate ?? x.paidDate ?? "", amount: x.amountRm, key: `${x.invoiceNo}|${x.amountRm}` })));
  return [];
}

const smooth = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

export default function IntakePage() {
  const router = useRouter();
  const lang = useLang();
  const t = INTAKE[lang];
  const q = QUICK[lang];
  const pack = localize(marketPack(DEFAULT_MARKET)!, lang); // BizDecide is built for Malaysia
  const rm = money(DEFAULT_MARKET);

  const [name, setName] = useState("");
  const [sector, setSector] = useState("F&B");
  const [sectorFrom, setSectorFrom] = useState<"profile" | "purchases" | "owner" | null>(null);
  const sectorFromRef = useRef<typeof sectorFrom>(null); // read inside file handlers, which run before a re-render
  const [state, setState] = useState("");
  const [employees, setEmployees] = useState("");
  const [declaredSales, setDeclaredSales] = useState("");
  const [registeredSince, setRegisteredSince] = useState("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [goal, setGoal] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [extras, setExtras] = useState<Record<string, unknown> | undefined>();
  const [profileFile, setProfileFile] = useState<string | null>(null);
  const [data, setData] = useState<Partial<Record<CsvKind, Loaded>>>({});
  const [raw, setRaw] = useState<Partial<Record<CsvKind, RawCsv>>>({}); // each file as read, for "which column is which?"
  const [mapper, setMapper] = useState<MapperState | null>(null);
  const [warnings, setWarnings] = useState<Partial<Record<CsvKind, DataWarning[]>>>({});
  const [unknown, setUnknown] = useState<{ fileName: string; table: Table }[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [over, setOver] = useState(false);
  const [service, setService] = useState<Service>("cfo_brief");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const hasName = name.trim() !== "";
  const hasNumbers = Boolean(data.sales?.rows.length || data.purchases?.rows.length);
  const ready = hasName && hasNumbers;
  const anything = Boolean(profileFile || documents.length || unknown.length || KINDS.some((k) => data[k]));
  const fileCount = KINDS.filter((k) => data[k]).length + (profileFile ? 1 : 0) + documents.length;

  // Once files are in, keep the send step one tap away: a bar at the bottom of the screen while the owner is
  // in the form but the send card is out of view.
  const startRef = useRef<HTMLElement>(null);
  const sendRef = useRef<HTMLDivElement>(null);
  const [inForm, setInForm] = useState(false);
  const [sendInView, setSendInView] = useState(false);
  useEffect(() => {
    const start = startRef.current;
    const send = sendRef.current;
    if (!start || !send || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === start) setInForm(e.isIntersecting);
        if (e.target === send) setSendInView(e.isIntersecting);
      }
    });
    io.observe(start);
    io.observe(send);
    return () => io.disconnect();
  }, []);
  // Phones: past the hero, a "Drop your files" button follows the reader until the form is on screen.
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const turnover = data.sales ? annualSales(data.sales.rows as SaleRow[]) : null;
  const toggleFlag = (f: string) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  const date = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric" });
  const span = (r?: string[]) => (r ? `${date(r[0]!)} – ${date(r[1]!)}` : "");

  function chooseSector(s: string, from: "profile" | "purchases" | "owner") {
    setSector(s);
    setSectorFrom(from);
    sectorFromRef.current = from;
  }

  function accept(kind: CsvKind, fileName: string, rows: unknown[], entry?: RawCsv) {
    setData((d) => ({ ...d, [kind]: { rows, fileName } }));
    setWarnings((w) => ({ ...w, [kind]: warningsFor(kind, rows) }));
    setRaw((r) => {
      const { [kind]: _old, ...rest } = r;
      return entry ? { ...rest, [kind]: entry } : rest;
    });
    setMapper((m) => (m?.kind === kind ? null : m));
    if (kind === "purchases") {
      const guess = sectorFromPurchases((rows as { item: string }[]).map((r) => r.item));
      if (guess && (sectorFromRef.current === null || sectorFromRef.current === "purchases")) chooseSector(guess, "purchases");
    }
  }

  // A table we know the kind of: convert it, or ask which column is which when our guess finds nothing.
  function takeTable(kind: CsvKind, fileName: string, table: Table) {
    const rows = prepare(kind, table.rows);
    const entry: RawCsv = { fileName, headers: table.headers, rows, mapping: guessMapping(kind, rows) };
    const out = convertRows(kind, table.rows);
    if (out.length) return accept(kind, fileName, out, entry);
    setMapper({ kind, ...entry });
  }

  function applyColumns() {
    if (!mapper) return;
    if (missingRequired(mapper.kind, mapper.mapping).length) return setMapper({ ...mapper, error: t.mapRequired });
    const out = convertRows(mapper.kind, mapper.rows, mapper.mapping);
    if (!out.length) return setMapper({ ...mapper, error: t.readErr(mapper.fileName) });
    const { kind, error: _e, ...entry } = mapper;
    accept(kind, mapper.fileName, out, entry);
  }

  function clearKind(kind: CsvKind) {
    setData(({ [kind]: _d, ...rest }) => rest);
    setRaw(({ [kind]: _r, ...rest }) => rest);
    setWarnings(({ [kind]: _w, ...rest }) => rest);
    setMapper((m) => (m?.kind === kind ? null : m));
  }

  function applyProfile(p: ProfileGuess, fileName: string) {
    if (p.name) setName(p.name);
    if (p.sector && SECTORS.includes(p.sector)) chooseSector(p.sector, "profile");
    if (p.state) setState(p.state);
    if (p.employeesFullTime !== undefined) setEmployees(String(p.employeesFullTime));
    if (p.registeredSince) setRegisteredSince(p.registeredSince);
    if (p.ssmNumber) setSsmNumber(p.ssmNumber);
    if (p.goal) setGoal(p.goal);
    if (p.ownershipFlags) setFlags(p.ownershipFlags);
    if (p.extras) setExtras(p.extras);
    setProfileFile(fileName);
  }

  // A whole business in one JSON (the sample kopitiam, or a BizDecide export).
  function loadBusiness(b: Record<string, unknown>, fileName: string) {
    const p = (b.profile ?? {}) as Record<string, unknown>;
    applyProfile(
      {
        name: p.name as string,
        sector: p.sector as string,
        state: p.state as string,
        employeesFullTime: p.employeesFullTime as number | undefined,
        registeredSince: p.registeredSince as string,
        ssmNumber: p.ssmNumber as string,
        goal: p.goal as string,
        ownershipFlags: p.ownershipFlags as string[],
        extras: b.profileExtras as Record<string, unknown>,
      },
      fileName,
    );
    const next: Partial<Record<CsvKind, Loaded>> = {};
    const w: Partial<Record<CsvKind, DataWarning[]>> = {};
    for (const k of KINDS) {
      const rows = b[k];
      if (Array.isArray(rows) && rows.length) {
        next[k] = { rows, fileName: DEMO_FILES[k] };
        w[k] = warningsFor(k, rows);
      }
    }
    setData(next);
    setWarnings(w);
    setRaw({});
    setMapper(null);
    setUnknown([]);
    if (typeof p.annualSalesDeclaredRm === "number") setDeclaredSales(String(p.annualSalesDeclaredRm));
  }

  function readJson(fileName: string, text: string): boolean {
    let j: unknown;
    try {
      j = JSON.parse(text);
    } catch {
      return false;
    }
    if (!j || typeof j !== "object" || Array.isArray(j)) return false;
    const o = j as Record<string, unknown>;
    if (o.profile && (Array.isArray(o.sales) || Array.isArray(o.purchases))) {
      loadBusiness(o, fileName);
      return true;
    }
    const p = profileFromJson(o);
    if (!p) return false;
    applyProfile(p, fileName);
    return true;
  }

  async function uploadDocs(files: File[]) {
    const room = MAX_DOCS - documents.length;
    if (files.length > room) {
      setNotes((n) => [...n, t.docsMax]);
      files = files.slice(0, Math.max(0, room));
    }
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const out = await res.json();
        if (!res.ok) {
          setNotes((n) => [...n, `${file.name}: ${out.error}`]);
          continue;
        }
        setDocuments((d) => [...d, { name: file.name, path: out.path }]);
      } catch {
        setNotes((n) => [...n, t.uploadFailed(file.name)]);
      }
    }
    setUploading(false);
  }

  // Everything the owner drops, in one go: tables are sorted by kind, JSON fills the profile, PDFs and photos are kept.
  async function ingest(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setReading(true);
    setError(null);
    setNotes([]);
    const docs: File[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      try {
        if (/\.(pdf|jpe?g|png|webp|heic|heif)$/.test(lower)) {
          docs.push(file);
          continue;
        }
        if (/\.(xlsx|xls|numbers|ods)$/.test(lower)) {
          problems.push(q.xlsx(file.name));
          continue;
        }
        const text = await file.text();
        if (lower.endsWith(".json")) {
          if (!readJson(file.name, text)) problems.push(q.unreadable(file.name));
          continue;
        }
        const table = parseCsvTable(text);
        if (!table.rows.length) {
          problems.push(q.unreadable(file.name));
          continue;
        }
        const [best] = detectKind(file.name, table.rows);
        if (!best) {
          setUnknown((u) => [...u.filter((x) => x.fileName !== file.name), { fileName: file.name, table }]);
          continue;
        }
        takeTable(best.kind, file.name, table);
      } catch {
        problems.push(q.unreadable(file.name));
      }
    }
    setNotes(problems);
    setReading(false);
    setDemoLoaded(false);
    if (docs.length) await uploadDocs(docs);
  }

  function pickKind(fileName: string, kind: CsvKind) {
    const u = unknown.find((x) => x.fileName === fileName);
    if (!u) return;
    setUnknown((list) => list.filter((x) => x.fileName !== fileName));
    takeTable(kind, fileName, u.table);
  }

  async function loadDemo() {
    try {
      const b = await fetch(pack.demo ?? "/demo/kedai-kopi-aminah.json").then((r) => r.json());
      loadBusiness(b, "kedai-kopi-aminah.json");
      setDocuments([]);
      setNotes([]);
      setError(null);
      setDemoLoaded(true);
    } catch {
      setError(t.errGeneric);
    }
    requestAnimationFrame(() => document.getElementById("start")?.scrollIntoView({ behavior: smooth(), block: "start" }));
  }

  async function submit() {
    setTried(true);
    if (!hasNumbers) return;
    if (!hasName) {
      nameRef.current?.focus();
      return;
    }
    if (!agreed) return setError(t.privacyErr);
    setBusy(true);
    setError(null);
    try {
      const business = {
        profile: {
          market: DEFAULT_MARKET,
          name: name.trim(),
          sector,
          state: state || undefined,
          employeesFullTime: employees ? Number(employees) : undefined,
          annualSalesDeclaredRm: declaredSales ? Number(declaredSales) : undefined,
          registeredSince: registeredSince || undefined,
          ssmNumber: ssmNumber || undefined,
          ownershipFlags: flags,
          goal: goal.trim() || undefined,
          language: lang,
        },
        sales: data.sales?.rows ?? [],
        purchases: data.purchases?.rows ?? [],
        suppliers: data.suppliers?.rows ?? [],
        bank: data.bank?.rows ?? [],
        payables: data.payables?.rows ?? [],
        ...(extras ? { profileExtras: extras } : {}),
      };
      const b = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ business, documents: documents.map((d) => d.path) }),
      });
      const bData = await b.json();
      if (!b.ok) throw new Error(bData.error ?? t.errSave);
      const r = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: bData.id, service }),
      });
      const rData = await r.json();
      if (!r.ok) throw new Error(rData.error ?? t.errRequest);
      saveRequest({ id: rData.id, businessName: name.trim(), service, market: DEFAULT_MARKET, status: "submitted", createdAt: new Date().toISOString() });
      router.push(`/r/${rData.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
      setBusy(false);
    }
  }

  function meta(kind: CsvKind, rows: unknown[]) {
    const s = summarize(kind, rows) as { count: number; months?: number; total?: number; range?: string[]; split?: boolean; suppliers?: number };
    if (kind === "sales") return q.meta.sales(s.count, s.months ?? 0, rm(s.total ?? 0), Boolean(s.split));
    if (kind === "purchases") return q.meta.purchases(s.count, s.suppliers ?? 0, span(s.range));
    if (kind === "suppliers") return q.meta.suppliers(s.count);
    if (kind === "bank") return q.meta.bank(s.count, span(s.range));
    return q.meta.payables(s.count, rm(s.total ?? 0));
  }

  // "Tarikh → Date · Jumlah Jualan (RM) → Sales amount": what we read, so the owner can check it.
  const colsText = (kind: CsvKind) => {
    const r = raw[kind];
    if (!r) return undefined;
    if (kind === "sales" && detectSalesFormat(r.rows) !== "generic") return "StoreHub";
    return FIELDS[kind]
      .filter((f) => f.required && r.mapping[f.key])
      .map((f) => {
        const label = f.key === "amountrm" && kind !== "sales" ? (lang === "ms" ? "Amaun" : "Amount") : (t.mapFields[f.key] ?? f.key);
        return `${r.headers.find((h) => h.key === r.mapping[f.key])?.label ?? r.mapping[f.key]} → ${label}`;
      })
      .join(" · ");
  };

  const fileNotes = (kind: CsvKind) => (
    <>
      {colsText(kind) && (
        <p className="cols-used">
          {t.colsUsed}: {colsText(kind)}
          {raw[kind] && colsText(kind) !== "StoreHub" && (
            <button type="button" className="link-btn" onClick={() => setMapper({ kind, ...raw[kind]! })}>
              {t.changeCols}
            </button>
          )}
        </p>
      )}
      {!!warnings[kind]?.length && (
        <div className="file-warn" role="status">
          <strong>{t.warnTitle}</strong>
          <ul>
            {warnings[kind]!.map((w) => (
              <li key={w.code}>{w.code === "outlier" ? t.warn.outlier(w.count, rm(w.example ?? 0)) : t.warn[w.code](w.count)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const missing = KINDS.filter((k) => !data[k]);
  const nameError = tried && hasNumbers && !hasName;

  return (
    <>
      <LandingHero lang={lang} onTryDemo={loadDemo} />

      <RecentRequests />

      <LandingSections lang={lang} />

      <section id="start" ref={startRef} className="container section qx-section">
        <div className="section-head">
          <div className="kicker">{q.kicker}</div>
          <h2>{q.title}</h2>
          <p className="muted">{q.sub}</p>
        </div>

        <div className="qx">
          <div className="qx-main">
            <div
              className={`qx-drop${over ? " over" : ""}${anything ? " compact" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${q.dropTitle} ${q.choose}`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                void ingest(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept=".csv,.txt,.json,.pdf,.jpg,.jpeg,.png,.webp,.heic,.xlsx,.xls"
                onChange={(e) => {
                  void ingest(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="qx-drop-icon">
                <Icon name={reading || uploading ? "spinner" : "upload"} size={26} className={reading || uploading ? "spin" : undefined} />
              </span>
              <strong>{reading || uploading ? q.reading : over ? q.dropActive : q.dropTitle}</strong>
              <span className="qx-drop-or">{q.choose}</span>
              <small>{q.dropHint}</small>
              <span className="qx-kinds" aria-hidden="true">
                {KINDS.map((k) => (
                  <span key={k} className={`qx-kind${data[k] ? " on" : ""}`}>
                    <Icon name={data[k] ? "check" : KIND_ICON[k]} size={13} strokeWidth={data[k] ? 3 : 2} /> {q.kinds[k]}
                  </span>
                ))}
              </span>
            </div>

            {/* Phones: straight to the camera for paper invoices and receipts. */}
            <label className="btn btn-secondary btn-lg qx-camera">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void ingest(e.target.files);
                  e.target.value = "";
                }}
              />
              <Icon name="camera" /> {q.camera}
            </label>

            {!demoLoaded && (
              <p className="qx-sample">
                {q.noFiles}{" "}
                <button type="button" className="link-btn" onClick={loadDemo}>
                  <Icon name="store" size={14} /> {q.trySample}
                </button>
              </p>
            )}

            {demoLoaded && (
              <div className="notice qx-notice">
                <Icon name="store" />
                <p>{q.demoLoaded(name)}</p>
              </div>
            )}

            {notes.length > 0 && (
              <div className="notice warn qx-notice" role="status">
                <Icon name="alert" />
                <div>
                  {notes.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </div>
              </div>
            )}

            {anything && (
              <div className="card qx-found">
                <div className="qx-card-head">
                  <h3>{q.found}</h3>
                  <span className="chip">{q.filesCount(fileCount)}</span>
                </div>
                <ul className="qx-files">
                  {profileFile && (
                    <li className="qx-file">
                      <span className="qx-file-icon">
                        <Icon name="clipboard" size={18} />
                      </span>
                      <div className="qx-file-main">
                        <div className="qx-file-title">
                          {q.profileFile} <Icon name="check" size={14} strokeWidth={3} className="qx-ok" />
                        </div>
                        <div className="qx-file-meta">{q.profileMeta(name || profileFile)}</div>
                        <div className="qx-file-name">{profileFile}</div>
                      </div>
                    </li>
                  )}
                  {KINDS.filter((k) => data[k]).map((k) => (
                    <li key={k} className="qx-file">
                      <span className="qx-file-icon">
                        <Icon name={KIND_ICON[k]} size={18} />
                      </span>
                      <div className="qx-file-main">
                        <div className="qx-file-title">
                          {q.kinds[k]} <Icon name="check" size={14} strokeWidth={3} className="qx-ok" />
                        </div>
                        <div className="qx-file-meta">{meta(k, data[k]!.rows)}</div>
                        <div className="qx-file-name">
                          {data[k]!.fileName} · {q.kindWhy[k]}
                        </div>
                        {fileNotes(k)}
                        {mapper?.kind === k && (
                          <ColumnPicker
                            t={t}
                            state={mapper}
                            onChange={(mapping) => setMapper({ ...mapper, mapping, error: undefined })}
                            onUse={applyColumns}
                            onCancel={() => setMapper(null)}
                          />
                        )}
                      </div>
                      <button type="button" className="icon-btn" aria-label={`${q.remove} ${data[k]!.fileName}`} onClick={() => clearKind(k)}>
                        <Icon name="x" size={16} />
                      </button>
                    </li>
                  ))}
                  {mapper && !data[mapper.kind] && (
                    <li className="qx-file">
                      <span className="qx-file-icon warn">
                        <Icon name="question" size={18} />
                      </span>
                      <div className="qx-file-main">
                        <div className="qx-file-title">{q.kinds[mapper.kind]}</div>
                        <ColumnPicker
                          t={t}
                          state={mapper}
                          onChange={(mapping) => setMapper({ ...mapper, mapping, error: undefined })}
                          onUse={applyColumns}
                          onCancel={() => setMapper(null)}
                        />
                      </div>
                    </li>
                  )}
                  {unknown.map((u) => (
                    <li key={u.fileName} className="qx-file">
                      <span className="qx-file-icon warn">
                        <Icon name="question" size={18} />
                      </span>
                      <div className="qx-file-main">
                        <div className="qx-file-title">{q.unknownQ(u.fileName)}</div>
                        <div className="qx-pick" role="group" aria-label={q.unknownQ(u.fileName)}>
                          {KINDS.map((k) => (
                            <button key={k} type="button" className="chip-toggle" onClick={() => pickKind(u.fileName, k)}>
                              <Icon name={KIND_ICON[k]} size={14} /> {q.kinds[k]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`${q.remove} ${u.fileName}`}
                        onClick={() => setUnknown((list) => list.filter((x) => x.fileName !== u.fileName))}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </li>
                  ))}
                  {documents.length > 0 && (
                    <li className="qx-file">
                      <span className="qx-file-icon">
                        <Icon name="file" size={18} />
                      </span>
                      <div className="qx-file-main">
                        <div className="qx-file-title">
                          {q.docs(documents.length)} <Icon name="check" size={14} strokeWidth={3} className="qx-ok" />
                        </div>
                        <div className="qx-file-meta">{q.docsMeta}</div>
                        <div className="qx-file-name">{documents.map((d) => d.name).join(" · ")}</div>
                      </div>
                      <button type="button" className="icon-btn" aria-label={q.remove} onClick={() => setDocuments([])}>
                        <Icon name="x" size={16} />
                      </button>
                    </li>
                  )}
                </ul>
                {missing.length > 0 && (
                  <div className="qx-missing">
                    <span>{q.missingTitle}</span>
                    {missing.map((k) => (
                      <span key={k} className="qx-miss" title={q.kindWhy[k]}>
                        <Icon name="plus" size={12} strokeWidth={2.5} /> {q.kinds[k]} <small>· {q.kindWhy[k]}</small>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {anything && (
              <div className="card qx-confirm">
                <div className="qx-card-head">
                  <div>
                    <h3>{q.confirmTitle}</h3>
                    <p className="muted">{q.confirmSub}</p>
                  </div>
                </div>
                <div className="qx-grid">
                  <div className="field">
                    <label htmlFor="biz-name">{q.name}</label>
                    <input
                      id="biz-name"
                      type="text"
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={q.namePh}
                      aria-invalid={nameError || undefined}
                      autoComplete="organization"
                    />
                    {nameError && (
                      <p className="field-error" role="alert">
                        <Icon name="alert" size={14} /> {q.nameErr}
                      </p>
                    )}
                  </div>
                  <div className="field">
                    <span className="label">
                      {q.turnover}
                    </span>
                    {turnover && turnover.total > 0 ? (
                      <div className="qx-readonly">
                        <strong>{rm(turnover.total)}</strong>
                        <span>{q.fromSales(turnover.months)}</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={declaredSales}
                        onChange={(e) => setDeclaredSales(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder={q.salesPh}
                        aria-label={q.salesEstimate}
                      />
                    )}
                  </div>
                  <div className="field qx-wide">
                    <span className="label">
                      {q.sector}
                      {sectorFrom === "purchases" && <small className="qx-src"> · {q.fromPurchases}</small>}
                      {sectorFrom === "profile" && <small className="qx-src"> · {q.fromProfile}</small>}
                    </span>
                    <div className="chips" role="radiogroup" aria-label={q.sector}>
                      {SECTORS.map((s) => (
                        <label key={s} className="chip-toggle" data-on={sector === s}>
                          <input
                            type="radio"
                            name="sector"
                            className="sr-only"
                            checked={sector === s}
                            onChange={() => chooseSector(s, "owner")}
                          />
                          {t.sectors[s] ?? s}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="biz-staff">{q.staff}</label>
                    <input
                      id="biz-staff"
                      type="text"
                      inputMode="numeric"
                      value={employees}
                      onChange={(e) => setEmployees(e.target.value.replace(/\D/g, ""))}
                      placeholder={q.staffPh}
                    />
                    <p className="help">{q.staffHelp}</p>
                  </div>
                  {pack.ownershipFlags.length > 0 && (
                    <div className="field">
                      <span className="label">{q.ownership}</span>
                      <div className="chips">
                        {pack.ownershipFlags.map(({ id: v, label: l }) => (
                          <label key={v} className="chip-toggle" data-on={flags.includes(v)}>
                            <input type="checkbox" className="sr-only" checked={flags.includes(v)} onChange={() => toggleFlag(v)} />
                            <span className="box">{flags.includes(v) && <Icon name="check" size={11} strokeWidth={3.5} />}</span>
                            {l}
                          </label>
                        ))}
                      </div>
                      <p className="help">{q.ownershipHelp}</p>
                    </div>
                  )}
                </div>
                <details className="qx-more" open={Boolean(goal || state) || undefined}>
                  <summary>
                    <Icon name="chevronDown" size={16} /> {q.more}
                  </summary>
                  <div className="qx-grid">
                    {pack.regions.length > 0 && (
                      <div className="field">
                        <label htmlFor="biz-state">{q.state}</label>
                        <select id="biz-state" value={state} onChange={(e) => setState(e.target.value)}>
                          <option value="">{q.selectState}</option>
                          {pack.regions.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                          {state && !pack.regions.includes(state) && <option>{state}</option>}
                        </select>
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="biz-since">{q.since}</label>
                      <input id="biz-since" type="month" value={registeredSince} onChange={(e) => setRegisteredSince(e.target.value)} />
                    </div>
                    <div className="field qx-wide">
                      <label htmlFor="biz-goal">{q.goal}</label>
                      <input id="biz-goal" type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={q.goalPh} />
                    </div>
                  </div>
                </details>
              </div>
            )}

            <div className="card qx-send" ref={sendRef}>
              <h3>{q.serviceTitle}</h3>
              <div className="qx-svcs" role="radiogroup" aria-label={t.serviceAria}>
                {SERVICES.map((s) => (
                  <label key={s} className="qx-svc" data-on={service === s}>
                    <input type="radio" name="service" className="sr-only" checked={service === s} onChange={() => setService(s)} />
                    <Icon name={SERVICE_ICONS[s]} size={18} />
                    <span>
                      <strong>
                        {(t.services ?? SERVICE_LABELS)[s].title}
                        {s === "cfo_brief" && <span className="badge">{t.recommended}</span>}
                      </strong>
                      <small>{(t.services ?? SERVICE_LABELS)[s].blurb}</small>
                    </span>
                  </label>
                ))}
              </div>

              <label className="consent">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked && error === t.privacyErr) setError(null);
                  }}
                />
                <span>
                  {t.privacyAgree[0]}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    {t.privacyAgree[1]}
                  </a>
                  {t.privacyAgree[2]}
                </span>
              </label>

              {error && (
                <div className="notice error" role="alert" style={{ marginTop: 16 }}>
                  <Icon name="alert" />
                  <p>{error}</p>
                </div>
              )}

              <div className="qx-submit-row">
                <button className="btn btn-primary btn-lg" type="button" onClick={submit} disabled={busy}>
                  {busy ? (
                    <>
                      <Icon name="spinner" className="spin" /> {q.sending}
                    </>
                  ) : (
                    <>
                      {q.submit} <Icon name="arrowRight" />
                    </>
                  )}
                </button>
                {tried && !hasNumbers && (
                  <span className="field-error" role="alert">
                    <Icon name="alert" size={14} /> {q.needFiles}
                  </span>
                )}
              </div>
            </div>
          </div>

          <aside className="qx-side">
            <div className="card qx-next">
              <h3>{q.nextTitle}</h3>
              <ol>
                {q.next.map(([title, body], i) => (
                  <li key={title}>
                    <span className="qx-step">{i + 1}</span>
                    <span>
                      <strong>{title}</strong> {body}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="qx-privacy">
                <Icon name="shield" size={14} /> {q.privacy}
              </p>
            </div>
            <div className="card qx-samples">
              <strong>{q.samples}</strong>
              <p className="muted">{q.samplesSub}</p>
              <ul>
                {(["sales", "purchases", "suppliers", "bank"] as const).map((f) => (
                  <li key={f}>
                    <a href={`/demo/${f}.csv`} download>
                      <Icon name="download" size={14} /> {f}.csv
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {!anything && pastHero && !inForm && (
        <div className="qx-pill no-print">
          <a href="#start" className="btn btn-primary btn-lg">
            <Icon name="upload" /> {LANDING[lang].hero.ctaFiles}
          </a>
        </div>
      )}

      {hasNumbers && inForm && !sendInView && !busy && (
        <div className="qx-dock no-print">
          <div className="container qx-dock-inner">
            <p className="qx-dock-text">
              <span className="qx-dock-ok" aria-hidden="true">
                <Icon name="check" size={14} strokeWidth={3} />
              </span>
              <span>
                <b>{q.filesCount(fileCount)}</b> {q.dockReady}
                {name.trim() && <span className="qx-dock-name"> · {name.trim()}</span>}
              </span>
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => sendRef.current?.scrollIntoView({ behavior: smooth(), block: "center" })}
            >
              {q.dockButton} <Icon name="chevronDown" size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ColumnPicker({
  t,
  state,
  onChange,
  onUse,
  onCancel,
}: {
  t: Strings;
  state: MapperState;
  onChange: (m: Mapping) => void;
  onUse: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="col-picker" role="group" aria-label={t.mapTitle}>
      <strong>{t.mapTitle}</strong>
      <p>{t.mapHelp(state.fileName)}</p>
      <div className="col-grid">
        {FIELDS[state.kind].map((f) => (
          <label key={f.key}>
            <span>
              {t.mapFields[f.key] ?? f.key}
              {f.required && <span className="req">*</span>}
            </span>
            <select value={state.mapping[f.key] ?? ""} onChange={(e) => onChange({ ...state.mapping, [f.key]: e.target.value || undefined })}>
              <option value="">{t.mapSkip}</option>
              {state.headers.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {state.error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={14} /> {state.error}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={onUse}>
          {t.mapUse}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {t.mapCancel}
        </button>
      </div>
    </div>
  );
}

