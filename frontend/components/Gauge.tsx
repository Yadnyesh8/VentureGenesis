"use client";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { CHART, ANIM } from "@/lib/chartTheme";
import { GaugeTicks } from "./instrument";
import { CountUp } from "./ui";

// Lighten a hex toward white for the gradient's leading edge.
function lighten(hex: string, amt = 0.4) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export default function Gauge({
  value,
  color,
  unit = "",
  height = 220,
  decimals = 0,
}: {
  value: number;
  color: string;
  unit?: string;
  height?: number;
  decimals?: number;
}) {
  const v = Math.max(0, Math.min(100, value || 0));
  const gid = `gauge-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="relative" style={{ height }}>
      <GaugeTicks />
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="68%"
          outerRadius="92%"
          data={[{ value: v, fill: `url(#${gid})` }]}
          startAngle={225}
          endAngle={-45}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={lighten(color, 0.35)} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: CHART.track }} dataKey="value" cornerRadius={20} {...ANIM} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="display-stat text-[clamp(26px,3.2vw,44px)]" style={{ color, textShadow: `0 0 24px ${color}55` }}>
          <CountUp value={value?.toFixed ? value.toFixed(decimals) : value} />
        </div>
        {unit && <div className="label-mono mt-1.5">{unit}</div>}
      </div>
    </div>
  );
}
