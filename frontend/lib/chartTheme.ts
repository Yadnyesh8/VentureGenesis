// Centralized Kinetic Instrument chart palette + shared Recharts config.

export const CHART = {
  series: ["#7C6CFF", "#34E1D2", "#C2F24A", "#FF4FA3", "#FFB13C"], // violet, aqua, lime, magenta, amber
  violet: "#7C6CFF",
  aqua: "#34E1D2",
  good: "#C2F24A",
  warn: "#FFB13C",
  bad: "#FF5D5D",
  magenta: "#FF4FA3",
  grid: "#232838",
  axis: "#8A95AA", // mono-tick slate
  track: "#1B1F2B",
  tooltipBg: "#181C27",
  text: "#F4F6FB",
};

// Grade an arc/score color the instrument way.
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

// Shared axis props (no axis lines, mono ticks).
export const axisProps = {
  stroke: CHART.axis,
  fontSize: 14,
  tickLine: false,
  axisLine: false,
  style: { fontFamily: "var(--font-sans)", letterSpacing: "0.06em" },
} as const;

export const ANIM = {
  isAnimationActive: true as const,
  animationEasing: "ease-out" as const,
  animationDuration: 900,
};
