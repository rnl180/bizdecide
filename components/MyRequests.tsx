"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { SERVICE_ICONS, StatusBadge } from "./RequestMeta";
import { INTAKE, useLang, type Lang } from "@/lib/i18n";
import { APP, type AppStrings } from "@/lib/i18n-app";
import { money } from "@/lib/markets";
import { clearRequests, removeRequest, saveRequest, toSaved, useMyRequests, type SavedRequest } from "@/lib/myRequests";
import { SERVICE_LABELS } from "@/lib/types";

const when = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Top-bar link with a count of the requests saved on this device. */
export function MyRequestsLink({ current }: { current?: "page" }) {
  const list = useMyRequests();
  const t = APP[useLang()];
  return (
    <a href="/requests" className="nav-link my-req-link" aria-current={current} aria-label={list.length ? `${t.myRequests} (${list.length})` : undefined}>
      <Icon name="clipboard" size={16} />
      <span className="label">{t.myRequests}</span>
      {list.length > 0 && <span className="count">{list.length}</span>}
    </a>
  );
}

/** Refreshes the status of unfinished requests once, so the list isn't stale. */
function useRefreshPending(list: SavedRequest[]) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !list.length) return;
    done.current = true;
    for (const r of list.filter((x) => x.status !== "completed" && x.status !== "failed").slice(0, 10)) {
      fetch(`/api/requests/${r.id}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => j && saveRequest(toSaved(j.request, j.result)))
        .catch(() => {});
    }
  }, [list]);
}

function RequestRow({ r, removable, t, lang }: { r: SavedRequest; removable?: boolean; t: AppStrings; lang: Lang }) {
  return (
    <li className="req-row">
      <a href={`/r/${r.id}`} className="req-link">
        <span className="req-icon">
          <Icon name={SERVICE_ICONS[r.service] ?? "clipboard"} size={18} />
        </span>
        <span className="req-main">
          <span className="req-title">
            <strong>{r.businessName}</strong>
            <StatusBadge status={r.status} label={t.status[r.status]} />
          </span>
          <span className="req-meta">
            {(INTAKE[lang].services ?? SERVICE_LABELS)[r.service]?.title ?? r.service} · {when(r.createdAt, t.dateLocale)}
          </span>
          {r.headline && <span className="req-headline">{r.headline}</span>}
        </span>
        {r.impactRm ? (
          <span className="req-impact">
            +{money(r.market)(r.impactRm)}
            {t.perMonth}
          </span>
        ) : null}
        <Icon name="arrowRight" size={16} className="req-go" />
      </a>
      {removable && (
        <button type="button" className="icon-btn" aria-label={t.removeFromDevice(r.businessName)} onClick={() => removeRequest(r.id)}>
          <Icon name="x" size={16} />
        </button>
      )}
    </li>
  );
}

/** Home page strip: the latest few requests, hidden when there are none. */
export function RecentRequests() {
  const list = useMyRequests();
  const lang = useLang();
  const t = APP[lang];
  useRefreshPending(list);
  if (!list.length) return null;
  return (
    <section className="container section recent">
      <div className="recent-head">
        <div>
          <div className="kicker">{t.welcomeBack}</div>
          <h2>{t.recentTitle}</h2>
        </div>
        <a href="/requests" className="btn btn-secondary btn-sm">
          {t.viewAll(list.length)} <Icon name="arrowRight" size={14} />
        </a>
      </div>
      <ul className="req-list card">
        {list.slice(0, 3).map((r) => (
          <RequestRow key={r.id} r={r} t={t} lang={lang} />
        ))}
      </ul>
    </section>
  );
}

/** The /requests page body. */
export function MyRequestsPage() {
  const list = useMyRequests();
  const lang = useLang();
  const t = APP[lang];
  useRefreshPending(list);

  return (
    <div className="container container-narrow page">
      <header className="page-head">
        <div>
          <h1>{t.pageTitle}</h1>
          <p className="lede">{t.pageLede}</p>
        </div>
        {list.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm(t.clearConfirm)) clearRequests();
            }}
          >
            {t.clearList}
          </button>
        )}
      </header>

      {list.length ? (
        <ul className="req-list card">
          {list.map((r) => (
            <RequestRow key={r.id} r={r} removable t={t} lang={lang} />
          ))}
        </ul>
      ) : (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="clipboard" size={22} />
          </span>
          <h2>{t.emptyTitle}</h2>
          <p className="muted">{t.emptyBody}</p>
          <a href="/#start" className="btn btn-primary">
            {t.startRequest} <Icon name="arrowRight" />
          </a>
        </div>
      )}

      <div className="notice" style={{ marginTop: 16 }}>
        <Icon name="info" />
        <p>
          {t.deviceNote[0]}
          <strong>{t.deviceNote[1]}</strong>
          {t.deviceNote[2]}
        </p>
      </div>
    </div>
  );
}
