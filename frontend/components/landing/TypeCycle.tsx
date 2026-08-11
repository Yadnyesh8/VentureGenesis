"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Pass a module-level constant — a fresh array literal restarts the cycle every render. */
  words: string[];
  className?: string;
};

const TYPE_MS = 58;
const ERASE_MS = 24;
const HOLD_MS = 2000;
const GAP_MS = 340;

/**
 * Types a rotating set of phrases.
 *
 * The first phrase is rendered in full during SSR and is never removed from the
 * DOM, so the headline reads correctly before hydration, with JavaScript off, and
 * under prefers-reduced-motion. Nothing here gates the existence of text on an
 * animation — the motion only ever rewrites a line that is already on screen.
 *
 * A hidden sizer holding the longest phrase reserves the line's width, so the
 * headline never reflows character by character as the word is typed.
 */
export default function TypeCycle({ words, className = "" }: Props) {
  const [text, setText] = useState(words[0]);
  const [resting, setResting] = useState(true);
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), words[0]);

  useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let word = 0;
    let count = words[0].length;
    let phase: "hold" | "erase" | "type" = "hold";

    const next = (ms: number) => {
      timer = setTimeout(run, ms);
    };

    const run = () => {
      if (!alive) return;

      if (phase === "hold") {
        phase = "erase";
        setResting(false);
        next(ERASE_MS);
        return;
      }

      if (phase === "erase") {
        count -= 1;
        setText(words[word].slice(0, Math.max(0, count)));
        if (count <= 0) {
          word = (word + 1) % words.length;
          phase = "type";
          next(GAP_MS);
        } else {
          next(ERASE_MS);
        }
        return;
      }

      count += 1;
      setText(words[word].slice(0, count));
      if (count >= words[word].length) {
        phase = "hold";
        setResting(true);
        next(HOLD_MS);
      } else {
        next(TYPE_MS);
      }
    };

    next(HOLD_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [words]);

  return (
    <span className={`inline-grid ${className}`}>
      {/* Width reservation only — the real line is the grid cell below it. */}
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      <span className="col-start-1 row-start-1 text-left">
        {text}
        <Caret resting={resting} />
      </span>
    </span>
  );
}

/**
 * The caret holds steady while letters are moving and blinks only once the word
 * has settled, so the blink reads as "waiting" rather than as decoration.
 */
function Caret({ resting }: { resting: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={el}
      aria-hidden
      className="ml-[0.07em] inline-block h-[0.68em] w-[0.05em] translate-y-[0.02em] rounded-full bg-text-faint align-baseline"
      style={{ animation: resting ? "vg-caret 1.1s steps(1, end) infinite" : "none" }}
    />
  );
}
