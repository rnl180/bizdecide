"use client";

import { Icon } from "@/components/Icon";
import { useLang } from "@/lib/i18n";
import { APP } from "@/lib/i18n-app";
import { useKancil } from "@/lib/kancil";

/**
 * Full-page state for when something is missing or broken (404 and the app error page).
 * The faded chop says "nothing decided here"; the actions always lead somewhere useful.
 */
export function StatePage({ kind, onRetry, reference }: { kind: "notFound" | "error"; onRetry?: () => void; reference?: string }) {
  const t = APP[useLang()];
  useKancil("worried");
  const copy = kind === "notFound" ? [t.notFoundKicker, t.notFoundTitle, t.notFoundBody] : [t.errorKicker, t.errorTitle, t.errorBody];
  return (
    <section className="container state-page" aria-labelledby="state-title">
      <img className="state-mark" src="/brand/mark.svg" alt="" width={88} height={88} />
      <div className="kicker">{copy[0]}</div>
      <h1 id="state-title">{copy[1]}</h1>
      <p className="lede">{copy[2]}</p>
      {reference && (
        <p className="state-ref">
          {t.errorRef}: <code>{reference}</code>
        </p>
      )}
      <div className="row state-actions">
        {onRetry ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={onRetry}>
            <Icon name="refresh" /> {t.tryAgain}
          </button>
        ) : (
          <a href="/" className="btn btn-primary btn-lg">
            <Icon name="home" /> {t.backHome}
          </a>
        )}
        {onRetry ? (
          <a href="/" className="btn btn-secondary btn-lg">
            <Icon name="home" /> {t.backHome}
          </a>
        ) : (
          <a href="/requests" className="btn btn-secondary btn-lg">
            <Icon name="clipboard" /> {t.myRequests}
          </a>
        )}
      </div>
    </section>
  );
}
