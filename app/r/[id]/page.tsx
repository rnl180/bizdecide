"use client";

import { use, useEffect, useState } from "react";
import { SERVICE_LABELS, type QuestionDoc, type RequestDoc, type Result } from "@/lib/types";

type Payload = { request: RequestDoc; question: QuestionDoc | null; result: Result | null };

const rm = (n: number) => `RM${Math.abs(n).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Not found");
        if (stop) return;
        setData(json);
        setError(null);
        if (json.request.status === "completed" || json.request.status === "failed") return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Connection problem, retrying…");
      }
      if (!stop) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!data) return <p className="muted">{error ?? "Loading…"}</p>;
  const { request, question, result } = data;

  if (request.status === "completed" && result) return <Brief request={request} result={result} />;

  return (
    <>
      <section className="hero">
        <div className="kicker">{SERVICE_LABELS[request.service].title}</div>
        <h1>{request.businessName}</h1>
        {request.status === "failed" ? (
          <p className="error">The agents hit a problem: {request.error ?? "unknown error"}</p>
        ) : (
          <p className="lede">
            <span className="pulse" /> Your CFO team is working on it. You can leave this page open; it updates by itself.
          </p>
        )}
      </section>

      {question && <QuestionCard key={question.id} q={question} />}

      <section className="card">
        <h3>What the agents are doing</h3>
        <ul className="timeline">
          {request.progress.map((p, i) => (
            <li key={i}>
              <div className="when">{time(p.at)}</div>
              <strong>{p.step}</strong>
              {p.detail && <div className="muted">{p.detail}</div>}
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="muted">{error}</p>}
    </>
  );
}

function QuestionCard({ q }: { q: QuestionDoc }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!choice) return;
    setErr(null);
    const res = await fetch(`/api/questions/${q.id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: choice, otherText: choice === "__other__" ? other : undefined }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "Couldn't send");
    else setSent(true);
  }

  return (
    <section className="card question" aria-live="polite">
      <div className="kicker">Your CFO needs one answer</div>
      <h2>{q.question}</h2>
      {q.context && <p className="muted mono">{q.context}</p>}
      {sent ? (
        <p>
          <strong>Thanks.</strong> The agents are continuing with your answer.
        </p>
      ) : (
        <>
          <div className="options">
            {q.options.map((o) => (
              <button key={o} type="button" className="option" aria-pressed={choice === o} onClick={() => setChoice(o)}>
                {o}
              </button>
            ))}
            {q.allowOther && (
              <button type="button" className="option" aria-pressed={choice === "__other__"} onClick={() => setChoice("__other__")}>
                Other…
              </button>
            )}
          </div>
          {choice === "__other__" && (
            <textarea rows={2} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Type your answer, e.g. half for the shop, half personal" />
          )}
          {err && <p className="error">{err}</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" type="button" disabled={!choice || (choice === "__other__" && !other.trim())} onClick={send}>
              Send answer
            </button>
            {q.defaultOption && <span className="muted">If you don&apos;t answer, we&apos;ll assume “{q.defaultOption}”.</span>}
          </div>
        </>
      )}
    </section>
  );
}

function Brief({ request, result }: { request: RequestDoc; result: Result }) {
  const order = { urgent: 0, important: 1, opportunity: 2 } as const;
  const decisions = [...result.decisions].sort((a, b) => order[a.priority] - order[b.priority]);
  const total = decisions.reduce((s, d) => s + (d.impactRm && d.impactRm > 0 ? d.impactRm : 0), 0);

  return (
    <article>
      <header className="brief-head" style={{ paddingTop: 20 }}>
        <div className="memo-meta">
          <span>CFO BRIEF</span>
          <span>{request.businessName}</span>
          {result.period && <span>{result.period}</span>}
          {result.smeCategory && <span>{result.smeCategory}</span>}
        </div>
        <h1>{result.headline}</h1>
        {total > 0 && (
          <p className="lede">
            Acting on these decisions is worth about <span className="impact">{rm(total)}</span> a month.
          </p>
        )}
        {result.keyNumbers.length > 0 && (
          <div className="numbers">
            {result.keyNumbers.map((k) => (
              <div className="number" key={k.label}>
                <div className="v">{k.value}</div>
                <div className="l">{k.label}</div>
                {k.note && <div className="l">{k.note}</div>}
              </div>
            ))}
          </div>
        )}
      </header>

      <section>
        {decisions.map((d, i) => (
          <div className="decision" key={i}>
            <div className="n">{i + 1}</div>
            <div>
              <span className={`tag ${d.priority}`}>{d.priority}</span>
              <h2>{d.title}</h2>
              <p className="action">
                {d.action}
                {d.impactRm ? (
                  <>
                    {" "}
                    <span className="impact">
                      {d.impactRm > 0 ? "+" : "−"}
                      {rm(d.impactRm)}/mo
                    </span>
                  </>
                ) : null}
              </p>
              <p>{d.reason}</p>
              {d.evidence.length > 0 && (
                <ul className="evidence">
                  {d.evidence.map((e, j) => (
                    <li key={j}>
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.label}
                        </a>
                      ) : (
                        e.label
                      )}
                      {e.detail && <> · {e.detail}</>}
                    </li>
                  ))}
                </ul>
              )}
              {d.cta && (
                <button className="btn btn-ghost" type="button">
                  {d.cta}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {(result.verification.length > 0 || result.assumptions.length > 0 || result.agentsUsed.length > 0) && (
        <section className="card" style={{ marginTop: 20 }}>
          {result.verification.length > 0 && (
            <details open>
              <summary>How we checked this ({result.verification.filter((v) => v.passed).length}/{result.verification.length} checks passed)</summary>
              <ul className="checklist">
                {result.verification.map((v, i) => (
                  <li key={i}>
                    {v.passed ? "✓" : "✗"} {v.check}
                    {v.detail && <span className="muted"> · {v.detail}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.assumptions.length > 0 && (
            <details>
              <summary>Assumptions</summary>
              <ul>
                {result.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}
          {result.agentsUsed.length > 0 && (
            <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
              Prepared on Tencent WorkBuddy by: {result.agentsUsed.join(" · ")}
            </p>
          )}
          {result.reportUrl && (
            <a className="btn" href={result.reportUrl} target="_blank" rel="noreferrer">
              Download full report (PDF)
            </a>
          )}
        </section>
      )}
    </article>
  );
}
