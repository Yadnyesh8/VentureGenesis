"use client";
import React from "react";

/**
 * The media block that sits at the top of every feed card.
 *
 * Where a module has actually been computed, this draws its real value. Where it
 * has not, it draws a pictogram and says so — it never invents a number to fill
 * the frame.
 *
 * House style for the marks: built on a 24-unit grid, 1.75 stroke, round caps,
 * and every path terminates in a small filled node. That terminal node is the
 * one invented detail shared across the whole set.
 */

const VB_W = 320;
const VB_H = 180;

// Two bands of the frame are spoken for by elements layered above the SVG: the
// pin button (top-right) and the badge row (bottom). Everything drawn here stays
// between them, so no reading is ever clipped or overlapped.
const SAFE_TOP = 46;
const SAFE_BOTTOM = 132;
const CAPTION_Y = 124;

export type Visual =
  | { kind: "ring"; value: number; max?: number; label: string; tone: string }
  | { kind: "band"; value: number; thresholds: [number, number]; label: string; tone: string }
  | { kind: "area"; series: number[]; label: string; tone: string }
  | { kind: "pipeline"; done: number; total: number; label: string; tone: string }
  | { kind: "glyph"; glyph: GlyphName; label: string };

export type GlyphName = "compass" | "field" | "twin" | "doc" | "horizon" | "split" | "council";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// Shared caption, sitting on the one baseline that clears the badge row.
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <text
      x={VB_W / 2}
      y={CAPTION_Y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="var(--text-mute)"
      style={{ fontSize: 11 }}
    >
      {children}
    </text>
  );
}

/* ---- Ring: a score as a fraction of its ring. ---------------------------
   Drawn as a dashed circle rotated to start at 12 o'clock, so the geometry is
   exact and the label sits on the true centre of the shape. The ring occupies
   the middle column only, which is clear of both badges. */
function Ring({ value, max = 100, label, tone }: { value: number; max?: number; label: string; tone: string }) {
  const cx = VB_W / 2;
  const cy = 88;
  const r = 46;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));

  return (
    <Frame>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-strong)" strokeWidth="8" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${pct * C} ${C}`}
        />
      </g>
      {/* The numeral and its label are centred as ONE block on the ring's true
          centre: the numeral's cap height reaches ~12 units above its baseline
          while the label only reaches ~4 below, so the pair is lifted by the
          difference rather than each being centred on cy independently. */}
      <text
        x={cx}
        y={cy - 9}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text)"
        style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(value)}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-mute)"
        style={{ fontSize: 11 }}
      >
        {label}
      </text>
    </Frame>
  );
}

/* ---- Band: a probability placed on its own threshold scale. -------------- */
function Band({ value, thresholds, label, tone }: { value: number; thresholds: [number, number]; label: string; tone: string }) {
  const x0 = 34;
  const x1 = VB_W - 34;
  const w = x1 - x0;
  const y = 98;
  const p = Math.max(0, Math.min(1, value));
  const mx = x0 + p * w;
  const [t1, t2] = thresholds;

  const seg = (from: number, to: number, colour: string) => (
    <line
      x1={x0 + from * w}
      y1={y}
      x2={x0 + to * w}
      y2={y}
      stroke={colour}
      strokeWidth="7"
      strokeLinecap="round"
      opacity={0.35}
    />
  );

  return (
    <Frame>
      {seg(0, t1, "var(--signal)")}
      {seg(t1, t2, "var(--amber)")}
      {seg(t2, 1, "var(--coral)")}

      {/* the reading */}
      <line x1={x0} y1={y} x2={mx} y2={y} stroke={tone} strokeWidth="7" strokeLinecap="round" />
      <circle cx={mx} cy={y} r="7" fill={tone} stroke="var(--surface-2)" strokeWidth="3" />

      <text
        x={VB_W / 2}
        y={SAFE_TOP + 20}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text)"
        style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}
      >
        {(p * 100).toFixed(0)}%
      </text>
      <text x={x0} y={CAPTION_Y} textAnchor="start" dominantBaseline="central" fill="var(--text-faint)" style={{ fontSize: 10 }}>
        0
      </text>
      <Caption>{label}</Caption>
      <text x={x1} y={CAPTION_Y} textAnchor="end" dominantBaseline="central" fill="var(--text-faint)" style={{ fontSize: 10 }}>
        100
      </text>
    </Frame>
  );
}

/* ---- Area: a real series. ------------------------------------------------ */
function Area({ series, label, tone }: { series: number[]; label: string; tone: string }) {
  const pad = { l: 22, r: 22, t: SAFE_TOP, b: VB_H - SAFE_BOTTOM + 22 };
  const w = VB_W - pad.l - pad.r;
  const h = VB_H - pad.t - pad.b;
  const n = series.length;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const pts = series.map((v, i) => {
    const x = pad.l + (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = pad.t + h - ((v - min) / span) * h;
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const base = pad.t + h;
  const areaPath = `${line} L${pts[n - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z`;
  const last = pts[n - 1];

  return (
    <Frame>
      <defs>
        <linearGradient id="vg-area-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.20" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad.l} y1={base} x2={pad.l + w} y2={base} stroke="var(--line-strong)" strokeWidth="1" />
      <path d={areaPath} fill="url(#vg-area-fade)" />
      <path d={line} fill="none" stroke={tone} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={tone} stroke="var(--surface-2)" strokeWidth="2.5" />
      <Caption>{label}</Caption>
    </Frame>
  );
}

/* ---- Pipeline: how far the multi-agent run actually got. ------------------ */
function Pipeline({ done, total, label, tone }: { done: number; total: number; label: string; tone: string }) {
  const n = Math.max(1, total);
  const x0 = 46;
  const x1 = VB_W - 46;
  const step = n === 1 ? 0 : (x1 - x0) / (n - 1);
  const y = 68;

  return (
    <Frame>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
      {done > 0 && (
        <line
          x1={x0}
          y1={y}
          x2={x0 + Math.min(Math.max(done - 1, 0), n - 1) * step}
          y2={y}
          stroke={tone}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {Array.from({ length: n }).map((_, i) => {
        const cx = x0 + i * step;
        const filled = i < done;
        return (
          <circle
            key={i}
            cx={cx}
            cy={y}
            r={filled ? 7 : 5.5}
            fill={filled ? tone : "var(--surface-3)"}
            stroke={filled ? tone : "var(--line-strong)"}
            strokeWidth="2"
          />
        );
      })}
      <text
        x={VB_W / 2}
        y={102}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text)"
        style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
      >
        {done} / {total}
      </text>
      <Caption>{label}</Caption>
    </Frame>
  );
}

/* ---- Glyphs: one house style, drawn for this product. --------------------
   Each is constructed on the same 24-unit grid, scaled up and centred between
   the two safe lines, with a filled terminal node closing the primary path. */
const GLYPH_PATHS: Record<GlyphName, { d: string[]; nodes: [number, number][] }> = {
  // Competitive bearing: crossed axes with a plotted position.
  compass: { d: ["M4 20 L20 4", "M4 12 H20", "M12 4 V20"], nodes: [[17, 7]] },
  // Market field: nested opportunity boundaries.
  field: { d: ["M12 3 L21 12 L12 21 L3 12 Z", "M12 8 L16 12 L12 16 L8 12 Z"], nodes: [[12, 12]] },
  // Digital twin: two coupled orbits.
  twin: { d: ["M9 12 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0", "M15 12 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0"], nodes: [[12, 12]] },
  // Report: a bound sheet with ruled lines.
  doc: { d: ["M6 3 H15 L18 6 V21 H6 Z", "M9 10 H15", "M9 14 H15"], nodes: [[15, 18]] },
  // Horizon: exposure rising to a limit.
  horizon: { d: ["M3 18 C8 18 9 8 21 8", "M3 21 H21"], nodes: [[21, 8]] },
  // Spin-out: a body separating from its parent.
  split: { d: ["M4 4 H12 V12 H4 Z", "M14 14 H21 V21 H14 Z", "M12 12 L14 14"], nodes: [[21, 21]] },
  // Council: four seated voices, each with a short spoke into one decision at
  // the centre. Kept as separated members so it never reads as a plain cross.
  council: {
    d: [
      "M7.4 8.4 L10.2 10.6",
      "M16.6 8.4 L13.8 10.6",
      "M7.4 15.6 L10.2 13.4",
      "M16.6 15.6 L13.8 13.4",
      "M12 12 m-2.3 0 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0",
    ],
    nodes: [
      [6, 7],
      [18, 7],
      [6, 17],
      [18, 17],
    ],
  },
};

function Glyph({ glyph, label }: { glyph: GlyphName; label: string }) {
  const g = GLYPH_PATHS[glyph];
  const scale = 2.7;
  const size = 24 * scale;
  // Centre the mark in the band left between the pin and the caption.
  const midY = (SAFE_TOP + (CAPTION_Y - 14)) / 2;

  // Several marks are deliberately asymmetric (a fork, a horizon, a separating
  // body), so centring their 24-unit BOX leaves the drawn ink visibly off-axis.
  // Start from the box-centred transform — which is already correct for the
  // symmetric marks and renders on the very first paint — then measure the real
  // ink extents and re-centre on those.
  const boxCentred = `translate(${((VB_W - size) / 2).toFixed(2)} ${(midY - size / 2).toFixed(2)}) scale(${scale})`;
  const ref = React.useRef<SVGGElement>(null);
  const [transform, setTransform] = React.useState(boxCentred);

  React.useLayoutEffect(() => {
    setTransform(boxCentred);
    const node = ref.current;
    if (!node || typeof node.getBBox !== "function") return;
    let box: DOMRect;
    try {
      box = node.getBBox();
    } catch {
      return; // not rendered yet in this environment
    }
    if (!box.width || !box.height) return;
    const inkX = box.x + box.width / 2;
    const inkY = box.y + box.height / 2;
    setTransform(
      `translate(${(VB_W / 2 - scale * inkX).toFixed(2)} ${(midY - scale * inkY).toFixed(2)}) scale(${scale})`
    );
  }, [glyph, boxCentred, midY, scale]);

  return (
    <Frame>
      <g
        ref={ref}
        transform={transform}
        stroke="var(--text-faint)"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {g.d.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {g.nodes.map(([cx, cy], i) => (
          <circle key={`n${i}`} cx={cx} cy={cy} r="1.6" fill="var(--text-mute)" stroke="none" />
        ))}
      </g>
      <Caption>{label}</Caption>
    </Frame>
  );
}

export default function CardVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case "ring":
      return <Ring value={visual.value} max={visual.max} label={visual.label} tone={visual.tone} />;
    case "band":
      return <Band value={visual.value} thresholds={visual.thresholds} label={visual.label} tone={visual.tone} />;
    case "area":
      return <Area series={visual.series} label={visual.label} tone={visual.tone} />;
    case "pipeline":
      return <Pipeline done={visual.done} total={visual.total} label={visual.label} tone={visual.tone} />;
    case "glyph":
      return <Glyph glyph={visual.glyph} label={visual.label} />;
  }
}
