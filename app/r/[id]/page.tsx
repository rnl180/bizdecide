"use client";

import { use, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { PRIORITY_ICON, STATUS, StatusIcon, VERDICT_ICON } from "@/components/RequestMeta";
import { useLang } from "@/lib/i18n";
import { APP, type AppStrings } from "@/lib/i18n-app";
import { impactKind, impactTotals } from "@/lib/impact";
import { DecisionAction, FoundHeadline, useActions } from "@/components/DecisionAction";
import { marketPack, money } from "@/lib/markets";
import type { Channel, Statements } from "@/lib/statements";
import { saveRequest, toSaved } from "@/lib/myRequests";
import {
  type ApplicationPack,
  type ChatMessageDoc,
  type Decision,
  type QuestionDoc,
  type RequestDoc,
  type RequestStatus,
  type Result,
} from "@/lib/types";

type Payload = { request: RequestDoc; question: QuestionDoc | null; result: Result | null; messages?: ChatMessageDoc[]; statements?: Statements | null };

/** "+RM82/mo", "+RM954 one-off", "RM40,000 funding", in the page language. */
function impactText(d: Decision, rm: (n: number) => string, t: AppStrings) {
  if (!d.impactRm) return "";
  const kind = impactKind(d);
  if (kind === "financing") return `${rm(d.impactRm)} ${t.funding}`;
  const sign = d.impactRm > 0 ? "+" : "−";
  return kind === "one_off" ? `${sign}${rm(d.impactRm)} ${t.oneOff}` : `${sign}${rm(d.impactRm)}${t.perMonth}`;
}

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = useLang(data?.request.language);
  const t = APP[lang];

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
            <SlowHint text={t.slowLoad} />
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
  if (request.status === "completed" && result)
    return <Brief request={request} result={result} messages={data.messages ?? []} statements={data.statements ?? null} t={t} lang={lang} />;

  const status = STATUS[request.status];
  const queued = request.status === "submitted";
  const running = request.status === "submitted" || request.status === "processing";

  return (
    <div className="container container-narrow page">
      <a href="/requests" className="back-link">
        <Icon name="arrowLeft" size={16} /> {t.myRequests}
      </a>

      <header className="page-head">
        <div>
          <div className="meta-row">
            <span className={`status ${status.cls}`}>
              <StatusIcon status={request.status} /> {t.status[request.status]}
            </span>
          </div>
          <h1>{request.businessName}</h1>
        </div>
        <CopyLink t={t} />
      </header>

      <NowCard request={request} hasQuestion={Boolean(question)} t={t} />
      {question && <QuestionCard key={question.id} q={question} t={t} />}

      <section className="card" aria-live="polite">
        <h3 className="card-title">
          <Icon name="zap" size={18} /> {t.liveActivity}
        </h3>
        <ol className="timeline">
          {request.progress.map((p, i) => {
            const active = running && i === request.progress.length - 1;
            const step = (
              <strong>
                {p.step}
                {active && queued && <span className="now-tag">{t.waitingQueue}</span>}
              </strong>
            );
            return (
              <li key={i}>
                <span className={`t-dot${active ? " active" : ""}`}>
                  {active ? <Icon name="spinner" size={14} className="spin" /> : <Icon name="check" size={14} strokeWidth={3} />}
                </span>
                {/* A step's detail is folded behind the expand icon. */}
                {p.detail ? (
                  <details className="t-fold">
                    <summary>
                      {step}
                      <FoldIcon label={t.expand} />
                    </summary>
                    <div className="detail">{p.detail}</div>
                  </details>
                ) : (
                  step
                )}
              </li>
            );
          })}
        </ol>
      </section>
      {error !== null && (
        <p className="notice warn reconnect" role="status">
          <Icon name="wifiOff" size={16} />
          <span>{t.reconnecting}</span>
        </p>
      )}
    </div>
  );
}

function NowCard({ request, hasQuestion, t }: { request: RequestDoc; hasQuestion: boolean; t: AppStrings }) {
  const latest = request.progress[request.progress.length - 1];
  const c = t.now;
  const view: Record<Exclude<RequestStatus, "completed">, { cls: string; icon: IconName; title: string; body?: React.ReactNode }> = {
    submitted: { cls: "queued", icon: "clock", title: c.queuedTitle },
    processing: { cls: "", icon: "spinner", title: latest?.step ?? c.workingTitle },
    waiting_for_user: hasQuestion
      ? { cls: "waiting", icon: "question", title: c.askTitle, body: c.askBody }
      : { cls: "", icon: "check", title: c.answeredTitle },
    failed: {
      cls: "failed",
      icon: "xCircle",
      title: c.failedTitle,
      body: (
        <>
          <strong className="now-safe">{c.failedSafe}</strong> {request.error ?? c.unknownError}. <a href="/">{c.startNew}</a>
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
        <strong>{v.title}</strong>
        {v.body && <p>{v.body}</p>}
      </div>
      {request.status !== "failed" && <Elapsed since={request.createdAt} label={t.elapsed} />}
    </section>
  );
}

/** A ticking "Elapsed 02:14" so the owner can see the agents are still going. */
function Elapsed({ since, label }: { since: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const start = Date.parse(since);
  if (now === null || !Number.isFinite(start)) return null;
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="now-clock">
      <span className="now-clock-l">{label}</span>
      <span className="now-clock-v" aria-hidden="true">
        {h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`}
      </span>
    </span>
  );
}

function CopyLink({ t }: { t: AppStrings }) {
  const [copied, setCopied] = useState(false);
  // Phones get the system share sheet (WhatsApp, email…); everything else copies the link.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches);
  }, []);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm no-print"
      title={t.shareNote}
      onClick={async () => {
        if (canShare) {
          try {
            await navigator.share({ title: document.title, url: window.location.href });
            return;
          } catch {
            /* cancelled or blocked: fall back to copying */
          }
        }
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked; nothing to do */
        }
      }}
    >
      <Icon name={copied ? "check" : canShare ? "share" : "copy"} size={16} /> {copied ? t.linkCopied : canShare ? t.share : t.copyLink}
    </button>
  );
}

function QuestionCard({ q, t }: { q: QuestionDoc; t: AppStrings }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(answer = choice) {
    if (!answer) return;
    setChoice(answer);
    setErr(null);
    setSending(true);
    try {
      const res = await fetch(`/api/questions/${q.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, otherText: answer === "__other__" ? other : undefined }),
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
                <span className="option-text">
                  {label}
                  {value === q.defaultOption && <span className="option-tag">{t.qAssumed}</span>}
                </span>
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
            <button className="btn btn-primary" type="button" disabled={!choice || sending || (choice === "__other__" && !other.trim())} onClick={() => send()}>
              {sending ? <Icon name="spinner" className="spin" /> : <Icon name="send" size={16} />} {t.qSend}
            </button>
            {q.defaultOption && (
              <button className="btn btn-secondary" type="button" disabled={sending} onClick={() => send(q.defaultOption)}>
                <Icon name="checkCircle" size={16} /> {t.qUseAssumed}
              </button>
            )}
          </div>
          {q.defaultOption && <p className="default-note">{t.qDefault(q.defaultOption)}</p>}
        </>
      )}
    </section>
  );
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

/** The expand icon on a folded section; it turns when the section opens. */
function FoldIcon({ label }: { label: string }) {
  return (
    <span className="fold-icon" aria-hidden="true" title={label}>
      <Icon name="chevronDown" size={18} />
    </span>
  );
}

/** Opens a folded section when a link jumps to it. */
const openFold = (id: string) => () => {
  const el = document.getElementById(id);
  if (el instanceof HTMLDetailsElement) el.open = true;
};

function Brief({
  request,
  result,
  messages,
  statements,
  t,
  lang,
}: {
  request: RequestDoc;
  result: Result;
  messages: ChatMessageDoc[];
  statements: Statements | null;
  t: AppStrings;
  lang: "en" | "ms";
}) {
  const rm = money(request.market);
  const order = { urgent: 0, important: 1, opportunity: 2 } as const;
  const decisions = [...result.decisions].sort((a, b) => order[a.priority] - order[b.priority]);
  const totals = impactTotals(decisions);
  const { byIndex, approve } = useActions(request.id);
  const passed = result.verification.filter((v) => v.passed).length;
  const [headline] = splitDash(result.headline);
  // "Approve all": every decision not yet approved (or that failed), most urgent first, one after another.
  const toApprove = decisions.map((d) => result.decisions.indexOf(d)).filter((i) => !byIndex[i] || byIndex[i]!.status === "failed");
  const [approvingAll, setApprovingAll] = useState(false);
  const [allErr, setAllErr] = useState<string | null>(null);
  async function approveAll() {
    if (approvingAll) return;
    setApprovingAll(true);
    setAllErr(null);
    try {
      for (const i of toApprove) await approve(i, lang);
    } catch (e) {
      setAllErr(e instanceof Error ? e.message : t.sendRetry);
    } finally {
      setApprovingAll(false);
    }
  }
  // Everything beyond the headline, the amounts and the actions starts folded; printing opens it all.
  useEffect(() => {
    const openAll = () => document.querySelectorAll("details").forEach((el) => (el.open = true));
    window.addEventListener("beforeprint", openAll);
    return () => window.removeEventListener("beforeprint", openAll);
  }, []);

  return (
    <article className="container container-narrow page">
      <div className="brief-top">
        <a href="/requests" className="back-link no-print">
          <Icon name="arrowLeft" size={16} /> {t.myRequests}
        </a>
        <CopyLink t={t} />
      </div>

      <header className="card brief-hero double-rule" id="summary">
        {/* Decision ready: the brand mark settles in once. */}
        <span className="chop-seal" aria-hidden="true">
          <img src="/brand/mark.svg" alt="" width={64} height={64} />
        </span>
        <div className="meta-row">
          <span className="chip">{request.businessName}</span>
          {result.verification.length > 0 && (
            <a
              className={`status ${passed === result.verification.length ? "done" : "waiting"} checks-chip`}
              href="#checks"
              onClick={openFold("checks")}
            >
              <Icon name="shield" size={14} /> {t.checksChip(passed, result.verification.length)}
            </a>
          )}
        </div>
        <h1>{headline}</h1>
        <FoundHeadline totals={totals} rm={rm} lang={lang} businessName={request.businessName} />
      </header>
      {statements && <Figures s={statements} market={request.market} t={t} />}

      <div className="brief-h2-row">
        <h2 className="brief-h2">{t.decisionsTitle(decisions.length)}</h2>
        {toApprove.length > 1 && (
          <button type="button" className="btn btn-primary no-print" onClick={approveAll} aria-disabled={approvingAll || undefined}>
            {approvingAll ? <Icon name="spinner" size={18} className="spin" /> : <Icon name="checkCircle" size={18} />}
            {t.approveAll(toApprove.length)}
          </button>
        )}
      </div>
      {allErr && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={14} /> {allErr}
        </p>
      )}
      <section className="decisions">
        {decisions.map((d, i) => {
          const index = result.decisions.indexOf(d);
          return (
            <div className={`card decision ${d.priority}`} key={index} id={`decision-${i + 1}`}>
              <div className="decision-top">
                <span className="decision-n">{i + 1}</span>
                <span className={`tag ${d.priority}`}>
                  <Icon name={PRIORITY_ICON[d.priority]} size={13} /> {t.priority[d.priority]}
                </span>
                {d.impactRm ? (
                  <span className={`decision-impact ${impactKind(d)}${d.impactRm < 0 ? " neg" : ""}`}>
                    <span className="v">{impactText(d, rm, t)}</span>
                  </span>
                ) : null}
              </div>
              <h3>{d.title}</h3>
              <p className="decision-do">
                <Nums text={d.action} />
              </p>
              <details className="evidence">
                <summary className="evidence-label">
                  {t.whyProof}
                  {d.evidence.length > 0 && <span className="evidence-n">{d.evidence.length}</span>}
                  <FoldIcon label={t.expand} />
                </summary>
                <p className="decision-why">
                  <Nums text={d.reason} />
                </p>
                {d.evidence.length > 0 && (
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
                )}
              </details>
              <DecisionAction
                requestId={request.id}
                index={index}
                decision={d}
                action={byIndex[index]}
                onApprove={(l) => approve(index, l)}
                lang={lang}
              />
            </div>
          );
        })}
      </section>

      {statements && <StatementsFold s={statements} market={request.market} t={t} />}

      {result.applicationPacks?.length > 0 && (
        <details className="brief-more" id="funding">
          <summary>
            <Icon name="landmark" size={18} /> {t.packKicker}
            <span className="brief-more-n">{result.applicationPacks.length}</span>
            <FoldIcon label={t.expand} />
          </summary>
          <ApplicationPacks packs={result.applicationPacks} rm={rm} t={t} />
        </details>
      )}

      <AskCfo requestId={request.id} initial={messages} t={t} />

      {(result.verification.length > 0 || result.assumptions.length > 0) && (
        <details className="brief-more" id="checks">
          <summary>
            <Icon name="shield" size={18} /> {t.checked}
            {result.verification.length > 0 && <span className="score">{t.passed(passed, result.verification.length)}</span>}
            <FoldIcon label={t.expand} />
          </summary>
          <div className="brief-more-body">
            {result.verification.length > 0 && (
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
            )}
            {result.assumptions.length > 0 && (
              <>
                <div className="mini-label brief-more-label">{t.assumptions}</div>
                <ul className="assumptions">
                  {result.assumptions.map((a, i) => (
                    <li key={i}>
                      <Nums text={a} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}
    </article>
  );
}

/** "252,571.08": accounting style, the currency goes in the caption. Money out is shown in brackets. */
const n2 = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthYear = (iso: string, locale: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" });
const dayMonthYear = (iso: string, locale: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
const span = (from: string, to: string, locale: string) => {
  const [a, b] = [monthYear(from, locale), monthYear(to, locale)];
  return a === b ? a : `${a} – ${b}`;
};

/** Three small cards under the headline: sales (money in), purchases (money out) and the bank balance, each in its own colour. */
function Figures({ s, market, t }: { s: Statements; market?: string; t: AppStrings }) {
  const cur = marketPack(market)?.currencySymbol ?? "RM";
  const cards: ["sales" | "purchases" | "bank", IconName, string, number, string][] = [];
  if (s.sales) cards.push(["sales", "chart", t.figSales, s.sales.total, span(s.sales.from, s.sales.to, t.dateLocale)]);
  if (s.purchases) cards.push(["purchases", "receipt", t.figPurchases, s.purchases.total, span(s.purchases.from, s.purchases.to, t.dateLocale)]);
  if (s.bank) cards.push(["bank", "landmark", t.figBank, s.bank.closing, dayMonthYear(s.bank.to, t.dateLocale)]);
  return (
    <ul className="figs">
      {cards.map(([key, icon, label, value, when]) => (
        <li key={key} className={`fig fig-${key}`}>
          <span className="fig-l">
            <span className="fig-ico" aria-hidden="true">
              <Icon name={icon} size={15} />
            </span>
            {label}
          </span>
          <span className="fig-v">{n2(value)}</span>
          <span className="fig-n">
            {cur} · {when}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sales by channel and the bank check, folded at the foot of the brief. */
function StatementsFold({ s, market, t }: { s: Statements; market?: string; t: AppStrings }) {
  const cur = marketPack(market)?.currencySymbol ?? "RM";
  const channels = s.sales?.channels ?? [];
  if (!channels.length && !s.bank) return null;
  const salesTotal = s.sales?.total ?? 0;
  const pct = (n: number) => (salesTotal > 0 ? Math.round((n / salesTotal) * 100) : 0);
  return (
    <details className="brief-more" id="statements">
      <summary>
        <Icon name="chart" size={18} /> {t.stmtTitle}
        <FoldIcon label={t.expand} />
      </summary>
      <div className="brief-more-body stmts">
        {s.sales && channels.length > 0 && (
          <section className="stmt">
            <h4>{t.salesByChannel}</h4>
            <span className="stmt-n">
              {cur} · {span(s.sales.from, s.sales.to, t.dateLocale)}
            </span>
            {/* The channel mix as one thin bar; the rows below are its legend and its table. */}
            <div className="mix" role="img" aria-label={channels.map((c) => `${t.channel[c.key]} ${pct(c.amount)}%`).join(", ")}>
              {channels.map((c) => (
                <span
                  key={c.key}
                  className={`mix-seg ch-${c.key}`}
                  style={{ flexGrow: Math.max(c.amount, 0) }}
                  title={`${t.channel[c.key]}: ${n2(c.amount)} (${pct(c.amount)}%)`}
                />
              ))}
            </div>
            <dl>
              {channels.map((c) => (
                <div key={c.key}>
                  <dt>
                    <i className={`dot ch-${c.key}`} aria-hidden="true" />
                    {t.channel[c.key]} <span className="stmt-pct">{pct(c.amount)}%</span>
                  </dt>
                  <dd>{n2(c.amount)}</dd>
                </div>
              ))}
              <div className="stmt-total">
                <dt>{t.totalSales}</dt>
                <dd>{n2(s.sales.total)}</dd>
              </div>
            </dl>
          </section>
        )}
        {s.bank && (
          <section className="stmt">
            <h4>{t.bankCheck}</h4>
            <span className="stmt-n">
              {cur} · {span(s.bank.from, s.bank.to, t.dateLocale)}
            </span>
            <dl>
              <div>
                <dt>{t.opening}</dt>
                <dd>{n2(s.bank.opening)}</dd>
              </div>
              <div>
                <dt>{t.moneyIn}</dt>
                <dd>{n2(s.bank.moneyIn)}</dd>
              </div>
              <div>
                <dt>{t.moneyOut}</dt>
                <dd>({n2(s.bank.moneyOut)})</dd>
              </div>
              <div className="stmt-total">
                <dt>{t.closing}</dt>
                <dd>{n2(s.bank.closing)}</dd>
              </div>
            </dl>
            <p className={`stmt-check${s.bank.reconciles ? "" : " bad"}`}>
              <Icon name={s.bank.reconciles ? "checkCircle" : "alert"} size={15} /> {s.bank.reconciles ? t.reconciles : t.notReconciled}
            </p>
          </section>
        )}
      </div>
    </details>
  );
}

const CHECK_ICON: Record<ApplicationPack["checklist"][number]["status"], IconName> = { ready: "check", partial: "clock", missing: "x" };
/** Gaps first: what's missing is what the owner has to act on. */
const CHECK_ORDER: Record<ApplicationPack["checklist"][number]["status"], number> = { missing: 0, partial: 1, ready: 2 };

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
    <div className="brief-more-body">
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
                    <span className={`tag ${p.verdict}`}>
                      <Icon name={VERDICT_ICON[p.verdict]} size={13} /> {t.verdict[p.verdict]}
                    </span>
                    {p.unverified && (
                      <span className="tag unverified">
                        <Icon name="info" size={13} /> {t.unverified}
                      </span>
                    )}
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
                    {[...p.checklist].sort((a, b) => CHECK_ORDER[a.status] - CHECK_ORDER[b.status]).map((c, i) => (
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
    <details className="brief-more ask no-print" id="ask" open={messages.length > 0 || undefined}>
      <summary>
        <Icon name="question" size={18} /> {t.askTitle}
        <FoldIcon label={t.expand} />
      </summary>
      <div className="brief-more-body">

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
      </div>
    </details>
  );
}

/** Shown under the loading skeleton if the brief takes more than a few seconds. */
function SlowHint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return show ? (
    <p className="slow-hint" role="status">
      <Icon name="spinner" size={14} className="spin" /> {text}
    </p>
  ) : null;
}
