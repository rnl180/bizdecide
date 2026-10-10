"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
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
  toSales,
  toSuppliers,
  type CsvKind,
  type DataWarning,
  type Mapping,
  type SaleRow,
} from "@/lib/csv";
import { INTAKE, LANGS, setLang, useLang, type Strings } from "@/lib/i18n";
import { DEFAULT_MARKET, MARKETS, localize, marketPack, money } from "@/lib/markets";
import { SERVICE_LABELS, SERVICES, type Service } from "@/lib/types";

type Parsed<T> = { rows: T[]; fileName: string } | null;
type CsvKey = CsvKind;
type RawCsv = { fileName: string; headers: { key: string; label: string }[]; rows: Record<string, string>[]; mapping: Mapping };
type MapperState = RawCsv & { kind: CsvKind; error?: string };
const MAX_DOCS = 20;

function convert(kind: CsvKind, rows: Record<string, string>[], mapping?: Mapping): unknown[] {
  if (kind === "sales") return toSales(rows, mapping);
  if (kind === "purchases") return toPurchases(rows, mapping);
  if (kind === "suppliers") return toSuppliers(rows, mapping);
  if (kind === "bank") return toBank(rows, mapping);
  return toPayables(rows, mapping);
}

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
type Doc = { name: string; path: string };

const SECTORS = ["F&B", "Retail", "Services", "Manufacturing", "Agriculture", "Construction"];

const smooth = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

export default function IntakePage() {
  const router = useRouter();
  const lang = useLang();
  const t = INTAKE[lang];
  const [market, setMarket] = useState(DEFAULT_MARKET);
  const [name, setName] = useState("");
  const [sector, setSector] = useState("F&B");
  const [state, setState] = useState("Selangor");
  const [employees, setEmployees] = useState("");
  const [annualSales, setAnnualSales] = useState("");
  const [registeredSince, setRegisteredSince] = useState("");
  const [goal, setGoal] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [sales, setSales] = useState<Parsed<ReturnType<typeof toSales>[number]>>(null);
  const [purchases, setPurchases] = useState<Parsed<ReturnType<typeof toPurchases>[number]>>(null);
  const [suppliers, setSuppliers] = useState<Parsed<ReturnType<typeof toSuppliers>[number]>>(null);
  const [bank, setBank] = useState<Parsed<ReturnType<typeof toBank>[number]>>(null);
  const [payables, setPayables] = useState<Parsed<ReturnType<typeof toPayables>[number]>>(null);
  const [raw, setRaw] = useState<Partial<Record<CsvKind, RawCsv>>>({}); // each file as read, for "which column is which?"
  const [mapper, setMapper] = useState<MapperState | null>(null);
  const [warnings, setWarnings] = useState<Partial<Record<CsvKind, DataWarning[]>>>({});
  const [agreed, setAgreed] = useState(false);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [service, setService] = useState<Service>("cfo_brief");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Partial<Record<CsvKey | "documents", string>>>({});

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [tried, setTried] = useState([false, false]);
  const [demoLoaded, setDemoLoaded] = useState(false);
  // Bank statement, payables ledger and owner details from the demo pack (not collected by the form yet)
  const [demoExtras, setDemoExtras] = useState<Record<string, unknown>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const hasBusiness = name.trim() !== "";
  const hasNumbers = Boolean(sales?.rows.length || purchases?.rows.length);
  const ready = hasBusiness && hasNumbers;
  const complete = [hasBusiness, hasNumbers, false];

  // Regions, currency, registry and ownership options come from the market pack.
  const pack = localize(marketPack(market) ?? marketPack(DEFAULT_MARKET)!, lang);
  const marketName = (m: { code: string; name: string }) => t.marketNames[m.code] ?? m.name;
  const liveMarkets = MARKETS.filter((m) => m.pack).map(marketName);
  const samples = pack.demo ? pack.demo.replace(/[^/]+$/, "") : "/demo/"; // sample CSVs sit next to the market's demo

  const chooseMarket = (code: string) => {
    setMarket(code);
    setState("");
    setFlags([]);
  };
  const toggleFlag = (f: string) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  const setFileError = (key: CsvKey | "documents", msg?: string) => setFileErrors((e) => ({ ...e, [key]: msg }));

  function goTo(n: number, { forceScroll = false } = {}) {
    setStep(n);
    setReached((r) => Math.max(r, n));
    requestAnimationFrame(() => {
      const el = document.getElementById("start");
      if (el && (forceScroll || el.getBoundingClientRect().top < 0)) el.scrollIntoView({ behavior: smooth(), block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  function next() {
    if (step === 0 && !hasBusiness) {
      setTried(([, b]) => [true, b]);
      nameRef.current?.focus();
      return;
    }
    if (step === 1 && !hasNumbers) {
      setTried(([a]) => [a, true]);
      return;
    }
    goTo(step + 1);
  }

  // Reads a CSV with the best column guess. If that finds nothing, ask the owner which column is which.
  async function readCsv(kind: CsvKind, file: File | undefined) {
    if (!file) return;
    const table = parseCsvTable(await file.text());
    const entry: RawCsv = { fileName: file.name, headers: table.headers, rows: table.rows, mapping: guessMapping(kind, table.rows) };
    setRaw((r) => ({ ...r, [kind]: entry }));
    const out = convert(kind, table.rows);
    if (out.length) return accept(kind, file.name, out);
    if (!table.headers.length) return setFileError(kind, t.readErr(file.name));
    setFileError(kind, undefined);
    setMapper({ kind, ...entry });
  }

  function accept(kind: CsvKind, fileName: string, out: unknown[]) {
    setFileError(kind, undefined);
    setMapper((m) => (m?.kind === kind ? null : m));
    setWarnings((w) => ({ ...w, [kind]: warningsFor(kind, out) }));
    const p = { rows: out, fileName } as never;
    if (kind === "sales") setSales(p);
    else if (kind === "purchases") setPurchases(p);
    else if (kind === "suppliers") setSuppliers(p);
    else if (kind === "bank") setBank(p);
    else setPayables(p);
  }

  function applyColumns() {
    if (!mapper) return;
    if (missingRequired(mapper.kind, mapper.mapping).length) return setMapper({ ...mapper, error: t.mapRequired });
    const out = convert(mapper.kind, mapper.rows, mapper.mapping);
    if (!out.length) return setMapper({ ...mapper, error: t.readErr(mapper.fileName) });
    const { kind, error: _e, ...entry } = mapper;
    setRaw((r) => ({ ...r, [kind]: entry }));
    accept(kind, mapper.fileName, out);
  }

  function clearFile(kind: CsvKind) {
    if (kind === "sales") setSales(null);
    else if (kind === "purchases") setPurchases(null);
    else if (kind === "suppliers") setSuppliers(null);
    else if (kind === "bank") setBank(null);
    else setPayables(null);
    setRaw(({ [kind]: _r, ...rest }) => rest);
    setWarnings(({ [kind]: _w, ...rest }) => rest);
    setMapper((m) => (m?.kind === kind ? null : m));
  }

  // "Tarikh → Date · Jumlah Jualan (RM) → Sales amount": what we read, so the owner can check it.
  const colsText = (kind: CsvKind) => {
    const r = raw[kind];
    if (!r) return undefined;
    if (kind === "sales" && detectSalesFormat(r.rows) !== "generic") return "StoreHub";
    return FIELDS[kind]
      .filter((f) => f.required && r.mapping[f.key])
      .map((f) => `${r.headers.find((h) => h.key === r.mapping[f.key])?.label ?? r.mapping[f.key]} → ${t.mapFields[f.key] ?? f.key}`)
      .join(" · ");
  };
  const fileNotes = (kind: CsvKind) => (
    <>
      {colsText(kind) && (
        <p className="cols-used">
          {t.colsUsed}: {colsText(kind)}
          {raw[kind] && !(kind === "sales" && colsText(kind) === "StoreHub") && (
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
              <li key={w.code}>{w.code === "outlier" ? t.warn.outlier(w.count, money(market)(w.example ?? 0)) : t.warn[w.code](w.count)}</li>
            ))}
          </ul>
        </div>
      )}
      {mapper?.kind === kind && (
        <ColumnPicker
          t={t}
          state={mapper}
          onChange={(mapping) => setMapper({ ...mapper, mapping, error: undefined })}
          onUse={applyColumns}
          onCancel={() => setMapper(null)}
        />
      )}
    </>
  );

  async function uploadDocs(files: File[]) {
    if (!files.length) return;
    setFileError("documents", undefined);
    if (documents.length + files.length > MAX_DOCS) {
      setFileError("documents", t.docsMax);
      files = files.slice(0, Math.max(0, MAX_DOCS - documents.length));
      if (!files.length) return;
    }
    setUploading(true);
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setFileError("documents", `${file.name}: ${data.error}`);
          continue;
        }
        setDocuments((d) => [...d, { name: file.name, path: data.path }]);
      } catch {
        setFileError("documents", t.uploadFailed(file.name));
      }
    }
    setUploading(false);
  }

  async function loadDemo() {
    const b = await fetch(pack.demo ?? "/demo/kedai-kopi-aminah.json").then((r) => r.json());
    const p = b.profile;
    setMarket(p.market ?? DEFAULT_MARKET);
    setName(p.name);
    setSector(p.sector);
    setState(p.state ?? "");
    setEmployees(String(p.employeesFullTime ?? ""));
    setAnnualSales(String(p.annualSalesDeclaredRm ?? ""));
    setRegisteredSince(p.registeredSince ?? "");
    setGoal(p.goal ?? "");
    setFlags(p.ownershipFlags ?? []);
    setSales({ rows: b.sales, fileName: "sales.csv (demo)" });
    setPurchases({ rows: b.purchases, fileName: "purchases.csv (demo)" });
    setSuppliers({ rows: b.suppliers, fileName: "suppliers.csv (demo)" });
    setBank(b.bank?.length ? { rows: b.bank, fileName: "bank.csv (demo)" } : null);
    setPayables(b.payables?.length ? { rows: b.payables, fileName: "bills-paid.csv (demo)" } : null);
    setDemoExtras({ profileExtras: b.profileExtras }); // owner details the form doesn't ask for
    setRaw({});
    setWarnings({});
    setMapper(null);
    setError(null);
    setFileErrors({});
    setDemoLoaded(true);
    goTo(2, { forceScroll: true });
  }

  async function submit() {
    if (!agreed) return setError(t.privacyErr);
    setBusy(true);
    setError(null);
    try {
      const business = {
        profile: {
          market,
          name: name.trim(),
          sector,
          state: state || undefined,
          employeesFullTime: employees ? Number(employees) : undefined,
          annualSalesDeclaredRm: annualSales ? Number(annualSales) : undefined,
          registeredSince: registeredSince || undefined,
          ownershipFlags: flags,
          goal: goal.trim() || undefined,
          language: lang,
        },
        sales: sales?.rows ?? [],
        purchases: purchases?.rows ?? [],
        suppliers: suppliers?.rows ?? [],
        bank: bank?.rows ?? [],
        payables: payables?.rows ?? [],
        ...(demoLoaded ? demoExtras : {}),
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
      saveRequest({ id: rData.id, businessName: name.trim(), service, market, status: "submitted", createdAt: new Date().toISOString() });
      router.push(`/r/${rData.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
      setBusy(false);
    }
  }

  const rows = (p: Parsed<unknown>) => (p ? t.rows(p.rows.length.toLocaleString(pack.locale)) : t.notAdded);
  const showNameError = tried[0] && !hasBusiness;
  const showNumbersError = tried[1] && !hasNumbers;
  const hint = [showNameError ? "" : t.hints[0], showNumbersError ? "" : t.hints[1], t.hints[2]][step];
  const STEPS = t.steps;

  return (
    <>
      <section className="hero-band">
        <div className="container hero">
          <div>
            <div className="lang-toggle" role="group" aria-label={t.langLabel}>
              {LANGS.map((l) => (
                <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
            <span className="eyebrow">
              <Icon name="sparkles" size={14} /> {t.eyebrow(marketName(pack))}
            </span>
            <h1>
              {t.h1[0]} <span className="hl">{t.h1[1]}</span>
            </h1>
            <p className="lede">{t.lede}</p>
            <div className="row">
              <a href="#start" className="btn btn-primary btn-lg">
                {t.getStarted} <Icon name="arrowRight" />
              </a>
              <button className="btn btn-secondary btn-lg" onClick={loadDemo} type="button">
                <Icon name="store" /> {t.tryDemo}
              </button>
            </div>
            <ul className="hero-points">
              {t.points(pack.currencyName).map((p) => (
                <li key={p}>
                  <span className="tick">
                    <Icon name="check" size={12} strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <aside className="how" aria-labelledby="how-title">
            <div className="how-head">
              <h2 id="how-title">{t.howTitle}</h2>
            </div>
            <ol className="how-steps">
              {(["upload", "sparkles", "clipboard"] as const).map((icon, i) => {
                const [title, body] = t.how(pack.currencyName)[i]!;
                return (
                <li className="how-step" key={title}>
                  <span className="how-icon">
                    <Icon name={icon} size={20} />
                  </span>
                  <div>
                    <strong>
                      {i + 1}. {title}
                    </strong>
                    <span>{body}</span>
                  </div>
                </li>
                );
              })}
            </ol>
            <div className="agents" aria-label={t.agentsAria}>
              {t.agents.map((a) => (
                <span className="chip" key={a}>
                  {a}
                </span>
              ))}
            </div>
            <a href="/skills" className="how-foot">
              {t.skillsAsk}
              <b>
                {t.skillsGet} <Icon name="arrowRight" size={14} />
              </b>
            </a>
          </aside>
        </div>
      </section>

      <RecentRequests />

      <section id="start" className="container section">
        <div className="section-head">
          <div className="kicker">{t.kicker}</div>
          <h2>{t.startTitle}</h2>
          <p className="muted">
            {t.startSub[0]}
            <strong>{t.startSub[1]}</strong>
            {t.startSub[2]}
          </p>
        </div>

        <div className="wizard">
          <aside className="stepper" aria-label={t.progressAria}>
            <ol className="steps">
              {STEPS.map((s, i) => {
                const done = i !== step && i <= reached && complete[i];
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      className={`step-btn${done ? " done" : ""}`}
                      aria-current={i === step ? "step" : undefined}
                      disabled={i > reached}
                      onClick={() => goTo(i)}
                    >
                      <span className="step-dot">{done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.sub}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="side-help">
              <strong>{t.exploring}</strong>
              <p className="muted" style={{ margin: "0 0 10px" }}>
                {t.exploringBody}
              </p>
              <ul>
                {["sales", "purchases", "suppliers"].map((f) => (
                  <li key={f}>
                    <a href={`${samples}${f}.csv`} download>
                      <Icon name="download" size={14} /> {f}.csv
                    </a>
                  </li>
                ))}
              </ul>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={loadDemo} type="button">
                <Icon name="store" size={16} /> {t.loadDemoCafe}
              </button>
            </div>
          </aside>

          <div>
            <div className="stepper-mobile" aria-hidden="true">
              <div className="progress" style={{ marginBottom: 16 }}>
                <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>

            <div className="card panel">
              {step === 0 && (
                <>
                  <div className="panel-head">
                    <div className="step-label">{t.stepOf(1)}</div>
                    <h2 ref={headingRef} tabIndex={-1}>
                      {t.s1Title}
                    </h2>
                    <p>{t.s1Sub}</p>
                  </div>
                  <div className="panel-body">
                    <div className="form-section">
                      <div className="form-section-head">
                        <h3 id="market-label">{t.marketTitle}</h3>
                        <p>{t.marketSub(liveMarkets)}</p>
                      </div>
                      <div className="chips" role="radiogroup" aria-labelledby="market-label">
                        {MARKETS.map((m) => (
                          <label key={m.code} className="chip-toggle" data-on={market === m.code}>
                            <input
                              type="radio"
                              name="market"
                              className="sr-only"
                              checked={market === m.code}
                              disabled={!m.pack}
                              onChange={() => chooseMarket(m.code)}
                            />
                            {marketName(m)}
                            {!m.pack && <span className="pill optional">{t.soon}</span>}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <h3>{t.basics}</h3>
                      </div>
                      <div className="fields">
                        <div className="field full">
                          <label htmlFor="name">
                            {t.businessName}
                            <span className="req" aria-hidden="true">
                              *
                            </span>
                          </label>
                          <input
                            ref={nameRef}
                            id="name"
                            type="text"
                            required
                            autoComplete="organization"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t.namePh}
                            aria-invalid={showNameError}
                            aria-describedby={showNameError ? "name-err" : undefined}
                          />
                          {showNameError && (
                            <p className="field-error" id="name-err">
                              <Icon name="alert" size={14} /> {t.nameErr}
                            </p>
                          )}
                        </div>

                        <div className="field full">
                          <span className="label" id="sector-label">
                            {t.sector}
                          </span>
                          <div className="chips" role="radiogroup" aria-labelledby="sector-label">
                            {SECTORS.map((s) => (
                              <label key={s} className="chip-toggle" data-on={sector === s}>
                                <input type="radio" name="sector" className="sr-only" checked={sector === s} onChange={() => setSector(s)} />
                                {t.sectors[s] ?? s}
                              </label>
                            ))}
                          </div>
                        </div>

                        {pack.regions.length > 0 && (
                          <div className="field">
                            <label htmlFor="state">{pack.regionLabel}</label>
                            <select id="state" value={state} onChange={(e) => setState(e.target.value)}>
                              <option value="">{t.selectRegion(pack.regionLabel)}</option>
                              {pack.regions.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                              {state && !pack.regions.includes(state) && <option>{state}</option>}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <h3>
                          {t.moreTitle} <span className="pill optional">{t.optional}</span>
                        </h3>
                        <p>{t.moreSub}</p>
                      </div>
                      <div className="fields">
                        <div className="field">
                          <label htmlFor="emp">{t.employees}</label>
                          <input id="emp" type="number" inputMode="numeric" min={0} value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder={t.employeesPh} />
                        </div>

                        <div className="field">
                          <label htmlFor="sales">{t.annualSales}</label>
                          <div className="input-group">
                            <span className="addon">{pack.currencySymbol}</span>
                            <input
                              id="sales"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={annualSales}
                              onChange={(e) => setAnnualSales(e.target.value)}
                              placeholder={t.salesPh}
                              aria-describedby="sales-help"
                            />
                          </div>
                          <p className="help" id="sales-help">
                            {t.salesHelp}
                          </p>
                        </div>

                        <div className="field">
                          <label htmlFor="since">{pack.registry.sinceLabel}</label>
                          <input id="since" type="month" value={registeredSince} onChange={(e) => setRegisteredSince(e.target.value)} placeholder="2023-02" />
                        </div>

                        <div className="field">
                          <label htmlFor="goal">{t.goal}</label>
                          <input id="goal" type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t.goalPh} />
                        </div>

                        {pack.ownershipFlags.length > 0 && (
                          <div className="field full">
                            <span className="label" id="flags-label">
                              {t.ownership}
                            </span>
                            <div className="chips" role="group" aria-labelledby="flags-label" aria-describedby="flags-help">
                              {pack.ownershipFlags.map(({ id: v, label: l }) => (
                                <label key={v} className="chip-toggle" data-on={flags.includes(v)}>
                                  <input type="checkbox" className="sr-only" checked={flags.includes(v)} onChange={() => toggleFlag(v)} />
                                  <span className="box">
                                    <Icon name="check" size={11} strokeWidth={3.5} />
                                  </span>
                                  {l}
                                </label>
                              ))}
                            </div>
                            <p className="help" id="flags-help">
                              {pack.ownershipHelp}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="panel-head">
                    <div className="step-label">{t.stepOf(2)}</div>
                    <h2 ref={headingRef} tabIndex={-1}>
                      {t.s2Title}
                    </h2>
                    <p>{t.s2Sub}</p>
                  </div>
                  <div className="panel-body">
                    {showNumbersError && (
                      <div className="notice error" role="alert">
                        <Icon name="alert" />
                        <p>{t.numbersErr}</p>
                      </div>
                    )}
                    <div className="form-section">
                      <div className="form-section-head">
                        <h3>
                          {t.salesOrPurchases}{" "}
                          {hasNumbers ? <span className="pill done">{t.done}</span> : <span className="pill required">{t.addOne}</span>}
                        </h3>
                        <p>{t.analyseSub}</p>
                      </div>
                      <div className="uploads">
                        <DropCard
                          t={t.drop}
                          icon="chart"
                          title={t.sales}
                          cols={t.salesCols}
                          sample={`${samples}sales.csv`}
                          accept=".csv,text/csv"
                          done={Boolean(sales)}
                          error={fileErrors.sales}
                          onFiles={(f) => readCsv("sales", f[0])}
                        >
                          {sales && <FileRow name={sales.fileName} meta={rows(sales)} onRemove={() => clearFile("sales")} label={t.removeFile.sales} />}
                          {fileNotes("sales")}
                        </DropCard>
                        <DropCard
                          t={t.drop}
                          icon="receipt"
                          title={t.purchases}
                          cols={t.purchasesCols}
                          sample={`${samples}purchases.csv`}
                          accept=".csv,text/csv"
                          done={Boolean(purchases)}
                          error={fileErrors.purchases}
                          onFiles={(f) => readCsv("purchases", f[0])}
                        >
                          {purchases && (
                            <FileRow name={purchases.fileName} meta={rows(purchases)} onRemove={() => clearFile("purchases")} label={t.removeFile.purchases} />
                          )}
                          {fileNotes("purchases")}
                        </DropCard>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <h3>
                          {t.extraTitle} <span className="pill optional">{t.optional}</span>
                        </h3>
                        <p>{t.extraSub}</p>
                      </div>
                      <div className="uploads">
                        <DropCard
                          t={t.drop}
                          icon="truck"
                          title={t.suppliers}
                          cols={t.suppliersCols}
                          sample={`${samples}suppliers.csv`}
                          accept=".csv,text/csv"
                          done={Boolean(suppliers)}
                          error={fileErrors.suppliers}
                          onFiles={(f) => readCsv("suppliers", f[0])}
                        >
                          {suppliers && (
                            <FileRow name={suppliers.fileName} meta={rows(suppliers)} onRemove={() => clearFile("suppliers")} label={t.removeFile.suppliers} />
                          )}
                          {fileNotes("suppliers")}
                        </DropCard>
                        <DropCard
                          t={t.drop}
                          icon="landmark"
                          title={t.bank}
                          cols={t.bankCols}
                          sample={`${samples}bank.csv`}
                          accept=".csv,text/csv"
                          done={Boolean(bank)}
                          error={fileErrors.bank}
                          onFiles={(f) => readCsv("bank", f[0])}
                        >
                          {bank && <FileRow name={bank.fileName} meta={rows(bank)} onRemove={() => clearFile("bank")} label={t.removeExtra.bank} />}
                          {fileNotes("bank")}
                        </DropCard>
                        <DropCard
                          t={t.drop}
                          icon="receipt"
                          title={t.payables}
                          cols={t.payablesCols}
                          accept=".csv,text/csv"
                          done={Boolean(payables)}
                          error={fileErrors.payables}
                          onFiles={(f) => readCsv("payables", f[0])}
                        >
                          {payables && (
                            <FileRow name={payables.fileName} meta={rows(payables)} onRemove={() => clearFile("payables")} label={t.removeExtra.payables} />
                          )}
                          {fileNotes("payables")}
                        </DropCard>
                        <DropCard
                          t={t.drop}
                          icon="file"
                          title={t.documents}
                          cols={t.docsCols(pack.registry.name)}
                          accept=".pdf,image/*"
                          multiple
                          busy={uploading}
                          done={documents.length > 0}
                          error={fileErrors.documents}
                          onFiles={uploadDocs}
                        >
                          {documents.length > 0 && (
                            <ul className="file-list">
                              {documents.map((d) => (
                                <li key={d.path}>
                                  <FileRow
                                    name={d.name}
                                    meta={t.uploaded}
                                    label={t.removeDoc(d.name)}
                                    onRemove={() => setDocuments((x) => x.filter((y) => y.path !== d.path))}
                                  />
                                </li>
                              ))}
                            </ul>
                          )}
                        </DropCard>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="panel-head">
                    <div className="step-label">{t.stepOf(3)}</div>
                    <h2 ref={headingRef} tabIndex={-1}>
                      {t.s3Title}
                    </h2>
                    <p>{t.s3Sub}</p>
                  </div>
                  <div className="panel-body">
                    {demoLoaded && (
                      <div className="notice">
                        <Icon name="store" />
                        <p>
                          <strong>{t.demoLoaded}</strong>
                          {t.demoLoadedBody(name)}
                        </p>
                      </div>
                    )}
                    {!ready && (
                      <div className="notice warn">
                        <Icon name="alert" />
                        <p>{t.notReady}</p>
                      </div>
                    )}
                    <div className="services" role="radiogroup" aria-label={t.serviceAria}>
                      {SERVICES.map((s) => (
                        <label key={s} className="service" data-on={service === s}>
                          <input type="radio" name="service" className="sr-only" checked={service === s} onChange={() => setService(s)} />
                          <span className="service-icon">
                            <Icon name={SERVICE_ICONS[s]} size={20} />
                          </span>
                          <span>
                            <span className="s-title">
                              {(t.services ?? SERVICE_LABELS)[s].title}
                              {s === "cfo_brief" && <span className="badge">{t.recommended}</span>}
                            </span>
                            <span className="s-desc">{(t.services ?? SERVICE_LABELS)[s].blurb}</span>
                          </span>
                          <span className="radio">
                            <Icon name="check" size={12} strokeWidth={3.5} />
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="summary">
                      <div className="summary-head">{t.summaryHead}</div>
                      <dl>
                        <div>
                          <dt>{t.sumBusiness}</dt>
                          <dd>{name.trim() || t.notAdded}</dd>
                        </div>
                        <div>
                          <dt>{t.sumMarket}</dt>
                          <dd>{marketName(pack)}</dd>
                        </div>
                        <div>
                          <dt>{t.sumSector(pack.regionLabel)}</dt>
                          <dd>
                            {t.sectors[sector] ?? sector}
                            {state && ` · ${state}`}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.sales}</dt>
                          <dd>{rows(sales)}</dd>
                        </div>
                        <div>
                          <dt>{t.purchases}</dt>
                          <dd>{rows(purchases)}</dd>
                        </div>
                        <div>
                          <dt>{t.suppliers}</dt>
                          <dd>{rows(suppliers)}</dd>
                        </div>
                        <div>
                          <dt>{t.bank}</dt>
                          <dd>{rows(bank)}</dd>
                        </div>
                        <div>
                          <dt>{t.payables}</dt>
                          <dd>{rows(payables)}</dd>
                        </div>
                        <div>
                          <dt>{t.documents}</dt>
                          <dd>{documents.length ? t.docsUploaded(documents.length) : t.none}</dd>
                        </div>
                      </dl>
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
                      <div className="notice error" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
                        <Icon name="alert" />
                        <p>{error}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="panel-foot">
                {step > 0 && (
                  <button className="btn btn-ghost" type="button" onClick={() => goTo(step - 1)}>
                    <Icon name="arrowLeft" /> {t.back}
                  </button>
                )}
                {hint && <span className="hint">{hint}</span>}
                {step < STEPS.length - 1 ? (
                  <button className="btn btn-primary" type="button" onClick={next}>
                    {t.next(STEPS[step + 1]!.title)} <Icon name="arrowRight" />
                  </button>
                ) : (
                  <button className="btn btn-primary" type="button" onClick={submit} disabled={!ready || busy}>
                    {busy ? (
                      <>
                        <Icon name="spinner" className="spin" /> {t.sending}
                      </>
                    ) : (
                      <>
                        {t.getDecisions} <Icon name="arrowRight" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
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

function DropCard({
  t,
  icon,
  title,
  cols,
  sample,
  accept,
  multiple,
  done,
  busy,
  error,
  onFiles,
  children,
}: {
  t: Strings["drop"];
  icon: IconName;
  title: string;
  cols: string;
  sample?: string;
  accept: string;
  multiple?: boolean;
  done: boolean;
  busy?: boolean;
  error?: string;
  onFiles: (files: File[]) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${done ? " is-done" : ""}${over ? " is-over" : ""}${error ? " is-error" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
    >
      <div className="drop-head">
        <span className="drop-icon">
          <Icon name={done ? "check" : icon} />
        </span>
        <div>
          <strong>{title}</strong>
          <span className="cols">{cols}</span>
        </div>
        {sample && (
          <a className="sample-link" href={sample} download>
            <Icon name="download" size={14} /> {t.sample}
          </a>
        )}
      </div>
      {children}
      {(!done || multiple) && (
        <>
          <input
            id={id}
            type="file"
            className="sr-only"
            accept={accept}
            multiple={multiple}
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) onFiles(files);
            }}
          />
          <label htmlFor={id} className="drop-zone">
            {busy ? <Icon name="spinner" size={20} className="spin" /> : <Icon name="upload" size={20} />}
            <span>
              {busy ? (
                t.uploading
              ) : (
                <>
                  <b>{done ? t.addMore : t.click}</b> {t.orDrag}
                </>
              )}
            </span>
            <small>{multiple ? t.docLimit : t.csv}</small>
          </label>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </div>
  );
}

function FileRow({ name, meta, label, onRemove }: { name: string; meta: string; label: string; onRemove: () => void }) {
  return (
    <div className="file-row">
      <Icon name="file" size={18} />
      <div style={{ minWidth: 0 }}>
        <div className="name">{name}</div>
        <div className="meta">{meta}</div>
      </div>
      <button className="icon-btn" type="button" aria-label={label} onClick={onRemove}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
