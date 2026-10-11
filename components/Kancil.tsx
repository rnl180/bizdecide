"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useLang } from "@/lib/i18n";
import { KANCIL_LINES, kancilTipDone, kancilTipShown, useKancilMood, useKancilTips, type KancilMood, type KancilTip } from "@/lib/kancil";

/**
 * Kancil, the mouse-deer in the bottom corner. It walks in on the first visit of a session and waves, walks along
 * while the page scrolls, catches files dragged over the page, shows what pages set with useKancil (digging while a
 * request runs, cheering when the brief is ready, worried on errors) and falls asleep after a minute of nothing.
 * As a coach it runs to whatever a queued tip is about (useKancilTip), says it beside it, and runs back.
 * Decorative: hidden from screen readers (pages already announce their status), and it can be hidden for good.
 * Styles in app/kancil.css, poses in public/mascot/.
 */

type Pose = "front" | "side" | "walk" | "sleep" | KancilMood;
/** Which side of Kancil the speech bubble opens to, so it never covers what he points at or leaves the screen. */
type Say = "left" | "right" | "up-left" | "up-right";
/** Where he stands for a tip, as an offset from his corner. */
type Spot = { dx: number; dy: number; say: Say };

const POSE_FILE: Record<Exclude<Pose, "walk">, string> = {
  front: "view-front",
  side: "view-side",
  sleep: "pose-sleep",
  wave: "pose-wave",
  peek: "pose-peek",
  catch: "pose-catch",
  read: "pose-read",
  dig: "pose-dig",
  cheer: "pose-cheer",
  worried: "pose-worried",
};
const poseSrc = (p: Exclude<Pose, "walk">) => `/mascot/${POSE_FILE[p]}.svg`;
const WALK = [1, 2, 3, 4].map((n) => `/mascot/walk-${n}.svg`);

/** Moods that are a moment: shown this long, then Kancil settles back to idle. */
const MOMENT_MS: Partial<Record<KancilMood, number>> = { cheer: 5000, wave: 3500 };
const ENTER_MS = 1400;
const SAY_MS = 3800;
const TIP_MS = 5000;
const RUN_MS = 700; // matches the transform transition in app/kancil.css
const DIG_LINE_MS = 8000;
const SLEEP_AFTER_MS = 60_000;
const HIDDEN_KEY = "bizdecide:kancil-hidden";
const GREETED_KEY = "bizdecide:kancil-greeted";
const EDGE = 8;
const BUBBLE_ROOM = 216; // the bubble's max width plus a margin

function stored(area: "localStorage" | "sessionStorage", key: string, value?: string) {
  try {
    if (value === undefined) return window[area].getItem(key);
    window[area].setItem(key, value);
  } catch {} // private mode or blocked storage: Kancil just forgets
  return null;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
}

/** The free band of the screen: under the floating header, above the bottom edge. */
function band() {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const top = (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) + EDGE;
  return { vw, vh, top };
}

/** True while enough of `el` is on screen to point at it. */
function inView(el: Element) {
  const r = el.getBoundingClientRect();
  const { vw, vh, top } = band();
  return r.width > 0 && r.bottom > top + 24 && r.top < vh - 24 && r.right > 0 && r.left < vw;
}

/**
 * Where Kancil (`k`, sitting in his corner) stands for a tip about `el`: beside it on the asked side, else the other
 * side, else just above its right end; "inside" stands in its bottom-right corner. The bubble opens away from `el`.
 */
function spotFor(el: Element, place: NonNullable<KancilTip["place"]>, k: HTMLElement): Spot {
  const { vw, vh, top } = band();
  const cs = getComputedStyle(k);
  const size = k.offsetWidth;
  const home = { x: vw - parseFloat(cs.right) - size, y: vh - parseFloat(cs.bottom) - size };
  const r = el.getBoundingClientRect();
  const leftX = r.left - size - EDGE;
  const rightX = r.right + EDGE;
  const fitsLeft = leftX >= EDGE;
  const fitsRight = rightX + size <= vw - EDGE;
  let x: number;
  let y = r.bottom - size;
  let say: Say;
  if (place === "inside") {
    x = r.right - size - 16;
    y = r.bottom - size - 12;
    say = x >= BUBBLE_ROOM ? "left" : "up-left";
  } else if ((place === "left" && fitsLeft) || (place === "right" && !fitsRight && fitsLeft)) {
    x = leftX;
    say = x >= BUBBLE_ROOM ? "left" : "up-left";
  } else if (fitsRight) {
    x = rightX;
    say = vw - rightX - size >= BUBBLE_ROOM ? "right" : "up-right";
  } else {
    x = Math.min(Math.max(r.right - size, EDGE), vw - size - EDGE);
    y = r.top - size + 6;
    say = x >= BUBBLE_ROOM ? "left" : "right";
  }
  y = Math.min(Math.max(y, top), vh - size - EDGE);
  return { dx: Math.round(x - home.x), dy: Math.round(y - home.y), say };
}

export function Kancil() {
  const lines = KANCIL_LINES[useLang()];
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const pageMood = useKancilMood();
  const pageMoodRef = useRef(pageMood);
  pageMoodRef.current = pageMood;
  const tips = useKancilTips();
  const reduced = useReducedMotion();
  const elRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [entering, setEntering] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [settled, setSettled] = useState(false);
  const [walking, setWalking] = useState(false);
  const [face, setFace] = useState<"left" | "right">("right");
  const [dragging, setDragging] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [hopping, setHopping] = useState(false);
  const [say, setSay] = useState<{ text: string; at: number } | null>(null);
  // The tip on screen; `anchored` when its target was in view, so he stands by it (else he says it from his corner).
  const [active, setActive] = useState<{ id: string; anchored: boolean } | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [moving, setMoving] = useState(false);
  const talk = useCallback((text: string) => setSay({ text, at: Date.now() }), []);

  const tip = active ? (tips.find((t) => t.id === active.id) ?? null) : null;
  const anchored = Boolean(active?.anchored);

  useEffect(() => {
    setHidden(stored("localStorage", HIDDEN_KEY) === "1");
    setReady(true);
  }, []);
  const on = ready && !hidden;
  const free = on && !entering && !greeting && !dragging;

  // First visit this session: walk in from the edge, then wave (unless the page already has something to show).
  // The flag is written once the greeting is done, so a remount mid-way just starts it again.
  useEffect(() => {
    if (!on || stored("sessionStorage", GREETED_KEY)) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const greet = () => {
      stored("sessionStorage", GREETED_KEY, "1");
      if (pageMoodRef.current) return;
      setGreeting(true);
      talk(linesRef.current.hello);
      timers.push(setTimeout(() => setGreeting(false), MOMENT_MS.wave));
    };
    if (window.matchMedia(REDUCED).matches) greet();
    else {
      setEntering(true);
      setFace("left");
      timers.push(
        setTimeout(() => {
          setEntering(false);
          greet();
        }, ENTER_MS),
      );
    }
    return () => {
      timers.forEach(clearTimeout);
      setEntering(false);
      setGreeting(false);
    };
  }, [on, talk]);

  // A moment mood (cheer) plays once, then Kancil settles while the page keeps it set.
  useEffect(() => {
    setSettled(false);
    const ms = pageMood && MOMENT_MS[pageMood];
    if (!ms) return;
    const id = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(id);
  }, [pageMood]);

  // Scrolling: walk, facing the way the page moves.
  useEffect(() => {
    if (!on) return;
    let lastY = window.scrollY;
    let stop: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) setFace(y > lastY ? "right" : "left");
      lastY = y;
      setWalking(true);
      clearTimeout(stop);
      stop = setTimeout(() => setWalking(false), 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(stop);
      window.removeEventListener("scroll", onScroll);
    };
  }, [on]);

  // Files dragged anywhere over the page: get ready to catch.
  useEffect(() => {
    if (!on) return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const end = () => {
      depth = 0;
      setDragging(false);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", end);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragend", end);
    };
  }, [on]);

  // A minute with no input: sleep. Any input wakes him.
  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout>;
    let last = 0;
    const wake = () => {
      const now = Date.now();
      if (now - last < 500) return;
      last = now;
      setAsleep(false);
      clearTimeout(timer);
      timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    wake();
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [on]);

  // A little hop when the pointer reaches a main button.
  useEffect(() => {
    if (!on) return;
    const over = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.(".btn-primary");
      if (btn && !btn.contains(e.relatedTarget as Node | null)) setHopping(true);
    };
    document.addEventListener("pointerover", over);
    return () => document.removeEventListener("pointerover", over);
  }, [on]);

  // Warm the cache with every pose once the page is idle, so switching never flashes.
  useEffect(() => {
    if (!on) return;
    const load = () => [...Object.keys(POSE_FILE).map((p) => poseSrc(p as Exclude<Pose, "walk">)), ...WALK].forEach((s) => (new Image().src = s));
    const id = setTimeout(load, 2000);
    return () => clearTimeout(id);
  }, [on]);

  // Coach: take the next tip once Kancil is free. When its target is off screen he says it from his corner,
  // or drops it if the tip asks for that (the tour).
  useEffect(() => {
    if (!free || active || !tips.length) return;
    const next = tips[0]!;
    const target = next.target ? document.querySelector(next.target) : null;
    const seen = Boolean(target && inView(target));
    if (next.target && !seen && next.skipUnseen) return kancilTipDone(next.id);
    kancilTipShown(next);
    setActive({ id: next.id, anchored: seen });
  }, [free, active, tips]);

  // The tip left the queue (its time is up, it was skipped, or it no longer applies): back to the corner.
  useEffect(() => {
    if (active && !tip) setActive(null);
  }, [active, tip]);

  // While a tip shows: stand by its target, follow it as the page moves, and end it after its time
  // (or as soon as the target scrolls away).
  useEffect(() => {
    if (!tip) return setSpot(null);
    const { id, target } = tip;
    const timer = setTimeout(() => kancilTipDone(id), tip.ms ?? TIP_MS);
    if (!target || !anchored) return () => clearTimeout(timer);
    let raf = 0;
    const place = () => {
      raf = 0;
      const el = document.querySelector(target);
      const k = elRef.current;
      if (!el || !k || !inView(el)) return kancilTipDone(id);
      setSpot(spotFor(el, tip.place ?? "left", k));
    };
    place();
    const follow = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [tip, anchored]);

  // Running: a real move (not just following a scroll) plays the run cycle, facing the way he goes.
  const lastSpot = useRef<Spot | null>(null);
  const runTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const from = lastSpot.current ?? { dx: 0, dy: 0 };
    const to = spot ?? { dx: 0, dy: 0 };
    lastSpot.current = spot;
    if (reduced || Math.hypot(to.dx - from.dx, to.dy - from.dy) < 40) return;
    setFace(to.dx < from.dx ? "left" : "right");
    setMoving(true);
    clearTimeout(runTimer.current);
    runTimer.current = setTimeout(() => setMoving(false), RUN_MS);
  }, [spot, reduced]);
  useEffect(() => () => clearTimeout(runTimer.current), []);

  const mood = pageMood && !(MOMENT_MS[pageMood] && settled) ? pageMood : null;
  const pose: Pose = entering || moving
    ? "walk"
    : dragging
      ? "catch"
      : tip
        ? (tip.pose ?? "wave")
        : (mood ?? (greeting ? "wave" : asleep ? "sleep" : walking ? (reduced ? "side" : "walk") : "front"));

  // Say what is going on when the pose changes; while digging, a new line every few seconds. Quiet during a tip.
  const tipShowing = Boolean(tip);
  useEffect(() => {
    if (!on || tipShowing) return;
    const l = linesRef.current;
    const line = { catch: l.catch, read: l.read, peek: l.peek, cheer: l.cheer, worried: l.worried }[pose as string];
    if (line) talk(line);
    if (pose !== "dig") return;
    let turn = 0;
    const next = () => talk(l.dig[turn++ % l.dig.length]!);
    next();
    const id = setInterval(next, DIG_LINE_MS);
    return () => clearInterval(id);
  }, [on, pose, talk, tipShowing]);

  useEffect(() => {
    if (!say) return;
    const id = setTimeout(() => setSay(null), SAY_MS);
    return () => clearTimeout(id);
  }, [say]);

  if (!on) return null;

  const bubble = tip ? { text: tip.text, key: tip.id } : say ? { text: say.text, key: String(say.at) } : null;

  return (
    <div
      ref={elRef}
      className="kc no-print"
      data-pose={pose}
      data-face={face}
      data-enter={entering || undefined}
      data-moving={moving || undefined}
      data-say={(tip && spot?.say) || undefined}
      style={spot ? { transform: `translate(${spot.dx}px, ${spot.dy}px)` } : undefined}
    >
      {bubble && !moving && (
        <p key={bubble.key} className="kc-say">
          <span aria-hidden="true">{bubble.text}</span>
          {tip?.group && (
            <button type="button" className="kc-skip" onClick={() => kancilTipDone(tip.id, { group: true })}>
              {lines.skip}
            </button>
          )}
        </p>
      )}
      <div
        className={`kc-body${hopping ? " kc-hop" : ""}`}
        aria-hidden="true"
        onClick={() => {
          setHopping(true);
          if (tip) return kancilTipDone(tip.id); // got it: next tip, or back to the corner
          const poke = linesRef.current.poke;
          talk(poke[Math.floor(Math.random() * poke.length)]!);
        }}
        onAnimationEnd={(e) => e.animationName === "kc-hop" && setHopping(false)}
      >
        {pose === "walk" ? (
          <span className="kc-walk">
            {WALK.map((s) => (
              <img key={s} src={s} alt="" draggable={false} />
            ))}
          </span>
        ) : (
          <img key={pose} className="kc-pose" src={poseSrc(pose)} alt="" draggable={false} />
        )}
      </div>
      <button
        type="button"
        className="kc-close"
        aria-label={lines.hide}
        title={lines.hide}
        onClick={() => {
          stored("localStorage", HIDDEN_KEY, "1");
          setHidden(true);
        }}
      >
        <Icon name="x" size={12} strokeWidth={3} />
      </button>
    </div>
  );
}
