// Shared shaping for the revenue history → forecast charts.
//
// Two problems this solves, both of which bit the forecast and report charts:
//
// 1. History and forecast used to be two disjoint dataKeys, so the two area
//    paths never shared a point and the line visibly broke at the handoff.
//    Here the last observed month carries BOTH keys, so the forecast starts
//    exactly where the history ends.
// 2. Compound growth over 30 plotted months routinely spans four or five
//    orders of magnitude. On a domainless linear axis the whole history pins
//    flat against the zero gridline. `moneyAxis` fits the domain, and switches
//    to a log scale once the span makes a linear read useless.

export type ForecastPoint = {
  x: string;
  history?: number;
  forecast?: number;
};

export type ForecastSeries = {
  data: ForecastPoint[];
  values: number[];
  historyLength: number;
};

export type MoneyAxis = {
  domain: [number, number];
  scale: "linear" | "log";
  ticks: number[];
};

// Past this ratio between the smallest and largest plotted value, a linear
// axis renders the early months as a flat line on the floor.
const LOG_SPAN_THRESHOLD = 50;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Kill accumulated float noise in derived tick values (0.30000000000000004).
const clean = (n: number) => Number(n.toPrecision(12));

/**
 * Join an observed monthly series to its projection into one Recharts dataset.
 *
 * The final history month is written into `forecast` as well as `history`, so
 * the two <Area> paths share that point and meet without a visible break.
 */
export function buildForecastSeries(
  series?: readonly (number | null | undefined)[] | null,
  projection?: readonly (number | null | undefined)[] | null,
): ForecastSeries {
  const hist = (series ?? []).filter(isNum);
  const proj = (projection ?? []).filter(isNum);

  const data: ForecastPoint[] = hist.map((v, i) => ({ x: `H${i + 1}`, history: v }));

  // Anchor the forecast to the last observed month.
  if (data.length && proj.length) data[data.length - 1].forecast = hist[hist.length - 1];

  for (let i = 0; i < proj.length; i++) data.push({ x: `+${i + 1}m`, forecast: proj[i] });

  return { data, values: [...hist, ...proj], historyLength: hist.length };
}

// Rounded maxima a reader can hold in their head, each paired with a division
// count that keeps every intermediate tick clean. Kept fine-grained so a fitted
// axis actually hugs the data instead of leaving half the plot empty.
const NICE_STEPS: readonly (readonly [factor: number, divisions: number])[] = [
  [1, 4], [1.2, 4], [1.5, 3], [2, 4], [2.5, 5],
  [3, 3], [4, 4], [5, 5], [6, 3], [8, 4], [10, 5],
];

/**
 * Round a maximum up to the next clean 10^k multiple, so a fitted linear axis
 * ends on a readable number without leaving a wide empty band above the curve.
 */
export function niceCeil(n: number): number {
  if (!(n > 0) || !Number.isFinite(n)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / base;
  const step = NICE_STEPS.find(([factor]) => f <= factor + 1e-9) ?? NICE_STEPS[NICE_STEPS.length - 1];
  return clean(step[0] * base);
}

// How many even divisions read cleanly under each nice ceiling.
function divisionsFor(top: number): number {
  const f = top / Math.pow(10, Math.floor(Math.log10(top)));
  return (NICE_STEPS.find(([factor]) => Math.abs(factor - f) < 1e-9) ?? [0, 4])[1];
}

/**
 * Fit a money axis to the values actually plotted.
 *
 * Returns a linear axis anchored at zero with a `niceCeil` maximum, unless
 * every value is strictly positive AND the series spans more than 50x, in
 * which case it returns a decade-ticked log axis. Callers that switch to log
 * must say so on screen: a log axis flattens exponential growth into a
 * straight line, and an unlabelled one misreads as linear growth.
 */
export function moneyAxis(values?: readonly (number | null | undefined)[] | null): MoneyAxis {
  const v = (values ?? []).filter(isNum);
  const max = v.length ? Math.max(...v) : 0;

  if (!(max > 0)) return { domain: [0, 1], scale: "linear", ticks: [0, 1] };

  const min = Math.min(...v);

  // log(0) is undefined, so a single zero or negative reading rules log out
  // entirely, however wide the rest of the series runs.
  if (min > 0 && max / min > LOG_SPAN_THRESHOLD) {
    const loE = Math.floor(Math.log10(min));
    const hiE = Math.ceil(Math.log10(max));
    // Skip decades on very wide series so the ticks stay readable at 220px.
    const stride = hiE - loE > 6 ? 2 : 1;
    const ticks: number[] = [];
    for (let e = loE; e <= hiE; e += stride) ticks.push(clean(Math.pow(10, e)));
    const hi = clean(Math.pow(10, hiE));
    if (ticks[ticks.length - 1] !== hi) ticks.push(hi);
    return { domain: [clean(Math.pow(10, loE)), hi], scale: "log", ticks };
  }

  const top = niceCeil(max);
  const div = divisionsFor(top);
  const ticks = Array.from({ length: div + 1 }, (_, i) => clean((top * i) / div));
  return { domain: [0, top], scale: "linear", ticks };
}
