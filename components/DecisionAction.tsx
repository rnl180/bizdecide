"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { LANGS, type Lang } from "@/lib/i18n";
import { ACT, type ActStrings } from "@/lib/i18n-actions";
import { impactKind, type ImpactKind } from "@/lib/impact";
import type { ActionDoc, ActionDocument, ActionEmail, ActionStatus, Decision } from "@/lib/types";

/**
 * "Approve → it's done": the owner approves a decision on the brief, the CFO agent (Claude, or WorkBuddy on duty) carries it out
 * (refund request, supplier email, funding application), saves it as a Gmail draft when Gmail is connected, and
 * reports back. Drafts only: nothing here ever says or implies that something was sent.
 */

const POLL_MS = 2000;
const NETWORK_ERROR = "NetworkError";
const WRITE_LANGS: Lang[] = LANGS.map((l) => l.code); // "Write it in" shows only when there is a choice
const GMAIL_DRAFTS = "https://mail.google.com/mail/u/0/#drafts";

// ---------- data ----------

const RANK: Record<ActionStatus, number> = { queued: 0, working: 1, done: 2, failed: 2 };
const isLive = (a: ActionDoc) => a.status === "queued" || a.status === "working";

/** Server clock minus this browser's clock (ms), read from the Date header; ignored unless they disagree by more than 2 s. */
let skew = 0;
function noteServerClock(res: Response) {
  const server = Date.parse(res.headers.get("date") ?? "");
  if (Number.isNaN(server)) return;
  const diff = server - Date.now();
  skew = Math.abs(diff) > 2000 ? diff : 0;
}
const serverNow = () => Date.now() + skew;

/** Adds or updates actions by id. A late response can never move an action backwards (done → working). */
function merge(prev: ActionDoc[], fresh: ActionDoc[]): ActionDoc[] {
  const byId = new Map(prev.map((a) => [a.id, a]));
  let changed = false;
  for (const a of fresh) {
    if (!a || typeof a.id !== "string") continue;
    const old = byId.get(a.id);
    if (old && (RANK[old.status] > RANK[a.status] || JSON.stringify(old) === JSON.stringify(a))) continue;
    byId.set(a.id, a);
    changed = true;
  }
  return changed ? [...byId.values()] : prev;
}

/**
 * The actions for one request. Loads on mount and polls every 2 s while any action is queued or working.
 * `approve` resolves once the action is accepted (it's merged straight away) and rejects with the API's
 * error text otherwise; that text is also left in `error` until the next successful call.
 */
export function useActions(requestId: string): {
  byIndex: Record<number, ActionDoc>;
  approve: (decisionIndex: number, lang: Lang) => Promise<void>;
  error: string | null;
} {
  const [actions, setActions] = useState<ActionDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/requests/${encodeURIComponent(requestId)}/actions`;
  const live = actions.some(isLive);

  const fetchList = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error((typeof json?.error === "string" && json.error) || `HTTP ${res.status}`);
    noteServerClock(res);
    return Array.isArray(json?.actions) ? (json.actions as ActionDoc[]) : [];
  }, [url]);

  // First load (and again if the request changes). A failed load is retried a few times, so a blip at
  // page load doesn't hide results that already exist.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setActions((prev) => (prev.length ? [] : prev));
    const load = async (attempt: number) => {
      try {
        const list = await fetchList();
        if (stop) return;
        setActions((prev) => merge(prev, list));
        setError(null);
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : String(e));
        if (attempt < 3) timer = setTimeout(() => load(attempt + 1), 2000 * 2 ** attempt);
      }
    };
    load(0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [fetchList]);

  // Poll only while something is queued or working. One request at a time.
  useEffect(() => {
    if (!live) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const list = await fetchList();
        if (stop) return;
        setActions((prev) => merge(prev, list));
        setError(null);
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : String(e)); // keep polling: likely a blip
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [live, fetchList]);

  const approve = useCallback(
    async (decisionIndex: number, lang: Lang) => {
      const t = ACT[lang] ?? ACT.en;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decisionIndex, lang }),
        });
      } catch {
        setError(t.connError);
        throw Object.assign(new Error(t.connError), { name: NETWORK_ERROR });
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.action) {
        const msg = (typeof json?.error === "string" && json.error) || t.startError;
        setError(msg);
        throw new Error(msg);
      }
      noteServerClock(res);
      setError(null);
      setActions((prev) => merge(prev, [json.action as ActionDoc]));
    },
    [url],
  );

  // Latest action per decision (a retry after a failure is a new action).
  const byIndex = useMemo(() => {
    const out: Record<number, ActionDoc> = {};
    for (const a of actions) {
      const cur = out[a.decisionIndex];
      if (!cur || Date.parse(a.createdAt) >= Date.parse(cur.createdAt)) out[a.decisionIndex] = a;
    }
    return out;
  }, [actions]);

  return { byIndex, approve, error };
}

/** Whole seconds since `since`, ticking while `active`; null before the first tick so server and client render the same. */
function useElapsed(since: string | undefined, active: boolean): number | null {
  const start = since ? Date.parse(since) : NaN;
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!active || Number.isNaN(start)) {
      setSecs(null);
      return;
    }
    const tick = () => setSecs(Math.max(0, Math.floor((serverNow() - start) / 1000)));
    tick();
    const id = setInterval(tick, 250); // re-renders only when the second changes
    return () => clearInterval(id);
  }, [active, start]);
  return secs;
}

// ---------- helpers ----------

const enc = encodeURIComponent;
function gmailCompose(e: ActionEmail) {
  const cc = e.cc ? `&cc=${enc(e.cc)}` : "";
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(e.to ?? "")}${cc}&su=${enc(e.subject)}&body=${enc(e.body)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers or a page served over plain http.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Agent text without markdown marks, for short previews. */
function plain(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*•][ \t]+/gm, "• ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const safeUrl = (u: string) => /^https?:\/\//i.test(u);

// ---------- the action area at the bottom of a decision card ----------

export function DecisionAction({
  requestId,
  index,
  decision,
  action,
  onApprove,
  lang,
}: {
  requestId: string;
  index: number;
  decision: Decision;
  action?: ActionDoc;
  onApprove: (lang: Lang) => Promise<void>;
  lang: Lang;
}) {
  const t = ACT[lang] ?? ACT.en;
  const uid = useId();
  const status = action?.status;
  const live = status === "queued" || status === "working";
  const [pick, setPick] = useState<Lang | null>(null); // "Write it in": follows the page language until the owner picks
  const writeLang = pick ?? lang;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = useRef(false);
  const scrolled = useRef(false);

  // Animate only a change seen on this page (working → done), not a result that was already there on load.
  const [seen, setSeen] = useState(status);
  const [entered, setEntered] = useState(false);
  if (seen !== status) {
    setSeen(status);
    setEntered((seen === "queued" || seen === "working") && (status === "done" || status === "failed"));
  }

  const since = status === "working" ? (action?.claimedAt ?? action?.createdAt) : action?.createdAt;
  const secs = useElapsed(since, live);

  // After Approve or Try again, move focus to the new status so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (!focusPanel.current || !status) return;
    focusPanel.current = false;
    panelRef.current?.focus({ preventScroll: true });
  }, [status, action?.id]);

  // Back from the printable page (/r/{id}#action-{n}): bring this result into view once it has loaded.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!action || scrolled.current) return;
    scrolled.current = true;
    if (window.location.hash !== `#action-${action.decisionIndex}`) return;
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "center" }));
    setLanded(true);
  }, [action]);
  useEffect(() => {
    if (!landed) return;
    const id = setTimeout(() => setLanded(false), 1800);
    return () => clearTimeout(id);
  }, [landed]);

  async function run(l: Lang) {
    if (busy) return;
    setErr(null);
    setBusy(true);
    focusPanel.current = true;
    try {
      await onApprove(l);
    } catch (e) {
      focusPanel.current = false;
      setErr(!(e instanceof Error) ? t.startError : e.name === NETWORK_ERROR ? t.connError : e.message || t.startError);
    } finally {
      setBusy(false);
    }
  }

  const errLine = err && (
    <p className="ax-err" role="alert">
      <Icon name="alert" size={14} /> {err}
    </p>
  );

  let body: React.ReactNode;
  let announce = "";

  if (action && live) {
    const working = status === "working";
    const [title, sub] = working ? [t.working, t.writingIn[action.lang]] : [t.queued[0], secs !== null && secs >= 45 ? t.queuedSlow : t.queued[1]];
    announce = working ? t.working : t.queued.join(" ");
    body = (
      <div ref={panelRef} tabIndex={-1} className={`ax-live ax-live-${status}`}>
        <span className="ax-agent" aria-hidden="true">
          <Icon name={working ? "sparkles" : "clock"} size={18} />
        </span>
        <div className="ax-live-text">
          <strong>{title}</strong>
          {sub && <span>{sub}</span>}
        </div>
        <span className="ax-clock" aria-hidden="true">
          {secs === null ? "" : t.dur(secs)}
        </span>
        <span className="ax-trace" aria-hidden="true">
          <span />
        </span>
      </div>
    );
  } else if (action && status === "done") {
    const took = action.completedAt ? (Date.parse(action.completedAt) - Date.parse(action.createdAt)) / 1000 : NaN;
    const title = Number.isFinite(took) ? t.done(t.dur(took)) : t.doneNoTime;
    const gmail = action.channel === "gmail_draft";
    const badge = gmail ? t.savedGmail : action.email ? t.readyToSend : null;
    const links = (action.links ?? []).filter((l) => l && safeUrl(l.url));
    const email = action.email;
    announce = action.summary ? `${title}. ${action.summary}` : title;
    body = (
      <div ref={panelRef} tabIndex={-1} className={`ax-done${entered ? " ax-enter" : ""}`}>
        <div className="ax-done-head">
          <span className="ax-done-icon" aria-hidden="true">
            <Icon name="check" size={18} strokeWidth={3} />
          </span>
          <div className="ax-done-text">
            <strong>{title}</strong>
            {action.summary && <p>{action.summary}</p>}
          </div>
          {badge && (
            <span className="ax-badge">
              <Icon name={gmail ? "file" : "clipboard"} size={14} /> {badge}
            </span>
          )}
        </div>

        {email && <EmailPreview email={email} t={t} />}
        {(gmail || email) && (
          <div className="ax-btns no-print">
            {gmail && (
              <a className="btn btn-primary btn-sm" href={GMAIL_DRAFTS} target="_blank" rel="noreferrer">
                <Icon name="external" size={16} /> {t.openDrafts}
              </a>
            )}
            {email && (
              <a className={`btn btn-sm ${gmail ? "btn-secondary" : "btn-primary"}`} href={gmailCompose(email)} target="_blank" rel="noreferrer">
                <Icon name="external" size={16} /> {t.openGmail}
              </a>
            )}
            {email && <CopyButton text={`${(ACT[action.lang] ?? t).subject}: ${email.subject}\n\n${email.body}`} t={t} />}
          </div>
        )}

        {action.document && (
          <DocPreview doc={action.document} href={`/r/${encodeURIComponent(requestId)}/a/${encodeURIComponent(action.id)}`} t={t} />
        )}

        {links.length > 0 && (
          <ul className="ax-links">
            {links.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  <Icon name="external" size={13} /> {l.label || l.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  } else if (action && status === "failed") {
    announce = action.error ? `${t.failed}. ${action.error}` : t.failed;
    body = (
      <div ref={panelRef} tabIndex={-1} className={`ax-failed${entered ? " ax-enter" : ""}`}>
        <span className="ax-failed-icon" aria-hidden="true">
          <Icon name="alert" size={18} />
        </span>
        <div className="ax-failed-text">
          <strong>{t.failed}</strong>
          {action.error && <p>{action.error}</p>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(action.lang ?? writeLang)} aria-disabled={busy || undefined}>
            {busy && <Icon name="spinner" size={16} className="spin" />} {t.retry}
          </button>
          {errLine}
        </div>
      </div>
    );
  } else {
    const kind = impactKind(decision);
    body = (
      <div className="ax-idle">
        {/* aria-disabled, not disabled, while sending: a disabled button drops keyboard focus if the request fails */}
        <button
          type="button"
          className="btn btn-primary ax-approve"
          onClick={() => run(writeLang)}
          aria-disabled={busy || undefined}
          aria-describedby={`${uid}-what`}
        >
          {busy ? <Icon name="spinner" size={18} className="spin" /> : <Icon name="check" size={18} strokeWidth={2.5} />}
          {t.approve}
        </button>
        {WRITE_LANGS.length > 1 && (
          <div className="ax-seg" role="radiogroup" aria-labelledby={`${uid}-lang`}>
            <span className="ax-seg-label" id={`${uid}-lang`}>
              {t.writeIn}
            </span>
            <span className="ax-seg-track">
              {WRITE_LANGS.map((l) => (
                <label key={l} data-on={writeLang === l}>
                  <input
                    className="sr-only"
                    type="radio"
                    name={`${uid}-lang`}
                    value={l}
                    checked={writeLang === l}
                    disabled={busy}
                    onChange={() => setPick(l)}
                  />
                  {t.langName[l]}
                </label>
              ))}
            </span>
          </div>
        )}
        <p className="ax-what" id={`${uid}-what`}>
          <Icon name="shield" size={16} />
          <span>{t.what[kind]}</span>
        </p>
        {errLine}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      id={action ? `action-${action.decisionIndex}` : undefined}
      data-decision={index}
      className={`ax-tray${status === "done" ? "" : " no-print"}${landed ? " ax-landed" : ""}`}
    >
      {body}
      <p className="sr-only" role="status">
        {announce}
      </p>
    </div>
  );
}

function EmailPreview({ email, t }: { email: ActionEmail; t: ActStrings }) {
  const uid = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState<boolean | null>(null); // null until measured: stays collapsed
  const body = email.body.replace(/\r\n?/g, "\n").trim();

  // Collapsed to 8 lines with "Show all", but only when that hides 3 lines or more; a short email is shown whole.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const line = parseFloat(cs.lineHeight) || 22;
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      setLong(el.scrollHeight > pad + 11 * line);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body]);

  return (
    <div className="ax-mail" ref={boxRef}>
      <dl className="ax-mail-head">
        {email.to && (
          <div>
            <dt>{t.to}</dt>
            <dd>{email.to}</dd>
          </div>
        )}
        {email.cc && (
          <div>
            <dt>{t.cc}</dt>
            <dd>{email.cc}</dd>
          </div>
        )}
        <div>
          <dt>{t.subject}</dt>
          <dd className="ax-mail-subject">{email.subject}</dd>
        </div>
      </dl>
      <div
        ref={bodyRef}
        id={`${uid}-body`}
        className={`ax-mail-body${long === null ? "" : !long ? " ax-fit" : open ? " ax-open" : " ax-faded"}`}
      >
        {body}
      </div>
      {long && (
        <button
          type="button"
          className="ax-more no-print"
          aria-expanded={open}
          aria-controls={`${uid}-body`}
          onClick={() => {
            if (open && boxRef.current && boxRef.current.getBoundingClientRect().top < 0) boxRef.current.scrollIntoView({ block: "start" });
            setOpen(!open);
          }}
        >
          {open ? t.showLess : t.showAll}
          <Icon name="chevronDown" size={16} className={open ? "ax-flip" : undefined} />
        </button>
      )}
    </div>
  );
}

function DocPreview({ doc, href, t }: { doc: ActionDocument; href: string; t: ActStrings }) {
  const sections = doc.sections ?? [];
  const first = sections[0];
  return (
    <div className="ax-doc">
      <span className="ax-doc-icon" aria-hidden="true">
        <Icon name="file" size={20} />
      </span>
      <div className="ax-doc-main">
        <strong className="ax-doc-title">{doc.title}</strong>
        <span className="ax-doc-meta">{t.sections(sections.length)}</span>
        {first && (
          <div className="ax-doc-first">
            {first.heading && <b>{first.heading}</b>}
            <p>{plain(first.body ?? "")}</p>
          </div>
        )}
      </div>
      <a className="btn btn-secondary btn-sm ax-doc-open no-print" href={href}>
        <Icon name="printer" size={16} /> {t.viewPrint}
      </a>
    </div>
  );
}

function CopyButton({ text, t }: { text: string; t: ActStrings }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button type="button" className={`btn btn-secondary btn-sm${copied ? " ax-copied" : ""}`} onClick={async () => setCopied(await copyText(text))}>
      <Icon name={copied ? "check" : "copy"} size={16} />
      <span aria-live="polite">{copied ? t.copied : t.copy}</span>
    </button>
  );
}

// ---------- the headline at the top of the brief ----------

const PART_ICON: Record<ImpactKind, IconName> = { one_off: "receipt", monthly: "tag", financing: "landmark" };

/**
 * "BizDecide found RM1,626 for Rock Cafe": one-off money plus a year of monthly savings.
 * Funding is listed beside it but never added in: it is money you can borrow, not money you keep.
 */
export function FoundHeadline({
  totals,
  rm,
  lang,
  businessName,
}: {
  totals: { monthly: number; one_off: number; financing: number };
  rm: (n: number) => string;
  lang: Lang;
  businessName: string;
}) {
  const t = ACT[lang] ?? ACT.en;
  // Round first so every number on screen adds up (RM82/month is RM984/year, not RM979).
  const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  const oneOff = whole(totals.one_off);
  const monthly = whole(totals.monthly);
  const financing = whole(totals.financing);
  const found = oneOff + 12 * monthly;
  if (found === 0 && financing === 0) return null;

  const [before, after] = found > 0 ? t.found : t.foundFunding;
  const parts: [ImpactKind, [string, string]][] = [];
  if (found > 0) {
    // With funding only, the headline already says it all.
    if (oneOff > 0) parts.push(["one_off", t.partOneOff(rm(oneOff))]);
    if (monthly > 0) parts.push(["monthly", t.partMonthly(rm(monthly), rm(monthly * 12))]);
    if (financing > 0) parts.push(["financing", t.partFinancing(rm(financing))]);
  }

  return (
    <div className="ax-found">
      <p className="ax-found-title">
        {before}
        <span className="ax-found-amt">{rm(found > 0 ? found : financing)}</span>
        {after}
        {businessName}
      </p>
      {parts.length > 0 && (
        <ul className="ax-found-parts">
          {parts.map(([kind, [strong, rest]]) => (
            <li key={kind} className={`ax-part ax-part-${kind}`}>
              <span className="ax-part-icon" aria-hidden="true">
                <Icon name={PART_ICON[kind]} size={15} />
              </span>
              <span>
                <b>{strong}</b>
                {rest}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
