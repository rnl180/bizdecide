"use client";

import { use, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useLang } from "@/lib/i18n";
import { ACT } from "@/lib/i18n-actions";
import type { ActionDoc, RequestDoc } from "@/lib/types";

/** One action's result as a clean letter or document the owner can read, print or save as PDF. */

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "offline" }
  | { kind: "ready"; request: RequestDoc; action: ActionDoc };

export default function ActionResultPage({ params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = use(params);
  const [state, setState] = useState<State>({ kind: "loading" });
  const lang = useLang(state.kind === "ready" ? state.request.language : undefined);
  const t = ACT[lang];
  const brief = `/r/${encodeURIComponent(id)}`;

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const base = `/api/requests/${encodeURIComponent(id)}`;
        const [r, a] = await Promise.all([fetch(base, { cache: "no-store" }), fetch(`${base}/actions`, { cache: "no-store" })]);
        const [rj, aj] = await Promise.all([r.json().catch(() => null), a.json().catch(() => null)]);
        const request: RequestDoc | undefined = r.ok ? rj?.request : undefined;
        const actions: ActionDoc[] = a.ok && Array.isArray(aj?.actions) ? aj.actions : [];
        const action = actions.find((x) => x.id === actionId);
        if (stop) return;
        setState(request && action && (action.document || action.email) ? { kind: "ready", request, action } : { kind: "missing" });
      } catch {
        if (!stop) setState({ kind: "offline" });
      }
    })();
    return () => {
      stop = true;
    };
  }, [id, actionId]);

  // Gives "Save as PDF" a useful file name.
  useEffect(() => {
    if (state.kind !== "ready") return;
    const before = document.title;
    const { action, request } = state;
    document.title = `${action.document?.title ?? action.email?.subject ?? action.decisionTitle} - ${request.businessName}`;
    return () => {
      document.title = before;
    };
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="container ax-print" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <div className="ax-print-bar">
          <div className="skeleton" style={{ width: 160, height: 16 }} />
          <div className="skeleton" style={{ width: 130, height: 36 }} />
        </div>
        <div className="ax-sheet">
          <div className="skeleton" style={{ width: "38%", height: 22, marginBottom: 36 }} />
          <div className="skeleton" style={{ width: "72%", height: 30, marginBottom: 28 }} />
          {[94, 88, 91, 64].map((w) => (
            <div key={w} className="skeleton" style={{ width: `${w}%`, height: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind !== "ready") {
    return (
      <div className="container container-narrow page">
        <div className="card empty">
          <span className="empty-icon">
            <Icon name={state.kind === "offline" ? "alert" : "file"} size={22} />
          </span>
          <h2>{state.kind === "offline" ? t.connError : t.notFound}</h2>
          <a href={brief} className="btn btn-secondary" style={{ marginTop: 8 }}>
            <Icon name="arrowLeft" /> {t.back}
          </a>
        </div>
      </div>
    );
  }

  const { request, action } = state;
  const d = ACT[action.lang] ?? t; // printed text follows the document's language, buttons follow the page's
  const when = new Date(action.completedAt ?? action.createdAt);
  const date = Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString(d.dateLocale, { day: "numeric", month: "long", year: "numeric" });
  const doc = action.document;
  const email = action.email;

  return (
    <div className="container ax-print">
      <div className="ax-print-bar no-print">
        <a href={`${brief}#action-${action.decisionIndex}`} className="back-link">
          <Icon name="arrowLeft" size={16} /> {t.back}
        </a>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Icon name="download" size={16} /> {t.savePdf}
        </button>
      </div>

      <article className="ax-sheet" lang={action.lang}>
        <header className="ax-letterhead">
          <strong>{request.businessName}</strong>
        </header>

        {doc && (
          <>
            <h1 className="ax-sheet-title">{doc.title}</h1>
            {(doc.sections ?? []).map((s, i) => (
              <section className="ax-sec" key={i}>
                {s.heading && <h2>{s.heading}</h2>}
                <RichText text={s.body ?? ""} />
              </section>
            ))}
          </>
        )}

        {email && (
          <section className={doc ? "ax-letter-after" : undefined}>
            <dl className="ax-letter-head">
              {email.to && (
                <div>
                  <dt>{d.to}</dt>
                  <dd>{email.to}</dd>
                </div>
              )}
              {email.cc && (
                <div>
                  <dt>{d.cc}</dt>
                  <dd>{email.cc}</dd>
                </div>
              )}
              <div>
                <dt>{d.subject}</dt>
                <dd>
                  <strong>{email.subject}</strong>
                </dd>
              </div>
            </dl>
            <div className="ax-letter-body">{email.body.replace(/\r\n?/g, "\n").trim()}</div>
          </section>
        )}

        <footer className="ax-sheet-foot">
          {d.preparedBy}
          {date && ` · ${date}`}
        </footer>
      </article>
    </div>
  );
}

// ---------- agent-written text: paragraphs, "- " and "1. " lists, "## " headings and **bold** ----------

type Block = { type: "p" | "ul" | "ol" | "h"; lines: string[] };

function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const h = raw.match(/^\s*#{1,6}\s+(.*)$/);
    const ul = raw.match(/^\s*[-*•]\s+(.*)$/);
    const ol = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    const type: Block["type"] | null = h ? "h" : ul ? "ul" : ol ? "ol" : raw.trim() ? "p" : null;
    if (!type) {
      cur = null; // a blank line ends the block
      continue;
    }
    const line = (h ?? ul ?? ol)?.[1] ?? raw.trim();
    if (cur && cur.type === type && type !== "h") cur.lines.push(line);
    else out.push((cur = { type, lines: [line] }));
  }
  return out;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
        /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
      )}
    </>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {toBlocks(text).map((b, i) => {
        if (b.type === "h") {
          return (
            <h3 key={i}>
              <Inline text={b.lines[0] ?? ""} />
            </h3>
          );
        }
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type;
          return (
            <List key={i}>
              {b.lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            <Inline text={b.lines.join("\n")} />
          </p>
        );
      })}
    </>
  );
}
