"use client";

import { use, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { STATUS } from "@/components/RequestMeta";
import { INTAKE, useLang } from "@/lib/i18n";
import { APP, ago, type AppStrings } from "@/lib/i18n-app";
import { impactKind, impactTotals } from "@/lib/impact";
import { money } from "@/lib/markets";
import { saveRequest, toSaved } from "@/lib/myRequests";
import {
  SERVICE_LABELS,
  type ApplicationPack,
  type ChatMessageDoc,
  type Decision,
  type QuestionDoc,
  type RequestDoc,
  type RequestStatus,
  type Result,
} from "@/lib/types";

type Payload = { request: RequestDoc; question: QuestionDoc | null; result: Result | null; messages?: ChatMessageDoc[] };

const time = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Re-renders every `ms` so relative times ("2 min ago") stay current. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "+RM82/mo", "+RM954 one-off", "RM40,000 funding", in the page language. */
function impactText(d: Decision, rm: (n: number) => string, t: AppStrings) {
  if (!d.impactRm) return "";
  const kind = impactKind(d);
  if (kind === "financing") return `${rm(d.impactRm)} ${t.funding}`;
  const sign = d.impactRm > 0 ? "+" : "−";
  return kind === "one_off" ? `${sign}${rm(d.impactRm)} ${t.oneOff}` : `${sign}${rm(d.impactRm)}${t.perMonth}`;
}

/** Service name in the page language. */
const serviceTitle = (lang: "en" | "ms", s: RequestDoc["service"]) => (INTAKE[lang].services ?? SERVICE_LABELS)[s].title;

// English names are matched against the agent-written agentsUsed; display text comes from APP[lang].team.
const TEAM: [IconName, string, string][] = [
  ["calculator", "Bookkeeper", "Profit and loss, costs by category, duplicates"],
  ["search", "Procurement", "Hidden supplier price rises and alternatives"],
  ["tag", "Classifier", "Your official SME category"],
  ["landmark", "Funding", "Programmes you qualify for, and how to apply"],
  ["shield", "Verifier", "Reconciles totals, checks every figure and link"],
  ["send", "Delivery", "Writes your three decisions"],
];

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = useLang(data?.request.language);
  const t = APP[lang];
  const now = useNow(30_000);

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
        saveRequest(toSaved(json.request, json.result));
        if (json.request.status === "completed" || json.request.status === "failed") return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : ""); // "" → t.connRetry
      }
      if (!stop) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!data) {
    return (
      <div className="container container-narrow page">
        {error ? (
          <div className="card empty">
            <span className="empty-icon">
              <Icon name="alert" size={22} />
            </span>
            <h2>{t.loadErrTitle}</h2>
            <p className="muted">{t.loadErrBody(error || t.connRetry)}</p>
            <a href="/" className="btn btn-secondary">
              <Icon name="arrowLeft" /> {t.backHome}
            </a>
          </div>
        ) : (
          <div aria-busy="true" aria-label={t.loading}>
            <div className="skeleton" style={{ width: 120, height: 14, marginBottom: 24 }} />
            <div className="skeleton" style={{ width: "55%", height: 36, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: "40%", height: 16, marginBottom: 32 }} />
            <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
          </div>
        )}
      </div>
    );
  }

  const { request, question, result } = data;
  if (request.status === "completed" && result) return <Brief request={request} result={result} messages={data.messages ?? []} t={t} lang={lang} />;

  const status = STATUS[request.status];
  const queued = request.status === "submitted";
  const running = request.status === "submitted" || request.status === "processing";

  return (
    <div className="container container-narrow page">
      <a href="/" className="back-link">
        <Icon name="arrowLeft" size={16} /> {t.newRequest}
      </a>

      <header className="page-head">
        <div>
          <div className="meta-row">
            <span className="chip">{serviceTitle(lang, request.service)}</span>
            <span className={`status ${status.cls}`}>
              <span className="dot" /> {t.status[request.status]}
            </span>
          </div>
          <h1>{request.businessName}</h1>
        </div>
        <CopyLink t={t} />
      </header>
      <ShareNote t={t} />

      <div className="layout-2">
        <div>
          <NowCard request={request} hasQuestion={Boolean(question)} t={t} />
          {question && <QuestionCard key={question.id} q={question} t={t} />}

          <section className="card" aria-live="polite">
            <h3 className="card-title">
              <Icon name="zap" size={18} /> {t.liveActivity}
            </h3>
            <ol className="timeline">
              {request.progress.map((p, i) => {
                const active = running && i === request.progress.length - 1;
                return (
                  <li key={i}>
                    <span className={`t-dot${active ? " active" : ""}`}>
                      {active ? <Icon name="spinner" size={14} className="spin" /> : <Icon name="check" size={14} strokeWidth={3} />}
                    </span>
                    <div>
                      <strong>
                        {p.step}
                        {active && <span className="now-tag">{queued ? t.waitingQueue : ago(p.at, now, t)}</span>}
                      </strong>
                      {p.detail && <div className="detail">{p.detail}</div>}
                    </div>
                    <span className="when">{time(p.at, t.dateLocale)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
          {error && (
            <p className="muted" style={{ marginTop: 12, fontSize: "0.875rem" }}>
              {error || t.connRetry}
            </p>
          )}
        </div>

        <aside>
          <section className="card">
            <h3 className="card-title">
              <Icon name="sparkles" size={18} /> {t.teamTitle}
            </h3>
            <ul className="team">
              {TEAM.map(([icon], i) => {
                const [name, job] = t.team[i]!;
                return (
                <li key={icon}>
                  <span className="team-icon">
                    <Icon name={icon} size={16} />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <span>{job}</span>
                  </div>
                </li>
                );
              })}
            </ul>
            <p className="muted" style={{ margin: "16px 0 0", fontSize: "0.8125rem" }}>
              {t.runningOn}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NowCard({ request, hasQuestion, t }: { request: RequestDoc; hasQuestion: boolean; t: AppStrings }) {
  const latest = request.progress[request.progress.length - 1];
  const c = t.now;
  const view: Record<Exclude<RequestStatus, "completed">, { cls: string; icon: IconName; label: string; title: string; body: React.ReactNode }> = {
    submitted: {
      cls: "queued",
      icon: "clock",
      label: c.queuedLabel,
      title: c.queuedTitle,
      body: c.queuedBody,
    },
    processing: {
      cls: "",
      icon: "spinner",
      label: c.workingLabel,
      title: latest?.step ?? c.workingTitle,
      body: c.workingBody,
    },
    waiting_for_user: {
      cls: hasQuestion ? "waiting" : "",
      icon: hasQuestion ? "question" : "check",
      label: hasQuestion ? c.askLabel : c.answeredLabel,
      title: hasQuestion ? c.askTitle : c.answeredTitle,
      body: hasQuestion ? c.askBody : c.answeredBody,
    },
    failed: {
      cls: "failed",
      icon: "alert",
      label: c.failedLabel,
      title: c.failedTitle,
      body: (
        <>
          {request.error ?? c.unknownError}. <a href="/">{c.startNew}</a>
        </>
      ),
    },
  };
  if (request.status === "completed") return null;
  const v = view[request.status];
  return (
    <section className={`now ${v.cls}`} role="status">
      <span className="now-icon">
        <Icon name={v.icon} size={22} className={v.icon === "spinner" ? "spin" : undefined} />
      </span>
      <div>
        <div className="mini-label">{v.label}</div>
        <strong>{v.title}</strong>
        <p>{v.body}</p>
      </div>
    </section>
  );
}

function ShareNote({ t }: { t: AppStrings }) {
  return (
    <p className="share-note no-print">
      <Icon name="info" size={13} /> {t.shareNote}
    </p>
  );
}

function CopyLink({ t }: { t: AppStrings }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm no-print"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked; nothing to do */
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? t.linkCopied : t.copyLink}
    </button>
  );
}

function QuestionCard({ q, t }: { q: QuestionDoc; t: AppStrings }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!choice) return;
    setErr(null);
    setSending(true);
    try {
      const res = await fetch(`/api/questions/${q.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: choice, otherText: choice === "__other__" ? other : undefined }),
      });
      const json = await res.json();
      if (!res.ok) setErr(json.error ?? t.sendErr);
      else setSent(true);
    } catch {
      setErr(t.sendRetry);
    } finally {
      setSending(false);
    }
  }

  const options = [...q.options.map((o) => [o, o]), ...(q.allowOther ? [["__other__", t.qOther]] : [])];

  return (
    <section className="card question" aria-live="polite">
      <div className="kicker">
        <Icon name="question" size={16} /> {t.qKicker}
      </div>
      <h2>{q.question}</h2>
      {q.context && <p className="context">{q.context}</p>}
      {sent ? (
        <div className="notice" style={{ margin: "16px 0 0" }}>
          <Icon name="check" />
          <p>
            <strong>{t.qThanks}</strong>
            {t.qThanksBody}
          </p>
        </div>
      ) : (
        <>
          <div className="options" role="radiogroup" aria-label={q.question}>
            {options.map(([value, label]) => (
              <label key={value} className="option" data-on={choice === value}>
                <input type="radio" name={`q-${q.id}`} className="sr-only" checked={choice === value} onChange={() => setChoice(value!)} />
                <span className="radio" />
                {label}
              </label>
            ))}
          </div>
          {choice === "__other__" && (
            <textarea
              rows={2}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder={t.qOtherPh}
              aria-label={t.qYourAnswer}
              style={{ marginBottom: 12 }}
            />
          )}
          {err && (
            <p className="field-error" role="alert" style={{ marginBottom: 12 }}>
              <Icon name="alert" size={14} /> {err}
            </p>
          )}
          <div className="row">
            <button className="btn btn-primary" type="button" disabled={!choice || sending || (choice === "__other__" && !other.trim())} onClick={send}>
              {sending ? <Icon name="spinner" className="spin" /> : <Icon name="send" size={16} />} {t.qSend}
            </button>
            {q.defaultOption && <span className="default-note">{t.qDefault(q.defaultOption)}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/** "Micro (turnover RM252k …)" → ["Micro", "turnover RM252k …"]. Agents often pack detail into brackets. */
function splitParen(s: string): [string, string | undefined] {
  const m = s.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  return m ? [m[1]!, m[2]!] : [s, undefined];
}

/** "Short verdict — longer explanation" → ["Short verdict", "Longer explanation"]. */
function splitDash(s: string): [string, string | undefined] {
  const m = s.match(/^(.{20,}?)\s+[—–]\s+(.+)$/);
  if (!m) return [s, undefined];
  return [m[1]!, m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1)];
}

// Money (RM28.00/kg, RM40k, S$2,339/year) and percentages.
const NUM = /((?:RM|S\$)\s?\d(?:[\d,]*\d)?(?:\.\d+)?(?:k\b|m\b)?(?:\/(?:kg|month|mo|year|yr|day|week)\b)?|\d+(?:\.\d+)?%)/gi;

/** Bolds the money and percentages in agent-written text so they can be scanned. */
function Nums({ text }: { text: string }) {
  return (
    <>
      {text.split(NUM).map((part, i) =>
        i % 2 ? (
          <b className="n-hl" key={i}>
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Shows "a → b → c" as a step list, anything else as text. */
function Detail({ text }: { text: string }) {
  const steps = text.split(/\s+→\s+/);
  if (steps.length < 3) return <Nums text={text} />;
  return (
    <ol className="chain">
      {steps.map((s, i) => (
        <li key={i}>
          <Nums text={s} />
        </li>
      ))}
    </ol>
  );
}

const agentIcon = (name: string): IconName => TEAM.find(([, n]) => name.toLowerCase().startsWith(n.toLowerCase()))?.[0] ?? "sparkles";

function Brief({ request, result, messages, t, lang }: { request: RequestDoc; result: Result; messages: ChatMessageDoc[]; t: AppStrings; lang: "en" | "ms" }) {
  const rm = money(request.market);
  const order = { urgent: 0, important: 1, opportunity: 2 } as const;
  const decisions = [...result.decisions].sort((a, b) => order[a.priority] - order[b.priority]);
  const totals = impactTotals(decisions);
  const passed = result.verification.filter((v) => v.passed).length;
  const [headline, subhead] = splitDash(result.headline);
  const facts: [string, string][] = [];
  if (result.period) facts.push([t.period, result.period]);
  if (result.smeCategory) facts.push([t.smeCategory, result.smeCategory]);

  return (
    <article className="container container-narrow page">
      <div className="brief-top">
        <a href="/" className="back-link no-print">
          <Icon name="arrowLeft" size={16} /> {t.newRequest}
        </a>
        <div className="row no-print">
          <CopyLink t={t} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Icon name="printer" size={16} /> {t.print}
          </button>
          {result.reportUrl && (
            <a className="btn btn-primary btn-sm" href={result.reportUrl} target="_blank" rel="noreferrer">
              <Icon name="download" size={16} /> {t.fullReport}
            </a>
          )}
        </div>
      </div>
      <ShareNote t={t} />

      <header className="card brief-hero">
        <div className="meta-row">
          <span className="status done">
            <Icon name="clipboard" size={14} /> {t.cfoBrief}
          </span>
          <span className="chip">{request.businessName}</span>
        </div>
        <h1>{headline}</h1>
        {subhead && (
          <p className="brief-sub">
            <Nums text={subhead} />
          </p>
        )}

        {facts.length > 0 && (
          <dl className="facts">
            {facts.map(([label, value]) => {
              const [main, detail] = splitParen(value);
              return (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <strong>{main}</strong>
                    {detail && <span>{detail}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {totals.monthly + totals.one_off + totals.financing > 0 && (
          <div className="impact-banner">
            <div className="mini-label">{t.impactTitle}</div>
            <div className="impact-items">
              {totals.monthly > 0 && (
                <div>
                  <span className="big">{rm(totals.monthly)}</span>
                  <span className="what">{t.impactWhat.monthly}</span>
                </div>
              )}
              {totals.one_off > 0 && (
                <div>
                  <span className="big">{rm(totals.one_off)}</span>
                  <span className="what">{t.impactWhat.one_off}</span>
                </div>
              )}
              {totals.financing > 0 && (
                <div>
                  <span className="big">{rm(totals.financing)}</span>
                  <span className="what">{t.impactWhat.financing}</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="glance">
          <div className="mini-label">{t.atGlance}</div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {decisions.map((d, i) => (
              <li key={i}>
                <a href={`#decision-${i + 1}`}>
                  <span className="decision-n">{i + 1}</span>
                  <span>{d.title}</span>
                  <span className={`tag ${d.priority}`}>{t.priority[d.priority]}</span>
                  {d.impactRm ? (
                    <span className={`amt ${impactKind(d)}${d.impactRm < 0 ? " neg" : ""}`}>{impactText(d, rm, t)}</span>
                  ) : (
                    <Icon name="chevronDown" size={16} className="go" />
                  )}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </header>

      {result.keyNumbers.length > 0 && (
        <div className="stats">
          {result.keyNumbers.map((k) => {
            const [value, extra] = splitParen(k.value);
            return (
              <div className="stat" key={k.label}>
                <div className="l">{k.label}</div>
                <div className="v">{value}</div>
                {extra && <div className="vx">{extra}</div>}
                {k.note && <div className="n">{k.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <div className="kicker">{t.nextKicker}</div>
        <h2>{t.decisionsTitle(decisions.length)}</h2>
      </div>

      <section className="decisions">
        {decisions.map((d, i) => (
          <div className={`card decision ${d.priority}`} key={i} id={`decision-${i + 1}`}>
            <div className="decision-top">
              <span className="decision-n">{i + 1}</span>
              <span className={`tag ${d.priority}`}>{t.priority[d.priority]}</span>
              {d.impactRm ? (
                <span className={`decision-impact ${impactKind(d)}${d.impactRm < 0 ? " neg" : ""}`}>
                  <span className="l">{t.impactKindLabel[impactKind(d)]}</span>
                  <span className="v">{impactText(d, rm, t)}</span>
                </span>
              ) : null}
            </div>
            <h3>{d.title}</h3>

            <div className={`decision-body${d.evidence.length ? "" : " single"}`}>
              <div className="decision-main">
                <div className="todo">
                  <Icon name="arrowRight" />
                  <div>
                    <div className="mini-label">{t.whatToDo}</div>
                    <p>
                      <Nums text={d.action} />
                    </p>
                  </div>
                </div>
                <div className="why">
                  <div className="mini-label">{t.why}</div>
                  <p>
                    <Nums text={d.reason} />
                  </p>
                </div>
                {d.cta && (
                  <div className="first-step">
                    <Icon name="check" size={16} strokeWidth={2.5} />
                    <div>
                      <div className="mini-label">{t.firstStep}</div>
                      <p>
                        <Nums text={d.cta} />
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {d.evidence.length > 0 && (
                <aside className="evidence">
                  <div className="evidence-label">{t.evidence}</div>
                  <ul>
                    {d.evidence.map((e, j) => (
                      <li key={j}>
                        <Icon name={e.url ? "external" : "file"} size={14} />
                        <div>
                          <div className="ev-title">
                            {e.url ? (
                              <a href={e.url} target="_blank" rel="noreferrer">
                                {e.label}
                              </a>
                            ) : (
                              e.label
                            )}
                          </div>
                          {e.detail && (
                            <div className="d">
                              <Detail text={e.detail} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          </div>
        ))}
      </section>

      {result.applicationPacks?.length > 0 && <ApplicationPacks packs={result.applicationPacks} rm={rm} t={t} />}

      <AskCfo requestId={request.id} initial={messages} t={t} />

      {(result.verification.length > 0 || result.assumptions.length > 0) && (
        <div className="grid-2">
          {result.verification.length > 0 && (
            <section className="card">
              <h3 className="card-title">
                <Icon name="shield" size={18} /> {t.checked}
                <span className="score">{t.passed(passed, result.verification.length)}</span>
              </h3>
              <ul className="checks">
                {result.verification.map((v, i) => (
                  <li key={i}>
                    <span className={`check-i${v.passed ? "" : " fail"}`} aria-label={v.passed ? t.passedAria : t.failedAria}>
                      <Icon name={v.passed ? "check" : "x"} size={12} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="c-title">{v.check}</div>
                      {v.detail && (
                        <div className="d">
                          <Nums text={v.detail} />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.assumptions.length > 0 && (
            <section className="card">
              <h3 className="card-title">
                <Icon name="info" size={18} /> {t.assumptions}
              </h3>
              <ul className="assumptions">
                {result.assumptions.map((a, i) => (
                  <li key={i}>
                    <Nums text={a} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {result.agentsUsed.length > 0 && (
        <section className="card prepared-card">
          <h3 className="card-title">
            <Icon name="sparkles" size={18} /> {t.preparedBy}
          </h3>
          <ul className="team team-grid">
            {result.agentsUsed.map((a) => {
              const [name, job] = splitParen(a);
              return (
                <li key={a}>
                  <span className="team-icon">
                    <Icon name={agentIcon(name)} size={16} />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    {job && <span>{job}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}

const CHECK_ICON: Record<ApplicationPack["checklist"][number]["status"], IconName> = { ready: "check", partial: "clock", missing: "x" };

/** Prints one pack on its own: hides everything else for the duration of the print dialog. */
function printPack(programId: string) {
  const html = document.documentElement;
  const card = document.getElementById(`pack-${programId}`);
  html.dataset.printPack = "";
  card?.setAttribute("data-printing", "");
  const done = () => {
    delete html.dataset.printPack;
    card?.removeAttribute("data-printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

function ApplicationPacks({ packs, rm, t }: { packs: ApplicationPack[]; rm: (n: number) => string; t: AppStrings }) {
  return (
    <div className="packs-wrap">
      <div className="section-head">
        <div className="kicker">{t.packKicker}</div>
        <h2>{t.packTitle}</h2>
        <p className="muted">{t.packSub}</p>
      </div>
      <section className="packs">
        {packs.map((p) => {
          const ready = p.checklist.filter((c) => c.status === "ready").length;
          const facts: [string, string][] = [];
          if (p.purpose) facts.push([t.purpose, p.purpose]);
          if (p.monthlyRepaymentRm) facts.push([t.repayment, t.repaymentVal(rm(p.monthlyRepaymentRm))]);
          if (p.affordability) facts.push([t.affordability, p.affordability]);
          return (
            <div className="card pack" key={p.programId} id={`pack-${p.programId}`}>
              <div className="pack-top">
                <div>
                  <div className="meta-row">
                    <span className={`tag ${p.verdict}`}>{t.verdict[p.verdict]}</span>
                    {p.unverified && <span className="tag unverified">{t.unverified}</span>}
                  </div>
                  <h3>{p.programName}</h3>
                  {p.agency && <div className="muted pack-agency">{p.agency}</div>}
                </div>
                {p.amountRm ? (
                  <div className="decision-impact">
                    <span className="l">{t.applyFor}</span>
                    <span className="v">{rm(p.amountRm)}</span>
                  </div>
                ) : null}
              </div>
              {p.verdictNote && (
                <p className="pack-note">
                  <Nums text={p.verdictNote} />
                </p>
              )}

              <div className="pack-body">
                <div>
                  <div className="mini-label">{t.docsReady(ready, p.checklist.length)}</div>
                  <div className="progress" style={{ margin: "6px 0 14px" }}>
                    <span style={{ width: `${p.checklist.length ? (ready / p.checklist.length) * 100 : 0}%` }} />
                  </div>
                  <ul className="checks">
                    {p.checklist.map((c, i) => (
                      <li key={i}>
                        <span className={`check-i ${c.status}`} aria-label={t.checkStatus[c.status]}>
                          <Icon name={CHECK_ICON[c.status]} size={12} strokeWidth={3} />
                        </span>
                        <div>
                          <div className="c-title">{c.item}</div>
                          {c.detail && (
                            <div className="d">
                              <Nums text={c.detail} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {(facts.length > 0 || p.prefilled.length > 0) && (
                  <aside className="evidence">
                    {facts.length > 0 && (
                      <dl className="pack-facts">
                        {facts.map(([l, v]) => (
                          <div key={l}>
                            <dt>{l}</dt>
                            <dd>
                              <Nums text={v} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {p.prefilled.length > 0 && (
                      <>
                        <div className="evidence-label">{t.formAnswers}</div>
                        <dl className="pack-facts">
                          {p.prefilled.map((f) => (
                            <div key={f.label}>
                              <dt>{f.label}</dt>
                              <dd>{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}
                  </aside>
                )}
              </div>

              {p.nextSteps.length > 0 && (
                <div className="pack-steps">
                  <div className="mini-label">{t.nextSteps}</div>
                  <ol>
                    {p.nextSteps.map((s, i) => (
                      <li key={i}>
                        <Nums text={s} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="pack-foot">
                {p.howToApply && <span className="muted">{p.howToApply}</span>}
                <div className="row no-print">
                  {p.sourceUrl && (
                    <a className="btn btn-secondary btn-sm" href={p.sourceUrl} target="_blank" rel="noreferrer">
                      <Icon name="external" size={16} /> {t.officialPage}
                    </a>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => printPack(p.programId)}>
                    <Icon name="printer" size={16} /> {t.printPack}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}


/** "Ask your CFO": follow-up questions answered by the on-duty WorkBuddy agent from the owner's own data. */
function AskCfo({ requestId, initial, t }: { requestId: string; initial: ChatMessageDoc[]; t: AppStrings }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const waiting = messages.some((m) => m.status !== "answered");

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/requests/${requestId}/messages`, { cache: "no-store" });
        if (res.ok) setMessages((await res.json()).messages);
      } catch {
        /* try again on the next tick */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [waiting, requestId]);

  async function ask(q: string) {
    const question = q.trim();
    if (question.length < 3 || sending) return;
    setErr(null);
    setSending(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.sendErr);
      setMessages((m) => [...m, { id: json.id, requestId, businessId: "", question, status: "open", createdAt: new Date().toISOString() }]);
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.sendRetry);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card ask no-print" aria-labelledby="ask-title">
      <h3 className="card-title" id="ask-title">
        <Icon name="question" size={18} /> {t.askTitle}
      </h3>
      <p className="muted ask-sub">{t.askSub}</p>

      {messages.length > 0 ? (
        <ol className="thread" aria-live="polite">
          {messages.map((m) => (
            <li key={m.id}>
              <div className="q">{m.question}</div>
              {m.status === "answered" ? (
                <div className="a">
                  <p>
                    <Nums text={m.answer ?? ""} />
                  </p>
                  {m.evidence && m.evidence.length > 0 && (
                    <ul className="a-ev">
                      {m.evidence.map((e, i) => (
                        <li key={i}>
                          <Icon name={e.url ? "external" : "file"} size={13} />
                          <span>
                            {e.url ? (
                              <a href={e.url} target="_blank" rel="noreferrer">
                                {e.label}
                              </a>
                            ) : (
                              e.label
                            )}
                            {e.detail && <span className="muted"> · {e.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="a pending">
                  <Icon name="spinner" size={14} className="spin" />
                  {Date.now() - Date.parse(m.createdAt) > 45_000 ? t.askSlow : t.askChecking}
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="chips ask-suggest">
          {t.askSuggested.map((s) => (
            <button type="button" key={s} className="chip-toggle" disabled={sending} onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          {t.askLabel}
        </label>
        <input
          id="ask-input"
          type="text"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.askPh}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || text.trim().length < 3}>
          {sending ? <Icon name="spinner" className="spin" /> : <Icon name="send" size={16} />} {t.askButton}
        </button>
      </form>
      {err && (
        <p className="field-error" role="alert" style={{ marginTop: 10 }}>
          <Icon name="alert" size={14} /> {err}
        </p>
      )}
    </section>
  );
}
