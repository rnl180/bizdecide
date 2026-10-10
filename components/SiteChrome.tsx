"use client";

import { LANGS, setLang, useLang } from "@/lib/i18n";
import { APP } from "@/lib/i18n-app";
import { MyRequestsLink } from "./MyRequests";

/** The primary lockup: the Path Chop + wordmark, swapped for the dark-ground version in dark mode. */
function Lockup({ height }: { height: number }) {
  return (
    <picture>
      <source srcSet="/brand/lockup-dark.svg" media="(prefers-color-scheme: dark)" />
      <img src="/brand/lockup.svg" alt="BizDecide" width={Math.round((height * 222.66) / 64)} height={height} />
    </picture>
  );
}

/** Top bar and footer, in the language picked on the home page. */
export function SiteHeader() {
  const t = APP[useLang()];
  return (
    <>
      <a href="#main" className="skip-link">
        {t.skipLink}
      </a>
      <header className="topbar">
      <div className="container topbar-inner">
        <a href="/" className="brand" aria-label="BizDecide home">
          <Lockup height={32} />
        </a>
        <div className="topbar-right">
          <MyRequestsLink />
          <a href="/skills" className="nav-link">
            {t.skills}
          </a>
          <a href="/#start" className="btn btn-primary btn-sm">
            {t.newRequest}
          </a>
        </div>
      </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  const lang = useLang();
  const t = APP[lang];
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Lockup height={28} />
          <span className="footer-tagline">{t.tagline}</span>
        </div>
        <span className="footer-links">
          {t.builtFor} · <a href="/skills">{t.skills}</a> · <a href="/privacy">{t.privacy}</a>
        </span>
        {/* Each language is labelled in itself, never with a flag. */}
        <div className="lang-toggle footer-lang" role="group" aria-label={t.language}>
          {LANGS.map((l) => (
            <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
