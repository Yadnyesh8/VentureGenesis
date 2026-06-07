"use client";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { CHART, ANIM } from "@/lib/chartTheme";
import { GaugeTicks } from "./instrument";
import { CountUp } from "./ui";

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
  return (
    <div className="relative" style={{ height }}>
      <GaugeTicks />
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="68%"
          outerRadius="92%"
          data={[{ value: v, fill: color }]}
          startAngle={225}
          endAngle={-45}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: CHART.track }} dataKey="value" cornerRadius={20} {...ANIM} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="display-stat text-[clamp(24px,3vw,40px)]" style={{ color }}>
          <CountUp value={value?.toFixed ? value.toFixed(decimals) : value} />
        </div>
        {unit && <div className="label-mono mt-1">{unit}</div>}
      </div>
    </div>
  );
}
