"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  to: number;
  /** Rendered after the number, one tonal step down. */
  suffix?: string;
  className?: string;
  suffixClassName?: string;
};

const DURATION = 1600;

// useLayoutEffect writes the starting value before the browser paints, so the
// final number never flashes on screen ahead of the climb. On the server the
// layout variant would warn, so fall back there.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Counts up to a figure when it scrolls into view.
 *
 * The final value is what renders on the server and what stays on screen if
 * JavaScript never runs or motion is reduced — the number is never gated on the
 * animation. The climb is applied on top of an element that is already painted.
 */
export default function CountUp({ to, suffix, className = "", suffixClassName = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let started = false;

    const climb = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION);
        // easeOutQuart — quick off the line, long settle onto the real figure.
        setN(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) raf = requestAnimationFrame(step);
        else setN(to);
      };
      raf = requestAnimationFrame(step);
    };

    setN(0);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            climb();
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {n.toLocaleString("en-US")}
      {suffix ? <span className={suffixClassName}>{suffix}</span> : null}
    </span>
  );
}
