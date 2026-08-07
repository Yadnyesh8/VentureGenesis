// Chart palette. One disciplined family shared with the interface: a blue
// reference, a green positive, an orange watch, a red negative, and a neutral
// grey. Values read from CSS variables at call time so charts follow the theme.

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export const CHART = {
  series: ["#60a5fa", "#22c55e", "#f97316", "#ef4444", "#a3a3a3"],
  violet: "#60a5fa", // retired hue → info blue
  aqua: "#60a5fa",
  good: "#22c55e",
  warn: "#f97316",
  bad: "#ef4444",
  magenta: "#a3a3a3",
  grid: "#292929",
  axis: "#a3a3a3",
  track: "#1f1f1f",
  tooltipBg: "#171717",
  text: "#e8e8e8",
};

// Live (theme-aware) reads for canvas/SVG drawn at runtime.
export const chartColors = () => ({
  grid: cssVar("--line", CHART.grid),
  axis: cssVar("--text-mute", CHART.axis),
  track: cssVar("--surface-3", CHART.track),
  tooltipBg: cssVar("--surface-2", CHART.tooltipBg),
  text: cssVar("--text", CHART.text),
  good: cssVar("--signal", CHART.good),
  warn: cssVar("--amber", CHART.warn),
  bad: cssVar("--coral", CHART.bad),
  info: cssVar("--aqua", CHART.aqua),
});

// Grade a score into the fixed meaning scale.
export function gradeColor(score: number): string {
  if (score >= 75) return CHART.good;
  if (score >= 45) return CHART.aqua;
  return CHART.bad;
}

export function riskColor(p: number): string {
  if (p < 0.35) return CHART.good;
  if (p < 0.6) return CHART.warn;
  return CHART.bad;
}

export const axisProps = {
  stroke: CHART.axis,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
  style: { fontFamily: "var(--font-sans)" },
} as const;

export const ANIM = {
  isAnimationActive: true as const,
  animationEasing: "ease-out" as const,
  animationDuration: 700,
};
