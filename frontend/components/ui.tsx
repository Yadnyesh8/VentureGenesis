"use client";
import React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";

// ---- tone maps ----------------------------------------------------------
// Fixed meaning, one family. Emphasis is a value shift, not a sprayed-on colour.
const TEXT_TONE: Record<string, string> = {
  default: "text-text",
  good: "text-signal",
  warn: "text-amber",
  bad: "text-coral",
  brand: "text-aqua",
  accent: "text-aqua",
};

// Solid fills carry white text; neutral stays a quiet outline.
const PILL_TONE: Record<string, string> = {
  brand: "bg-aqua text-white",
  accent: "bg-aqua text-white",
  aqua: "bg-aqua text-white",
  good: "bg-signal text-white",
  bullish: "bg-signal text-white",
  warn: "bg-amber text-white",
  bad: "bg-coral text-white",
  bearish: "bg-coral text-white",
  neutral: "border-line bg-surface3 text-text-dim",
};

const TONE_HEX: Record<string, string> = {
  default: "var(--text-mute)",
  good: "var(--signal)",
  warn: "var(--amber)",
  bad: "var(--coral)",
  brand: "var(--aqua)",
  accent: "var(--aqua)",
};

// ---- Count-up -----------------------------------------------------------
// The true value renders on the first frame; the animation only replays the
// approach to it. If JS never runs, the real number is already on screen.
export function CountUp({ value, className = "" }: { value: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const str = typeof value === "number" ? String(value) : String(value ?? "");
  const match = str.match(/-?[\d,]*\.?\d+/);
  const [shown, setShown] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (reduce || !match) {
      setShown(str);
      return;
    }
    const raw = match[0];
    const target = parseFloat(raw.replace(/,/g, ""));
    if (!isFinite(target)) {
      setShown(str);
      return;
    }
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const hasComma = raw.includes(",");
    const prefix = str.slice(0, match.index);
    const suffix = str.slice((match.index || 0) + raw.length);
    const controls = animate(0, target, {
      duration: 0.7,
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
  }, [str, reduce]);

  return <span className={className}>{shown ?? str}</span>;
}

// ---- Card ---------------------------------------------------------------
export function Card({ title, children, className = "", right, hover = false }: any) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="card-h !mb-0 min-w-0 truncate">{title}</h2> : <span />}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ---- Metric -------------------------------------------------------------
// A quiet label, the figure at real scale, one line of context. The tone lives
// in the value's colour only.
export function Metric({ label, value, sub, tone = "default" }: any) {
  return (
    <div className="card">
      <div className="text-sm text-text-mute">{label}</div>
      <div className={`stat mt-2 ${TEXT_TONE[tone] || TEXT_TONE.default}`}>
        <CountUp value={value} />
      </div>
      {sub && <div className="mt-1.5 text-xs text-text-faint">{sub}</div>}
    </div>
  );
}

// ---- Model confidence ---------------------------------------------------
const CONF_LABELS: Record<string, string> = {
  discrimination: "Discrimination (AUC)",
  calibration: "Calibration (Brier)",
  stability: "CV stability",
  input_completeness: "Input completeness",
};

export function ConfidenceMeter({ confidence, components }: { confidence?: number | null; components?: Record<string, number> }) {
  if (confidence == null) return null;
  const tone = confidence >= 80 ? "good" : confidence >= 60 ? "accent" : confidence >= 45 ? "warn" : "bad";
  const hex = TONE_HEX[tone] || TONE_HEX.default;
  const comps = components || {};
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="card-h !mb-0">Model confidence</h2>
        <div className={`stat !text-[28px] ${TEXT_TONE[tone]}`}>
          <CountUp value={`${confidence}%`} />
        </div>
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {Object.entries(comps).map(([k, v]) => (
          <div key={k}>
            <div className="mb-1.5 flex justify-between text-xs text-text-mute">
              <span>{CONF_LABELS[k] || k}</span>
              <span className="tabular-nums text-text-dim">{Math.round((v as number) * 100)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, (v as number) * 100))}%`, background: hex }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-faint">
        How much to trust the prediction above — not the prediction itself.
      </p>
    </div>
  );
}

// ---- Pill ---------------------------------------------------------------
export function Pill({ children, tone = "neutral", dot = false }: any) {
  const solid = tone !== "neutral";
  return (
    <span className={`pill ${PILL_TONE[tone] || PILL_TONE.neutral}`}>
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: solid ? "currentColor" : "var(--text-mute)" }}
        />
      )}
      {children}
    </span>
  );
}

// ---- Loading ------------------------------------------------------------
export function Loading({ label = "Running agents" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8" role="status" aria-live="polite">
      <svg width="18" height="18" viewBox="0 0 18 18" className="[animation:sweep_0.9s_linear_infinite]" aria-hidden>
        <circle cx="9" cy="9" r="7" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M9 2 a7 7 0 0 1 7 7" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm text-text-mute">{label}</span>
    </div>
  );
}

// Reserves the real card footprint so nothing jumps when data lands.
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-3 h-8 w-32" />
          <div className="skeleton mt-3 h-2 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-coral/40 p-4" style={{ background: "var(--coral-12)" }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-coral" />
        <span className="text-sm font-semibold text-coral">Fallback engaged</span>
      </div>
      <p className="text-sm text-text-dim">{error}</p>
    </div>
  );
}

// ---- Page header --------------------------------------------------------
// `coord` is still accepted so no existing page breaks, but it is intentionally
// not rendered: it was decorative, and the title carries the page on its own.
export function PageHeader({ title, desc, action }: any) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-hero text-[clamp(28px,4vw,40px)]">{title}</h1>
          {desc && <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-text-mute">{desc}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </header>
  );
}

// ---- formatting ---------------------------------------------------------
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

// ---- agent runner -------------------------------------------------------
/**
 * `enabled: false` holds the request entirely. Hooks can't sit behind an early
 * return, so a page that decides "there is nothing to ask for" still reaches
 * this call — without the gate it would fire the agent anyway and surface the
 * rejection as an error.
 */
export function useAgent<T = any>(
  fn: () => Promise<T>,
  deps: any[] = [],
  cacheKey?: string,
  opts?: { enabled?: boolean }
) {
  const enabled = opts?.enabled ?? true;
  const { cache, setCache } = useStore();
  const cached = cacheKey ? (cache[cacheKey] as T | undefined) : undefined;
  const [data, setData] = React.useState<T | null>(cached ?? null);
  const [loading, setLoading] = React.useState(enabled ? (cacheKey ? !cached : true) : false);
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
    // Cache is checked before the gate: a run that already happened should show
    // its result even when the agent is not allowed to start a new one.
    if (cacheKey && cache[cacheKey]) {
      setData(cache[cacheKey]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!enabled) {
      setLoading(false);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, enabled, cacheKey ? cache[cacheKey] : undefined]);
  return { data, loading, error, refetch: run };
}
