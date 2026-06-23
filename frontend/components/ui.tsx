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
  brand: "text-violet border-violet/40 bg-violet/10",
  good: "text-signal border-signal/40 bg-signal/10",
  bullish: "text-signal border-signal/40 bg-signal/10",
  warn: "text-amber border-amber/40 bg-amber/10",
  bad: "text-coral border-coral/40 bg-coral/10",
  bearish: "text-coral border-coral/40 bg-coral/10",
  neutral: "text-text-dim border-line-strong bg-surface3",
  aqua: "text-aqua border-aqua/40 bg-aqua/10",
};

const TONE_HEX: Record<string, string> = {
  default: "#8A95AA",
  good: "#C2F24A",
  warn: "#FFB13C",
  bad: "#FF5D5D",
  brand: "#7C6CFF",
  accent: "#34E1D2",
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

export function Card({ title, children, className = "", right, hover = true }: any) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} relative ${className}`}>
      <RegCross className="absolute top-2.5 right-2.5 opacity-50" />
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 mb-3.5">
          {title && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-line-strong shrink-0" />
              <div className="card-h !mb-0 truncate">{title}</div>
            </div>
          )}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Metric({ label, value, sub, tone = "default" }: any) {
  const hex = TONE_HEX[tone] || TONE_HEX.default;
  return (
    <div className="card card-hover relative overflow-hidden">
      {/* tone accent rail */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${hex}, transparent)`, opacity: 0.7 }} />
      <RegCross className="absolute top-2.5 right-2.5 opacity-50" />
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
        <div className="card-h !mb-0">{label}</div>
      </div>
      <div className={`display-stat text-[clamp(22px,2.6vw,34px)] mt-2.5 ${TEXT_TONE[tone] || TEXT_TONE.default}`}>
        <CountUp value={value} />
      </div>
      <div className="tick-ruler mt-2.5 mb-1 w-2/3" />
      {sub && <div className="text-sm text-text-dim mt-1">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "brand", dot = false }: any) {
  const hex = TONE_HEX[tone === "bullish" ? "good" : tone === "bearish" ? "bad" : tone === "neutral" ? "default" : tone] || TONE_HEX.brand;
  return (
    <span className={`pill ${PILL_TONE[tone] || PILL_TONE.brand}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />}
      {children}
    </span>
  );
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
        <circle cx="11" cy="11" r="9" fill="none" stroke="#1B1F2B" strokeWidth="2" />
        <path d="M11 2 a9 9 0 0 1 9 9" fill="none" stroke="url(#vg-load)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="label-mono">{label}</span>
      <span className="flex gap-1 items-center" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="w-1 h-1 rounded-full bg-text-mute"
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
        ))}
      </span>
    </div>
  );
}

// Skeleton placeholder grid — reserves space so content doesn't jump in.
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card !p-5">
          <div className="skeleton h-3 w-24 mb-4" />
          <div className="skeleton h-9 w-32 mb-3" />
          <div className="skeleton h-2 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="card !border-coral/50 mb-4 relative overflow-hidden" style={{ background: "var(--coral-12)" }}>
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-coral" />
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-coral" style={{ boxShadow: "0 0 8px #FF5D5D" }} />
        <div className="label-mono text-coral !mb-0">FALLBACK ENGAGED</div>
      </div>
      <div className="text-coral text-sm">{error}</div>
    </div>
  );
}

export function PageHeader({ title, desc, action, coord }: any) {
  const reduce = useReducedMotion();
  const tag = coord || title?.toString().toUpperCase();
  return (
    <div className="mb-9">
      <motion.div
        className="mb-3"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <CoordTag><span className="text-text-dim">{tag}</span></CoordTag>
      </motion.div>
      <div className="flex items-end justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          <motion.h1
            className="display-hero text-[clamp(34px,5.4vw,68px)]"
            initial={reduce ? false : { y: 24, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {title}
          </motion.h1>
          {desc && <p className="text-base text-text-dim mt-3 max-w-2xl leading-relaxed">{desc}</p>}
        </div>
        {action && <div className="flex gap-2 shrink-0">{action}</div>}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-aqua" style={{ boxShadow: "0 0 8px #34E1D2" }} />
        <div className="h-px flex-1 bg-gradient-to-r from-line-strong via-line to-transparent" />
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

// A profitable company (no monthly burn) has effectively unbounded runway. We carry it
// as a large sentinel so downstream models don't read "0 months → imminent death".
export const RUNWAY_INFINITE = 9999;

export function fmtRunway(months?: number | null) {
  const m = months ?? 0;
  return m >= RUNWAY_INFINITE ? "∞" : `${m} mo`;
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
