"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useLang } from "@/lib/i18n";
import { KANCIL_LINES, useKancilMood, type KancilMood } from "@/lib/kancil";

/**
 * Kancil, the mouse-deer in the bottom corner. It walks in on the first visit of a session and waves, walks along
 * while the page scrolls, catches files dragged over the page, shows what pages set with useKancil (digging while a
 * request runs, cheering when the brief is ready, worried on errors) and falls asleep after a minute of nothing.
 * Decorative: hidden from screen readers (pages already announce their status), and it can be hidden for good.
 * Styles in app/kancil.css, poses in public/mascot/.
 */

type Pose = "front" | "side" | "walk" | "sleep" | KancilMood;

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
const DIG_LINE_MS = 8000;
const SLEEP_AFTER_MS = 60_000;
const HIDDEN_KEY = "bizdecide:kancil-hidden";
const GREETED_KEY = "bizdecide:kancil-greeted";

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

export function Kancil() {
  const lines = KANCIL_LINES[useLang()];
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const pageMood = useKancilMood();
  const pageMoodRef = useRef(pageMood);
  pageMoodRef.current = pageMood;
  const reduced = useReducedMotion();

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
  const talk = useCallback((text: string) => setSay({ text, at: Date.now() }), []);

  useEffect(() => {
    setHidden(stored("localStorage", HIDDEN_KEY) === "1");
    setReady(true);
  }, []);
  const on = ready && !hidden;

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

  const mood = pageMood && !(MOMENT_MS[pageMood] && settled) ? pageMood : null;
  const pose: Pose = entering
    ? "walk"
    : dragging
      ? "catch"
      : (mood ?? (greeting ? "wave" : asleep ? "sleep" : walking ? (reduced ? "side" : "walk") : "front"));

  // Say what is going on when the pose changes; while digging, a new line every few seconds.
  useEffect(() => {
    if (!on) return;
    const l = linesRef.current;
    const line = { catch: l.catch, read: l.read, peek: l.peek, cheer: l.cheer, worried: l.worried }[pose as string];
    if (line) talk(line);
    if (pose !== "dig") return;
    let turn = 0;
    const next = () => talk(l.dig[turn++ % l.dig.length]!);
    next();
    const id = setInterval(next, DIG_LINE_MS);
    return () => clearInterval(id);
  }, [on, pose, talk]);

  useEffect(() => {
    if (!say) return;
    const id = setTimeout(() => setSay(null), SAY_MS);
    return () => clearTimeout(id);
  }, [say]);

  if (!on) return null;

  return (
    <div className="kc no-print" data-pose={pose} data-face={face} data-enter={entering || undefined}>
      {say && (
        <p key={say.at} className="kc-say" aria-hidden="true">
          {say.text}
        </p>
      )}
      <div
        className={`kc-body${hopping ? " kc-hop" : ""}`}
        aria-hidden="true"
        onClick={() => {
          setHopping(true);
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
