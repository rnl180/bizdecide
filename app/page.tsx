"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, toPurchases, toSales, toSuppliers } from "@/lib/csv";
import { SERVICE_LABELS, SERVICES, type Service } from "@/lib/types";

type Parsed<T> = { rows: T[]; fileName: string } | null;

export default function IntakePage() {
  const router = useRouter();
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
  const [documents, setDocuments] = useState<string[]>([]);
  const [service, setService] = useState<Service>("cfo_brief");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFlag = (f: string) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  async function readCsv<T>(file: File | undefined, map: (r: Record<string, string>[]) => T[], set: (p: Parsed<T>) => void) {
    if (!file) return;
    const rows = map(parseCsv(await file.text()));
    if (!rows.length) setError(`Couldn't read any rows from ${file.name}. Check the column headers.`);
    else setError(null);
    set({ rows, fileName: file.name });
  }

  async function uploadDocs(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(`${file.name}: ${data.error}`);
        continue;
      }
      setDocuments((d) => [...d, data.path]);
    }
  }

  async function loadDemo() {
    const b = await fetch("/demo/kedai-kopi-aminah.json").then((r) => r.json());
    const p = b.profile;
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
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const business = {
        profile: {
          name: name.trim(),
          sector,
          state: state || undefined,
          employeesFullTime: employees ? Number(employees) : undefined,
          annualSalesDeclaredRm: annualSales ? Number(annualSales) : undefined,
          registeredSince: registeredSince || undefined,
          ownershipFlags: flags,
          goal: goal.trim() || undefined,
        },
        sales: sales?.rows ?? [],
        purchases: purchases?.rows ?? [],
        suppliers: suppliers?.rows ?? [],
      };
      const b = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ business, documents }),
      });
      const bData = await b.json();
      if (!b.ok) throw new Error(bData.error ?? "Couldn't save your business");
      const r = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: bData.id, service }),
      });
      const rData = await r.json();
      if (!r.ok) throw new Error(rData.error ?? "Couldn't create the request");
      router.push(`/r/${rData.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const ready = name.trim() && (sales?.rows.length || purchases?.rows.length);

  return (
    <>
      <section className="hero">
        <div className="kicker">Every tauke deserves a CFO</div>
        <h1>Upload your numbers. Get three decisions.</h1>
        <p className="lede">
          BizDecide reads your sales, purchases and suppliers, then a team of AI agents on Tencent WorkBuddy tells you exactly
          what to do next: where money is leaking, which supplier to switch, which funding you qualify for.
        </p>
        <div className="row">
          <button className="btn btn-ghost" onClick={loadDemo} type="button">
            Load demo café: Kedai Kopi Aminah
          </button>
        </div>
      </section>

      <section className="card">
        <div className="step-title">
          <span className="step-num">1</span>
          <h2>Your business</h2>
        </div>
        <div className="grid">
          <div>
            <label htmlFor="name">Business name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kedai Kopi Aminah" />
          </div>
          <div>
            <label htmlFor="sector">Sector</label>
            <select id="sector" value={sector} onChange={(e) => setSector(e.target.value)}>
              {["F&B", "Retail", "Services", "Manufacturing", "Agriculture", "Construction"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="state">State</label>
            <input id="state" type="text" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div>
            <label htmlFor="emp">Full-time employees</label>
            <input id="emp" type="number" min={0} value={employees} onChange={(e) => setEmployees(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sales">Annual sales (RM, your estimate)</label>
            <input id="sales" type="number" min={0} value={annualSales} onChange={(e) => setAnnualSales(e.target.value)} />
          </div>
          <div>
            <label htmlFor="since">Registered since (SSM)</label>
            <input id="since" type="text" value={registeredSince} onChange={(e) => setRegisteredSince(e.target.value)} placeholder="2023-02" />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label htmlFor="goal">What are you trying to do next? (optional)</label>
          <input id="goal" type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Open a second outlet next year" />
        </div>
        <div className="checks" style={{ marginTop: 14 }}>
          {[
            ["bumiputera", "Bumiputera-owned"],
            ["women_owned", "Women-owned"],
            ["youth_owned", "Owner under 40"],
          ].map(([v, l]) => (
            <label key={v}>
              <input type="checkbox" checked={flags.includes(v!)} onChange={() => toggleFlag(v!)} /> {l}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="step-title">
          <span className="step-num">2</span>
          <h2>Your numbers</h2>
        </div>
        <p className="muted">CSV exports from your POS, bank or Excel. Column names don&apos;t need to be perfect.</p>
        <div className="grid">
          <div className="upload">
            <strong>Sales</strong>
            <span className="muted">period, amount</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => readCsv(e.target.files?.[0], toSales, setSales)} />
            {sales && <div className="ok">✓ {sales.rows.length} rows · {sales.fileName}</div>}
          </div>
          <div className="upload">
            <strong>Purchases</strong>
            <span className="muted">date, supplier, item, qty, unit price, total</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => readCsv(e.target.files?.[0], toPurchases, setPurchases)} />
            {purchases && <div className="ok">✓ {purchases.rows.length} rows · {purchases.fileName}</div>}
          </div>
          <div className="upload">
            <strong>Suppliers</strong>
            <span className="muted">name, category, contact</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => readCsv(e.target.files?.[0], toSuppliers, setSuppliers)} />
            {suppliers && <div className="ok">✓ {suppliers.rows.length} rows · {suppliers.fileName}</div>}
          </div>
          <div className="upload">
            <strong>Documents (optional)</strong>
            <span className="muted">SSM certificate, receipts (PDF or photo)</span>
            <input type="file" multiple accept=".pdf,image/*" onChange={(e) => uploadDocs(e.target.files)} />
            {documents.length > 0 && <div className="ok">✓ {documents.length} uploaded</div>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="step-title">
          <span className="step-num">3</span>
          <h2>What do you need today?</h2>
        </div>
        <div className="services">
          {SERVICES.map((s) => (
            <button key={s} type="button" className="service" aria-pressed={service === s} onClick={() => setService(s)}>
              <strong>{SERVICE_LABELS[s].title}</strong>
              <span>{SERVICE_LABELS[s].blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" onClick={submit} disabled={!ready || busy} type="button">
          {busy ? "Sending to your CFO…" : "Get my decisions →"}
        </button>
        {!ready && <span className="muted">Add a business name and at least sales or purchases.</span>}
      </div>
    </>
  );
}
