"use client";

import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { LANGS, setLang, type Lang } from "@/lib/i18n";
import { LANDING, type LandingStrings } from "@/lib/i18n-landing";

/** Home page hero and the marketing sections between it and the intake form. Styles live in app/landing.css (lx-*). */

const TILE_ICONS: IconName[] = ["receipt", "landmark", "tag", "chart", "sparkles", "send", "question", "calculator"];
const SKILLS_TILE = 7; // "Skills for accountants" links to /skills
const STEP_ICONS: IconName[] = ["upload", "sparkles", "clipboard", "check"];

/** Renders `parts` as unbreakable-between units, so text wraps at their joins first ("A chatbot talks. / A CFO team…"). */
function Joined({ parts, sep = " " }: { parts: string[]; sep?: string }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && sep}
          <span className="lx-unit">{p}</span>
        </Fragment>
      ))}
    </>
  );
}

/** "A chatbot talks. A CFO team does the work." -> ["A chatbot talks.", "A CFO team does the work."] */
function sentences(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    cur = cur ? `${cur} ${word}` : word;
    if (/[.?!]$/.test(word)) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** "AI CFO for Malaysian SMEs · runs on Tencent WorkBuddy" -> ["AI CFO for Malaysian SMEs ·", "runs on Tencent WorkBuddy"] */
const dotParts = (text: string) => text.split(" · ").map((p, i, all) => (i < all.length - 1 ? `${p} ·` : p));

// ---------- hero ----------

export function LandingHero({ lang, onTryDemo }: { lang: Lang; onTryDemo: () => void }) {
  const t = LANDING[lang];
  const h = t.hero;
  return (
    <section className="hero-band lx-hero" data-theme="dark">
      <div className="container lx-hero-grid">
        <div className="lx-copy">
          <div className="lang-toggle" role="group" aria-label={t.langLabel}>
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <span className="eyebrow lx-eyebrow">
            <Icon name="sparkles" size={14} />
            <span>
              <Joined parts={dotParts(h.eyebrow)} />
            </span>
          </span>
          <h1 className="lx-h1">
            <span>{h.h1[0]}</span> <span className="lx-h1-hl">{h.h1[1]}</span>
          </h1>
          <p className="lede lx-lede">{h.lede}</p>
          <div className="row lx-ctas">
            <a href="#start" className="btn btn-primary btn-lg">
              <Icon name="upload" /> {h.ctaFiles}
            </a>
            <button type="button" className="btn btn-secondary btn-lg" onClick={onTryDemo}>
              <Icon name="store" /> {h.ctaDemo}
            </button>
          </div>
          <ul className="lx-trust">
            {h.trust.map((p) => (
              <li key={p}>
                <span className="tick">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <FoundCard c={t.card} />
      </div>
    </section>
  );
}

// ---------- the sample brief ("found" card) ----------

type Phase = "still" | "counting" | "done";
const COUNT_MS = 1300;

/** "RM954.40" -> { prefix: "RM", value: 954.4, decimals: 2, suffix: "" } */
function parseMoney(s: string) {
  const m = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(s);
  if (!m) return { prefix: s, value: 0, decimals: 0, suffix: "" };
  const num = m[2] ?? "0";
  return { prefix: m[1] ?? "", value: Number(num.replace(/,/g, "")), decimals: num.split(".")[1]?.length ?? 0, suffix: m[3] ?? "" };
}

/**
 * Counts `target` up from 0 the first time `ref` is fully on screen, then reports "done".
 * Server render, no JS and reduced motion all show the final value.
 */
function useCountUp(ref: RefObject<HTMLElement | null>, target: number) {
  const [value, setValue] = useState(target);
  const [phase, setPhase] = useState<Phase>("still");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    setValue(0);
    setPhase("counting");

    const run = () => {
      const delay = performance.now() < 1500 ? 450 : 120; // on page load, let the card settle first
      let t0 = 0;
      const tick = (now: number) => {
        t0 ||= now;
        const p = Math.min(1, Math.max(0, (now - t0 - delay) / COUNT_MS));
        setValue(target * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setPhase("done");
      };
      raf = requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      run();
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        run();
      },
      { threshold: 0.9 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, target]);

  return { value, phase };
}

function FoundCard({ c }: { c: LandingStrings["card"] }) {
  const bigRef = useRef<HTMLParagraphElement>(null);
  const found = parseMoney(c.found);
  const { value, phase } = useCountUp(bigRef, found.value);
  const shown = value.toLocaleString("en-MY", { minimumFractionDigits: found.decimals, maximumFractionDigits: found.decimals });

  return (
    // The sample brief is a paper document on the night band, so it keeps the light theme.
    <div className="lx-stage" data-theme="light">
      <div className="lx-sheet lx-sheet-2" aria-hidden="true" />
      <div className="lx-sheet lx-sheet-1" aria-hidden="true" />
      <figure className="lx-found double-rule" data-phase={phase} aria-labelledby="lx-found-name lx-found-badge">
        <div className="lx-found-head">
          <span className="lx-avatar">
            <Icon name="store" size={20} />
          </span>
          <div className="lx-found-who">
            <p className="lx-found-name" id="lx-found-name">
              {c.cafe}
            </p>
            <p className="lx-found-place">{c.place}</p>
          </div>
          <span className="lx-badge" id="lx-found-badge">
            {c.badge}
          </span>
        </div>

        <div className="lx-figs">
          <div className="lx-fig">
            <p className="lx-big" ref={bigRef}>
              <span className="lx-countup" aria-hidden="true">
                <span className="lx-big-cur">{found.prefix}</span>
                {shown}
                {found.suffix}
              </span>
              <span className="sr-only">{c.found}</span>
            </p>
            <p className="lx-fig-label">{c.foundLabel}</p>
          </div>
          <div className="lx-fig lx-fig-side">
            <p className="lx-mid">{c.saved}</p>
            <p className="lx-fig-label">{c.savedLabel}</p>
          </div>
        </div>

        <ul className="lx-rows">
          {c.rows.map((r) => (
            <li key={r.title} className={`lx-row lx-p-${r.priority}`}>
              <p className="lx-row-title">{r.title}</p>
              {r.amount && <span className="lx-row-amt">{r.amount}</span>}
              <div className="lx-row-meta">
                <span className={`tag ${r.priority}`}>{r.tag}</span>
                {r.done ? (
                  // While the figure counts, this shows as pending (dot) and then gets checked off.
                  <span className="lx-status lx-done">
                    <span className="lx-status-dot lx-status-was" />
                    <Icon name="check" size={12} strokeWidth={3} />
                    {r.status}
                  </span>
                ) : (
                  <span className="lx-status">
                    <span className="lx-status-dot" />
                    {r.status}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>

        <ul className="lx-found-chips">
          {c.chips.map((chip) => (
            <li key={chip} className={`chip lx-chip${chip.includes("✓") ? " lx-chip-ok" : ""}`}>
              {chip}
            </li>
          ))}
        </ul>
        <figcaption className="lx-note">
          <Icon name="calculator" size={15} />
          {c.note}
        </figcaption>
      </figure>
    </div>
  );
}

// ---------- marketing sections ----------

export function LandingSections({ lang }: { lang: Lang }) {
  const t = LANDING[lang];
  return (
    <div className="lx-sections">
      <WhyNotChatGPT t={t.vs} />
      <Capabilities t={t.grid} />
      <HowItWorks t={t.how} />
      <Problem t={t.stats} />
      <Faq t={t.faq} />
      <CtaBand t={t.cta} />
    </div>
  );
}

function SectionHead({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return (
    <div className="section-head lx-head">
      <div className="kicker">{kicker}</div>
      <h2 id={id}>
        <Joined parts={sentences(title)} />
      </h2>
    </div>
  );
}

function WhyNotChatGPT({ t }: { t: LandingStrings["vs"] }) {
  return (
    <section className="lx-section" aria-labelledby="lx-vs-title">
      <div className="container">
        <SectionHead kicker={t.kicker} title={t.title} id="lx-vs-title" />
        <div className="lx-vs">
          {/* Column headings; each row repeats them for screen readers. */}
          <div className="lx-vs-h lx-vs-h-them" aria-hidden="true">
            <span className="lx-vs-ico">
              <Icon name="x" size={12} strokeWidth={3} />
            </span>
            {t.them}
          </div>
          <div className="lx-vs-h lx-vs-h-us" aria-hidden="true">
            <picture>
              <source srcSet="/brand/mark-dark.svg" media="(prefers-color-scheme: dark)" />
              <img className="lx-mark" src="/brand/mark.svg" alt="" width={30} height={30} />
            </picture>
            {t.us}
          </div>
          <ul className="lx-vs-rows">
            {t.rows.map(([them, us]) => (
              <li className="lx-vs-row" key={us}>
                <p className="lx-vs-them">
                  <span className="lx-vs-ico">
                    <Icon name="x" size={12} strokeWidth={3} />
                  </span>
                  <span>
                    <span className="sr-only">{t.them}: </span>
                    {them}
                  </span>
                </p>
                <p className="lx-vs-us">
                  <span className="lx-vs-ico lx-vs-ok">
                    <Icon name="check" size={12} strokeWidth={3} />
                  </span>
                  <span>
                    <span className="sr-only">{t.us}: </span>
                    {us}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Capabilities({ t }: { t: LandingStrings["grid"] }) {
  return (
    <section className="lx-section" aria-labelledby="lx-grid-title">
      <div className="container">
        <SectionHead kicker={t.kicker} title={t.title} id="lx-grid-title" />
        <ul className="lx-grid">
          {t.tiles.map((tile, i) => {
            const inner = (
              <>
                <span className="lx-tile-ico">
                  <Icon name={TILE_ICONS[i] ?? "check"} size={20} />
                </span>
                <h3 className="lx-tile-title">{tile.title}</h3>
                <p className="lx-tile-body">{tile.body}</p>
              </>
            );
            return i === SKILLS_TILE ? (
              <li key={tile.title} className="lx-tile lx-tile-link">
                <a href="/skills">
                  {inner}
                  <Icon name="arrowRight" size={18} className="lx-tile-go" />
                </a>
              </li>
            ) : (
              <li key={tile.title} className="lx-tile">
                {inner}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: LandingStrings["how"] }) {
  return (
    <section className="lx-section lx-band" aria-labelledby="lx-how-title">
      <div className="container">
        <SectionHead kicker={t.kicker} title={t.title} id="lx-how-title" />
        <ol className="lx-steps">
          {t.steps.map((s, i) => (
            <li key={s.title} className="lx-step">
              <span className="lx-step-node">
                <Icon name={STEP_ICONS[i] ?? "check"} size={20} />
                <span className="lx-step-n">{i + 1}</span>
              </span>
              <h3 className="lx-step-title">{s.title}</h3>
              <p className="lx-step-body">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="lx-agents">
          <p className="lx-running" id="lx-agents-label">
            <span className="lx-dot" aria-hidden="true" />
            {t.running}
          </p>
          <ul className="lx-agent-list" aria-labelledby="lx-agents-label">
            {t.agents.map((a) => (
              <li key={a} className="chip lx-agent">
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** "1.1 million" -> ["1.1", " million"] so the unit can sit smaller than the figure. */
function splitStat(v: string): [string, string] {
  const m = /^([~≈]?[\d.,]+%?)(\s.+)?$/.exec(v);
  return m ? [m[1] ?? v, m[2] ?? ""] : [v, ""];
}

function Problem({ t }: { t: LandingStrings["stats"] }) {
  return (
    <section className="lx-section" aria-labelledby="lx-stats-title">
      <div className="container">
        <SectionHead kicker={t.kicker} title={t.title} id="lx-stats-title" />
        <ul className="lx-stats">
          {t.items.map((s) => {
            const [figure, unit] = splitStat(s.value);
            const cut = s.source.lastIndexOf(" ") + 1; // keep the icon on the line of the last word
            return (
              <li key={s.href} className="lx-stat">
                <p className="lx-stat-v">
                  {figure}
                  {unit && (
                    <>
                      {" "}
                      <span className="lx-stat-unit">{unit.trim()}</span>
                    </>
                  )}
                </p>
                <p className="lx-stat-l">{s.label}</p>
                <a className="lx-src" href={s.href} target="_blank" rel="noreferrer">
                  {s.source.slice(0, cut)}
                  <span className="lx-src-end">
                    {s.source.slice(cut)}
                    <Icon name="external" size={12} />
                  </span>
                  <span className="sr-only"> {t.newTab}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Plain answers to what owners worry about before uploading: data, sending, accuracy, approval. */
function Faq({ t }: { t: LandingStrings["faq"] }) {
  return (
    <section className="lx-section" aria-labelledby="lx-faq-title">
      <div className="container lx-faq">
        <div className="section-head lx-head lx-faq-head">
          <div className="kicker">{t.kicker}</div>
          <h2 id="lx-faq-title">{t.title}</h2>
          <a className="lx-faq-link" href="/privacy">
            <Icon name="shield" size={16} /> {t.privacyLink}
          </a>
        </div>
        <div className="lx-faq-list">
          {t.items.map(([q, a], i) => (
            <details key={q} className="lx-qa" open={i === 0}>
              <summary>
                <span>{q}</span>
                <Icon name="plus" size={18} className="lx-qa-ico" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand({ t }: { t: LandingStrings["cta"] }) {
  return (
    <section className="lx-section lx-cta-wrap" aria-labelledby="lx-cta-title">
      <div className="container">
        <div className="lx-cta" data-theme="dark">
          <div className="lx-cta-copy">
            <h2 className="lx-cta-title" id="lx-cta-title">
              {t.title}
            </h2>
            <p className="lx-cta-sub">{t.sub}</p>
          </div>
          <a href="#start" className="btn btn-primary btn-lg lx-cta-btn">
            <Icon name="upload" /> {t.button}
          </a>
        </div>
      </div>
    </section>
  );
}
