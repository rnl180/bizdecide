"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LANGS, setLang, useLang } from "@/lib/i18n";
import { Icon } from "./Icon";
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
  const lang = useLang();
  const t = APP[lang];
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation, on Escape and on a click outside; return focus to the menu button.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <a href="#main" className="skip-link">
        {t.skipLink}
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <a href="/" className="brand" aria-label={t.homeLabel}>
            <Lockup height={32} />
          </a>
          <nav className="topbar-right" aria-label={t.mainNav}>
            <MyRequestsLink current={current("/requests")} />
            <a href="/skills" className="nav-link nav-desktop" aria-current={current("/skills")}>
              <Icon name="package" size={16} />
              {t.skills}
            </a>
            <div className="lang-toggle header-lang" role="group" aria-label={t.language}>
              {LANGS.map((l) => (
                <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
            <a href="/#start" className="btn btn-primary btn-sm">
              <Icon name="plus" size={16} />
              <span className="new-label">{t.newRequest}</span>
            </a>
            <button
              ref={buttonRef}
              type="button"
              className="icon-btn menu-btn"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? t.closeMenu : t.menu}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? "x" : "menu"} size={20} />
            </button>
          </nav>
        </div>
        {/* Phones: everything the bar can't fit, plus the language switch. */}
        <div id="site-menu" ref={panelRef} className="site-menu" hidden={!open}>
          <div className="container">
            <ul className="site-menu-list">
              <li>
                <a href="/" aria-current={current("/")}>
                  <Icon name="home" size={20} /> {t.homeLabel}
                </a>
              </li>
              <li>
                <a href="/requests" aria-current={current("/requests")}>
                  <Icon name="clipboard" size={20} /> {t.myRequests}
                </a>
              </li>
              <li>
                <a href="/skills" aria-current={current("/skills")}>
                  <Icon name="package" size={20} /> {t.skills}
                </a>
              </li>
              <li>
                <a href="/privacy" aria-current={current("/privacy")}>
                  <Icon name="shield" size={20} /> {t.privacy}
                </a>
              </li>
            </ul>
            <div className="site-menu-lang">
              <span className="mini-label">
                <Icon name="languages" size={14} /> {t.language}
              </span>
              <div className="lang-toggle" role="group" aria-label={t.language}>
                {LANGS.map((l) => (
                  <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
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
