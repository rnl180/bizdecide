"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LANGS, setLang, useLang } from "@/lib/i18n";
import { Icon } from "./Icon";
import { APP } from "@/lib/i18n-app";
import { MyRequestsLink } from "./MyRequests";

/** The primary lockup: the waves-and-sun mark + wordmark, swapped for the dark-ground version in dark mode. */
function Lockup({ height }: { height: number }) {
  return (
    <picture>
      <source srcSet="/brand/lockup-dark.svg" media="(prefers-color-scheme: dark)" />
      <img src="/brand/lockup.svg" alt="BizDecide" width={Math.round((height * 286.47) / 64)} height={height} />
    </picture>
  );
}

const SECTIONS = ["how"] as const;

/** Marks the landing section in view, so its header link can show it. */
function useSectionInView(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return setActive(null);
    let raf = 0;
    const update = () => {
      raf = 0;
      let current: string | null = null;
      for (const id of SECTIONS) {
        const r = document.getElementById(id)?.getBoundingClientRect();
        if (r && r.top <= 170 && r.bottom > 170) current = id; // just under the header
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);
  return active;
}

/** Current language in its own name; opens a two-item menu. Labelled in itself, never with a flag. */
function LangMenu() {
  const lang = useLang();
  const t = APP[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <div className="hdr-lang" ref={ref}>
      <button type="button" className="hdr-lang-btn" aria-haspopup="true" aria-expanded={open} aria-label={`${t.language}: ${current.label}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="languages" size={18} />
        <span lang={current.code}>{current.label}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <ul className="hdr-lang-menu">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                aria-pressed={lang === l.code}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
              >
                {l.label}
                {lang === l.code && <Icon name="check" size={16} strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Site header: a paper strip that floats over the page (and over the night hero on the landing page).
 * Desktop shows the landing sections, the language menu, My requests and New request.
 * Phones and tablets get a full-screen night menu with New request pinned at the bottom.
 */
export function SiteHeader() {
  const lang = useLang();
  const t = APP[lang];
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const section = useSectionInView(path === "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu: close on navigation; while open, lock the page, keep focus inside, close on Escape.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("a, button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const page = (href: string) => (path === href ? "page" : undefined);
  const nav = [
    { href: "/#how", id: "how", label: t.navHow, icon: "sparkles" },
  ] as const;

  return (
    <>
      <a href="#main" className="skip-link">
        {t.skipLink}
      </a>
      <header className="topbar" data-scrolled={scrolled || undefined}>
        <div className="container">
          <div className="topbar-bar">
            <a href="/" className="brand" aria-label={t.homeLabel}>
              <Lockup height={30} />
            </a>
            <nav className="topnav" aria-label={t.mainNav}>
              <ul>
                {nav.map((n) => (
                  <li key={n.id}>
                    <a href={n.href} aria-current={section === n.id ? "location" : undefined}>
                      {n.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/skills" aria-current={page("/skills")}>
                    {t.skills}
                  </a>
                </li>
              </ul>
            </nav>
            <div className="topbar-actions">
              {LANGS.length > 1 && <LangMenu />}
              <MyRequestsLink current={page("/requests")} />
              <a href="/#start" className="btn btn-primary hdr-cta">
                <Icon name="plus" size={18} strokeWidth={2.25} />
                <span className="hdr-cta-label">{t.newRequest}</span>
              </a>
              <button
                ref={buttonRef}
                type="button"
                className="hdr-menu-btn"
                aria-expanded={open}
                aria-controls="site-menu"
                aria-label={t.menu}
                onClick={() => setOpen(true)}
              >
                <Icon name="menu" size={22} />
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div id="site-menu" ref={panelRef} className="site-menu" role="dialog" aria-modal="true" aria-label={t.menu}>
            <div className="site-menu-top">
              <Lockup height={28} />
              <button
                type="button"
                className="hdr-menu-btn site-menu-close"
                aria-label={t.closeMenu}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="site-menu-body">
              <ul className="site-menu-list">
                <li>
                  <a href="/" aria-current={page("/")} onClick={() => setOpen(false)}>
                    <Icon name="home" size={20} /> {t.homeLabel} <Icon name="arrowRight" size={18} className="site-menu-go" />
                  </a>
                </li>
                {nav.map((n) => (
                  <li key={n.id}>
                    <a href={n.href} onClick={() => setOpen(false)}>
                      <Icon name={n.icon} size={20} /> {n.label} <Icon name="arrowRight" size={18} className="site-menu-go" />
                    </a>
                  </li>
                ))}
              </ul>
              <ul className="site-menu-list">
                <li>
                  <a href="/requests" aria-current={page("/requests")}>
                    <Icon name="clipboard" size={20} /> {t.myRequests} <Icon name="arrowRight" size={18} className="site-menu-go" />
                  </a>
                </li>
                <li>
                  <a href="/skills" aria-current={page("/skills")}>
                    <Icon name="package" size={20} /> {t.skills} <Icon name="arrowRight" size={18} className="site-menu-go" />
                  </a>
                </li>
                <li>
                  <a href="/privacy" aria-current={page("/privacy")}>
                    <Icon name="shield" size={20} /> {t.privacy} <Icon name="arrowRight" size={18} className="site-menu-go" />
                  </a>
                </li>
              </ul>
              {LANGS.length > 1 && (
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
              )}
            </div>
            <div className="site-menu-foot">
              <a href="/#start" className="btn btn-primary btn-lg" onClick={() => setOpen(false)}>
                <Icon name="plus" size={18} strokeWidth={2.25} /> {t.newRequest}
              </a>
            </div>
          </div>
        )}
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
        {LANGS.length > 1 && (
          <div className="lang-toggle footer-lang" role="group" aria-label={t.language}>
            {LANGS.map((l) => (
              <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
