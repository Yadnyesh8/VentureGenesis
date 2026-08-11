"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmtMoney, fmtPct, fmtRunway, useAgent, Metric, RUNWAY_INFINITE } from "@/components/ui";
import ModuleCard, { type Module, type Verdict } from "@/components/ModuleCard";
import UnderstandingPanel from "@/components/UnderstandingPanel";
import type { Visual } from "@/components/CardVisual";

const FAMILIES = ["All", "Models", "Agents", "Frontier", "Workspace"] as const;
type Family = (typeof FAMILIES)[number];

type SortKey = "priority" | "az" | "status";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "az", label: "A–Z" },
  { value: "status", label: "Status" },
];

// Ranking used by "Priority": anything demanding attention floats up.
const TONE_RANK: Record<Verdict["tone"], number> = { bad: 0, warn: 1, good: 2, info: 3, idle: 4 };

const PINS_KEY = "vg-pinned-modules";

// Stable identity so the "not yet loaded" case doesn't invalidate the memo below
// on every render.
const NO_PINS: string[] = [];

/** Pull a numeric series out of a forecast payload without assuming one shape. */
function extractSeries(payload: any): number[] | null {
  const d = payload?.data ?? payload;
  if (!d) return null;
  for (const key of ["forecast", "predictions", "yhat", "series", "values", "revenue_forecast"]) {
    const v = d[key];
    if (Array.isArray(v) && v.length > 1) {
      const nums = v
        .map((x: any) => (typeof x === "number" ? x : x?.yhat ?? x?.value ?? x?.revenue))
        .filter((x: any) => typeof x === "number" && isFinite(x));
      if (nums.length > 1) return nums.slice(0, 24);
    }
  }
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const { ref, metrics, hydrated, ready, board } = useStore();

  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family>("All");
  const [sort, setSort] = useState<SortKey>("priority");
  // null until read from storage, so the persist effect can't clobber saved pins
  // with an empty array on the first render.
  const [pinned, setPinned] = useState<string[] | null>(null);

  // First-run users land here with no profile — send them to onboarding so the
  // post-login path is sign-in → onboarding → board, never a blank dashboard.
  useEffect(() => {
    if (hydrated && !ready) router.replace("/onboarding");
  }, [hydrated, ready, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setPinned(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPinned([]);
    }
  }, []);

  useEffect(() => {
    if (pinned === null) return;
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(pinned));
    } catch {
      /* private mode — pins just won't persist */
    }
  }, [pinned]);

  const pins = pinned ?? NO_PINS;

  function togglePin(href: string) {
    setPinned((prev) => {
      const list = prev ?? [];
      return list.includes(href) ? list.filter((h) => h !== href) : [...list, href];
    });
  }

  const r = ref();
  const key = JSON.stringify(r);
  const health = useAgent(() => api.health(r), [key], "health");
  const failure = useAgent(() => api.failure(r), [key], "failure");
  const funding = useAgent(() => api.funding(r), [key], "funding");
  const forecast = useAgent(() => api.forecast(r), [key], "forecast");

  const hs = health.data?.data?.health_score ?? null;
  const f12 = failure.data?.data?.failure_12m ?? null;
  const fp = funding.data?.data?.funding_probability ?? null;
  const series = extractSeries(forecast.data);

  const boardDone = board.steps.filter((s) => s.status === "done").length;
  const boardTotal = board.steps.length;

  // Cash depletion is the founder's own arithmetic: runway months × monthly burn,
  // drawn down to zero. Nothing here is modelled or invented.
  const runwaySeries = useMemo(() => {
    const months = metrics.runway ?? 0;
    const burn = metrics.burn_rate ?? 0;
    if (!burn || months <= 0 || months >= RUNWAY_INFINITE) return null;
    const n = Math.min(Math.round(months), 24);
    if (n < 2) return null;
    const cash = months * burn;
    return Array.from({ length: n + 1 }, (_, i) => Math.max(0, cash - i * burn));
  }, [metrics.runway, metrics.burn_rate]);

  const hasIdea = Boolean((metrics.description || "").trim());

  const modules: Module[] = useMemo(() => {
    const idle = (glyph: any, label: string): Visual => ({ kind: "glyph", glyph, label });

    const healthVerdict: Verdict =
      hs == null ? { label: "Computing", tone: "idle" }
        : hs >= 65 ? { label: "Healthy", tone: "good" }
        : hs >= 45 ? { label: "Watch", tone: "warn" }
        : { label: "At risk", tone: "bad" };

    const failVerdict: Verdict =
      f12 == null ? { label: "Computing", tone: "idle" }
        : f12 < 0.35 ? { label: "Low risk", tone: "good" }
        : f12 < 0.6 ? { label: "Elevated", tone: "warn" }
        : { label: "High risk", tone: "bad" };

    const fundVerdict: Verdict =
      fp == null ? { label: "Computing", tone: "idle" }
        : fp >= 0.5 ? { label: "Ready", tone: "good" }
        : fp >= 0.3 ? { label: "Developing", tone: "warn" }
        : { label: "Early", tone: "bad" };

    const runwayMonths = metrics.runway ?? 0;
    const runwayVerdict: Verdict =
      !runwaySeries ? { label: "Not run", tone: "idle" }
        : runwayMonths >= 12 ? { label: "12 mo+", tone: "good" }
        : runwayMonths >= 6 ? { label: "Under 12 mo", tone: "warn" }
        : { label: "Under 6 mo", tone: "bad" };

    return [
      {
        href: "/health",
        title: "Health Score",
        blurb: "A weighted composite across burn, churn, growth and funding position.",
        engine: "Composite",
        family: "Models",
        verdict: healthVerdict,
        reading: hs == null ? "—" : `${Math.round(hs)} / 100`,
        visual: hs == null
          ? idle("field", "Awaiting computation")
          : { kind: "ring", value: hs, max: 100, label: "Health / 100", tone: hs >= 65 ? "var(--signal)" : hs >= 45 ? "var(--amber)" : "var(--coral)" },
      },
      {
        href: "/failure",
        title: "Failure Prediction",
        blurb: "Twelve-month failure probability from a gradient-boosted model, with SHAP attribution.",
        engine: "Gradient boosting",
        family: "Models",
        verdict: failVerdict,
        reading: f12 == null ? "—" : fmtPct(f12),
        visual: f12 == null
          ? idle("horizon", "Awaiting computation")
          : { kind: "band", value: f12, thresholds: [0.35, 0.6], label: "12-month failure probability", tone: f12 < 0.35 ? "var(--signal)" : f12 < 0.6 ? "var(--amber)" : "var(--coral)" },
      },
      {
        href: "/forecast",
        title: "Revenue Forecast",
        blurb: "A Prophet time-series projection of revenue over the coming periods.",
        engine: "Prophet",
        family: "Models",
        verdict: series ? { label: "Projected", tone: "info" } : { label: "Computing", tone: "idle" },
        reading: series ? fmtMoney(series[series.length - 1]) : "—",
        visual: series
          ? { kind: "area", series, label: "Projected revenue", tone: "var(--aqua)" }
          : idle("horizon", "Awaiting computation"),
      },
      {
        href: "/funding",
        title: "Funding Readiness",
        blurb: "A calibrated classifier scoring how investor-ready the current position is.",
        engine: "Classifier",
        family: "Models",
        verdict: fundVerdict,
        reading: fp == null ? "—" : fmtPct(fp),
        visual: fp == null
          ? idle("field", "Awaiting computation")
          : { kind: "ring", value: fp * 100, max: 100, label: "Readiness", tone: fp >= 0.5 ? "var(--signal)" : fp >= 0.3 ? "var(--amber)" : "var(--coral)" },
      },
      {
        href: "/board",
        title: "Board of Directors",
        blurb: "Chairperson, investor, strategist, risk analyst and scout debate to a decision.",
        engine: "Multi-agent",
        family: "Agents",
        verdict: board.ran ? { label: "Complete", tone: "info" } : boardTotal > 0 ? { label: "Running", tone: "warn" } : { label: "Not run", tone: "idle" },
        reading: boardTotal > 0 ? `${boardDone} / ${boardTotal}` : "—",
        visual: boardTotal > 0
          ? { kind: "pipeline", done: boardDone, total: boardTotal, label: "Agents completed", tone: "var(--aqua)" }
          : idle("council", "Convene to run"),
      },
      {
        href: "/idea",
        title: "Idea Diligence",
        blurb: "Checks the idea itself: what already exists like it, and whether it holds up.",
        engine: "Analyse / review loop",
        family: "Agents",
        verdict: hasIdea ? { label: "Ready to run", tone: "info" } : { label: "Needs your idea", tone: "idle" },
        reading: "—",
        visual: idle("prism", hasIdea ? "Open to run" : "Add an idea summary"),
      },
      {
        href: "/competitor",
        title: "Competitor Intelligence",
        blurb: "Maps the competitive set and where this position is defensible.",
        engine: "Reasoning agent",
        family: "Agents",
        verdict: { label: "Not run", tone: "idle" },
        reading: "—",
        visual: idle("compass", "Open to run"),
      },
      {
        href: "/market",
        title: "Market Opportunity",
        blurb: "Sizes the reachable market and the segments worth pursuing first.",
        engine: "Reasoning agent",
        family: "Agents",
        verdict: { label: "Not run", tone: "idle" },
        reading: "—",
        visual: idle("field", "Open to run"),
      },
      {
        href: "/simulation",
        title: "Digital Twin",
        blurb: "Monte Carlo stress tests across burn changes and runway scenarios.",
        engine: "Simulation",
        family: "Workspace",
        verdict: runwayVerdict,
        reading: fmtRunway(metrics.runway),
        visual: runwaySeries
          ? { kind: "area", series: runwaySeries, label: "Cash drawn down at current burn", tone: "var(--amber)" }
          : idle("twin", "Open to run"),
      },
      {
        href: "/report",
        title: "Executive Report",
        blurb: "Synthesises every output above into a single board memo.",
        engine: "Document",
        family: "Workspace",
        verdict: { label: "On demand", tone: "idle" },
        reading: "—",
        visual: idle("doc", "Generate on open"),
      },
      {
        href: "/uncertainty",
        title: "Epistemic Uncertainty",
        blurb: "Ranks what you don't know by what it would be worth to find out.",
        engine: "Value of information",
        family: "Frontier",
        verdict: { label: "Not run", tone: "idle" },
        reading: "—",
        visual: idle("horizon", "Open to run"),
      },
      {
        href: "/agi",
        title: "AGI Pre-Conditioner",
        blurb: "Scores disruption exposure across capability milestones and proposes redesigns.",
        engine: "Stress test",
        family: "Frontier",
        verdict: { label: "Not run", tone: "idle" },
        reading: "—",
        visual: idle("horizon", "Open to run"),
      },
      {
        href: "/spinout",
        title: "Spin-out Viability",
        blurb: "Expected value of separating an internal project from its parent.",
        engine: "Expected value",
        family: "Frontier",
        verdict: { label: "Not run", tone: "idle" },
        reading: "—",
        visual: idle("split", "Open to run"),
      },
    ];
  }, [hs, f12, fp, series, board.ran, boardDone, boardTotal, metrics.runway, runwaySeries, hasIdea]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = modules.filter((m) => {
      const inFamily = family === "All" || m.family === family;
      const inQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.blurb.toLowerCase().includes(q) ||
        m.engine.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q);
      return inFamily && inQuery;
    });

    list = [...list].sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "status") return TONE_RANK[a.verdict.tone] - TONE_RANK[b.verdict.tone];
      // priority: attention first, then the natural order above
      const d = TONE_RANK[a.verdict.tone] - TONE_RANK[b.verdict.tone];
      if (d !== 0) return d;
      return modules.indexOf(a) - modules.indexOf(b);
    });

    // Pinned modules always lead, keeping their relative order.
    const isPinned = (m: Module) => pins.includes(m.href);
    return [...list.filter(isPinned), ...list.filter((m) => !isPinned(m))];
  }, [modules, query, family, sort, pins]);

  if (!hydrated || !ready) return null; // redirecting first-run users to onboarding

  const counts: Record<string, number> = { All: modules.length };
  for (const m of modules) counts[m.family] = (counts[m.family] || 0) + 1;

  return (
    <div>
      {/* Heading */}
      <h1 className="display-hero text-[clamp(28px,4vw,40px)]">{metrics.startup_name || "Your board"}</h1>
      <p className="mt-2.5 text-[17px] text-text-mute">
        Every figure is computed from your questionnaire. Nothing is invented.
      </p>

      {/* Headline readings */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Health score"
          value={hs == null ? "—" : `${Math.round(hs)}`}
          tone={hs == null ? "default" : hs >= 65 ? "good" : hs >= 45 ? "warn" : "bad"}
          sub="0–100 composite"
        />
        <Metric
          label="12-month failure risk"
          value={f12 == null ? "—" : fmtPct(f12)}
          tone={f12 == null ? "default" : f12 < 0.35 ? "good" : f12 < 0.6 ? "warn" : "bad"}
          sub="Calibrated model"
        />
        <Metric
          label="Funding probability"
          value={fp == null ? "—" : fmtPct(fp)}
          tone={fp == null ? "default" : fp >= 0.5 ? "good" : "warn"}
          sub="Readiness score"
        />
        <Metric
          label="Runway"
          value={fmtRunway(metrics.runway)}
          tone={(metrics.runway ?? 0) >= 9 ? "good" : "bad"}
          sub="Cash ÷ burn"
        />
      </div>

      {/* Classifier — on demand, not part of the board run */}
      <UnderstandingPanel r={r} cacheKey={key} />

      {/* Search */}
      <div className="relative mt-8 max-w-2xl">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-faint">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
            <path d="M13.5 13.5 L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the board…"
          aria-label="Search modules"
          className="search-field"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-text-faint transition-colors hover:bg-surface2 hover:text-text"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Family filter */}
      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {FAMILIES.map((f) => (
          <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)} className="chip">
            {f}
            <span className="text-xs opacity-60">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="vg-sort" className="text-sm text-text-mute">
          Sort by
        </label>
        <div className="relative">
          <select
            id="vg-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer appearance-none rounded-full border border-line bg-surface3 py-2.5 pl-4 pr-9 text-sm text-text transition-colors hover:border-line-strong focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-mute">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="mb-5 mt-9">
        <h2 className="section-h">Your board</h2>
      </div>

      {visible.length > 0 ? (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <ModuleCard key={m.href} module={m} pinned={pins.includes(m.href)} onTogglePin={togglePin} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <p className="text-[17px] font-semibold text-text">Nothing matches “{query}”</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-mute">
            Try a different term, or clear the filters to see all {modules.length} modules.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFamily("All");
            }}
            className="btn-ghost mt-5"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
