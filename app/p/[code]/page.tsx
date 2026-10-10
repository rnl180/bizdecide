"use client";

import { use, useCallback, useEffect, useState } from "react";
import { setLang, useLang } from "@/lib/i18n";
import { POLL } from "@/lib/i18n-poll";
import type { PollView } from "@/lib/poll";
import "../../poll.css";

/**
 * Audience poll: anyone in the room opens /p/<code> (QR on the owner's question card), taps an answer, and watches the
 * tally. No login, one vote per phone. The vote only adds to the tally; the owner or presenter still answers the question.
 */
export default function PollPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [view, setView] = useState<PollView | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const lang = useLang(view?.lang ?? "en");
  const t = POLL[lang];

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(code)}`, { cache: "no-store" });
      if (res.status === 404) return setMissing(true);
      if (!res.ok) return setOffline(true);
      setView(await res.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [code]);

  // Live tally every 2 s while voting is open.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 2000);
    return () => clearInterval(id);
  }, [load]);

  async function vote(option: string) {
    setSending(option);
    setNote(null);
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(code)}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ option }),
      });
      const json = await res.json().catch(() => null);
      if (json?.options) setView(json);
      if (res.ok) setNote({ tone: "ok", text: t.thanks });
      else if (res.status === 409 && json?.status === "open") setNote({ tone: "warn", text: t.already });
      else if (res.status !== 409) setNote({ tone: "err", text: t.sendErr });
    } catch {
      setNote({ tone: "err", text: t.sendErr });
    } finally {
      setSending(null);
    }
  }

  const open = view?.status === "open";
  const canVote = open && !view?.myVote && !sending;
  return (
    <div className="pl-page">
      <div className="pl-top">
        <span className="pl-brand">BizDecide</span>
        <span className="pl-code">{code.toUpperCase()}</span>
        <button type="button" className="pl-lang" onClick={() => setLang(lang === "en" ? "ms" : "en")}>
          {t.language}
        </button>
      </div>

      {missing ? (
        <p className="pl-status" data-tone="err">{t.notFound}</p>
      ) : !view ? (
        <p className="pl-hint">{offline ? t.offline : t.loading}</p>
      ) : (
        <>
          <p className="pl-kicker">{t.kicker}</p>
          <h1 className="pl-q">{view.question}</h1>
          {view.context && <p className="pl-context">{view.context}</p>}
          {open && !view.myVote && <p className="pl-hint">{t.pick}</p>}

          <ul className="pl-options" aria-label={t.live}>
            {view.options.map((o) => {
              const n = view.tally[o] ?? 0;
              const pct = view.total ? Math.round((n / view.total) * 100) : 0;
              return (
                <li key={o}>
                  <button
                    type="button"
                    className="pl-opt"
                    disabled={!canVote}
                    data-mine={view.myVote === o}
                    data-answer={view.answer === o}
                    aria-pressed={view.myVote === o}
                    onClick={() => vote(o)}
                  >
                    <span className="pl-bar" style={{ width: `${pct}%` }} aria-hidden="true" />
                    <span>{sending === o ? t.sending : o}</span>
                    <span className="pl-count">{t.votes(n)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="pl-total" aria-live="polite">
            {t.live}: {t.votes(view.total)}
          </p>
          {note && (
            <p className="pl-status" data-tone={note.tone} role="status">
              {note.text}
            </p>
          )}
          {view.myVote && !note && <p className="pl-status" data-tone="ok">{t.yourVote(view.myVote)}</p>}
          {!open && (
            <p className="pl-status" data-tone="warn">
              {t.closed} {view.answer ? t.answered(view.answer) : view.status === "expired" ? t.expired : ""}
            </p>
          )}
          {offline && <p className="pl-hint">{t.offline}</p>}
        </>
      )}
    </div>
  );
}
