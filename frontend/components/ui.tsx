"use client";
import React from "react";
import { motion, animate, useReducedMotion } from "framer-motion";
import { RegCross, CoordTag, TraceGlyph } from "./instrument";
import { useStore } from "@/lib/store";

const EASE = [0.16, 1, 0.3, 1] as const;

// ---- tone maps ----
const TEXT_TONE: Record<string, string> = {
  default: "text-text",
  good: "text-signal",
  warn: "text-amber",
  bad: "text-coral",
  brand: "text-violet",
  accent: "text-aqua",
};

const PILL_TONE: Record<string, string> = {
  brand: "text-violet border-violet bg-violet/10",
  good: "text-signal border-signal bg-signal/10",
  bullish: "text-signal border-signal bg-signal/10",
  warn: "text-amber border-amber bg-amber/10",
  bad: "text-coral border-coral bg-coral/10",
  bearish: "text-coral border-coral bg-coral/10",
  neutral: "text-text-dim border-line-strong bg-surface2",
  aqua: "text-aqua border-aqua bg-aqua/10",
};

// ---- Count-up: animates the numeric portion of any value (kinetic signature) ----
export function CountUp({ value, className = "" }: { value: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const str = typeof value === "number" ? String(value) : String(value ?? "");
  const match = str.match(/-?[\d,]*\.?\d+/);
  const [shown, setShown] = React.useState(reduce ? str : null as string | null);

  React.useEffect(() => {
    if (reduce || !match) {
      setShown(str);
      return;
    }
    const raw = match[0];
    const target = parseFloat(raw.replace(/,/g, ""));
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const hasComma = raw.includes(",");
    const prefix = str.slice(0, match.index);
    const suffix = str.slice((match.index || 0) + raw.length);
    const controls = animate(0, target, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate(v) {
        const formatted = hasComma
          ? v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
          : v.toFixed(decimals);
        setShown(prefix + formatted + suffix);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [str]);

  return <span className={className}>{shown ?? str}</span>;
}

export function Card({ title, children, className = "", right }: any) {
  return (
    <div className={`card card-hover relative ${className}`}>
      <RegCross className="absolute top-2 right-2 opacity-60" />
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <div className="card-h !mb-0">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Metric({ label, value, sub, tone = "default" }: any) {
  return (
    <div className="card card-hover relative">
      <RegCross className="absolute top-2 right-2 opacity-50" />
      <div className="card-h">{label}</div>
      <div className={`display-stat text-[clamp(20px,2.5vw,32px)] ${TEXT_TONE[tone] || TEXT_TONE.default}`}>
        <CountUp value={value} />
      </div>
      <div className="tick-ruler mt-2 mb-1 w-2/3" />
      {sub && <div className="text-sm text-text-dim mt-1">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "brand" }: any) {
  return <span className={`pill ${PILL_TONE[tone] || PILL_TONE.brand}`}>{children}</span>;
}

export function Loading({ label = "RUNNING AGENTS" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8">
      <svg width="22" height="22" viewBox="0 0 22 22" className="[animation:sweep_1s_linear_infinite]">
        <defs>
          <linearGradient id="vg-load" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C6CFF" />
            <stop offset="100%" stopColor="#34E1D2" />
          </linearGradient>
        </defs>
        <circle cx="11" cy="11" r="9" fill="none" stroke="#1A1E29" strokeWidth="2" />
        <path d="M11 2 a9 9 0 0 1 9 9" fill="none" stroke="url(#vg-load)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="label-mono">{label}…</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="card !border-coral/50 mb-4" style={{ background: "var(--coral-12)" }}>
      <div className="label-mono text-coral mb-1">FALLBACK ENGAGED</div>
      <div className="text-coral text-sm">{error}</div>
    </div>
  );
}

let _moduleSeq = 0;
export function PageHeader({ title, desc, action, coord }: any) {
  const reduce = useReducedMotion();
  const tag = coord || title?.toString().toUpperCase();
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <motion.h1
            className="display-hero text-[clamp(32px,5vw,64px)]"
            initial={reduce ? false : { y: 24, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {title}
          </motion.h1>
          {desc && <p className="text-base text-text-dim mt-2 max-w-2xl">{desc}</p>}
        </div>
        {action && <div className="flex gap-2 shrink-0">{action}</div>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <CoordTag><span className="text-text-dim">{tag}</span></CoordTag>
        <div className="h-px flex-1 bg-line" />
        <TraceGlyph size={16} />
      </div>
    </div>
  );
}

export function fmtMoney(n: number) {
  if (n == null || isNaN(n as any)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtPct(n: number) {
  if (n == null || isNaN(n as any)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

// Cache-aware agent runner. When `cacheKey` is supplied, results pre-loaded by the
// launching screen (or a prior visit) are read from the shared store and rendered
// instantly — no refetch. Without a key it behaves as a plain on-mount fetcher.
export function useAgent<T = any>(fn: () => Promise<T>, deps: any[] = [], cacheKey?: string) {
  const { cache, setCache } = useStore();
  const cached = cacheKey ? (cache[cacheKey] as T | undefined) : undefined;
  const [data, setData] = React.useState<T | null>(cached ?? null);
  const [loading, setLoading] = React.useState(cacheKey ? !cached : true);
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { setData(d); if (cacheKey) setCache(cacheKey, d); })
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => {
    if (cacheKey && cache[cacheKey]) {
      setData(cache[cacheKey]);
      setLoading(false);
      setError(null);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, cacheKey ? cache[cacheKey] : undefined]);
  return { data, loading, error, refetch: run };
}
