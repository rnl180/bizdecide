"use client";

import { useLang } from "@/lib/i18n";
import { APP } from "@/lib/i18n-app";
import { MyRequestsLink } from "./MyRequests";

/** Top bar and footer, in the language picked on the home page. */
export function SiteHeader() {
  const t = APP[useLang()];
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <a href="/" className="brand">
          <span className="brand-mark">B</span>
          BizDecide
        </a>
        <div className="topbar-right">
          <MyRequestsLink />
          <a href="/skills" className="nav-link">
            {t.skills}
          </a>
          <span className="powered">
            <span className="dot" /> {t.powered}
          </span>
          <a href="/#start" className="btn btn-primary btn-sm">
            {t.newRequest}
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = APP[useLang()];
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>
          <strong>BizDecide</strong> · {t.tagline}
        </span>
        <span>
          {t.builtFor} · <a href="/skills">{t.skills}</a> · <a href="/privacy">{t.privacy}</a>
        </span>
      </div>
    </footer>
  );
}
