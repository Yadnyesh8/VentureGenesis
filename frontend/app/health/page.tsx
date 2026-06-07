"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, useAgent } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { CHART, axisProps, ANIM, gradeColor } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function HealthPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.health(r), [JSON.stringify(r)]);
  const d = data?.data;
  const comps = d?.components || {};
  const chart = Object.entries(comps).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v as number }));

  return (
    <div>
      <PageHeader title="Startup Health Score" desc="Weighted composite across 5 pillars (config-driven weights)." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading /> : d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Metric label="Health Score" value={d.health_score} tone={d.health_score >= 65 ? "good" : d.health_score >= 45 ? "warn" : "bad"} sub={`Grade ${d.grade}`} />
            <Metric label="Grade" value={d.grade} tone="brand" />
            <Metric label="Strongest pillar" value={chart.length ? chart.reduce((a, b) => (a.value > b.value ? a : b)).name : "—"} />
          </div>
          <Card title="Score breakdown by pillar">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chart} layout="vertical" margin={{ left: 30, right: 40 }}>
                <XAxis type="number" domain={[0, 100]} {...axisProps} />
                <YAxis type="category" dataKey="name" width={130} {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} {...ANIM}>
                  {chart.map((c, i) => (
                    <Cell key={i} fill={gradeColor(c.value)} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fill: CHART.text, fontSize: 16 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-muted mt-3">
              Weights: {Object.entries(d.weights || {}).map(([k, v]) => `${k} ${(Number(v) * 100).toFixed(0)}%`).join(" · ")}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
