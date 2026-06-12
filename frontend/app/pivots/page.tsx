"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, useAgent } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function PivotsPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.pivots(r), [JSON.stringify(r)], "pivots");
  const d = data?.data;
  const chart = (d?.all_pivots || []).map((p: any) => ({
    name: p.pivot_name.length > 18 ? p.pivot_name.slice(0, 18) + "…" : p.pivot_name,
    "revenue impact": Math.round(p.revenue_impact * 100),
    "success prob": Math.round(p.success_probability * 100),
    "risk": p.risk_score,
  }));

  return (
    <div>
      <PageHeader title="Pivot Engine" desc="Generate → simulate → optimize. Rule-based scoring selects the best pivot." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading label="Generating & simulating pivots…" /> : d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Metric label="Recommended pivot" value={d.recommended_pivot} tone="brand" />
            <Metric label="Success probability" value={fmtPct(d.success_probability)} tone="good" />
            <Metric label="ROI" value={`${d.roi}%`} tone="good" />
            <Metric label="Risk score" value={d.risk_score} tone={d.risk_score < 40 ? "good" : "warn"} />
          </div>
          <Card title="Pivot comparison" className="mb-6">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chart} barCategoryGap="40%">
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} />
                <Bar dataKey="revenue impact" fill={CHART.aqua} radius={[6, 6, 0, 0]} {...ANIM} />
                <Bar dataKey="success prob" fill={CHART.good} radius={[6, 6, 0, 0]} {...ANIM} />
                <Bar dataKey="risk" fill={CHART.bad} radius={[6, 6, 0, 0]} {...ANIM} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
            {(d.all_pivots || []).map((p: any, i: number) => (
              <Card key={i} title={p.pivot_name} right={i === 0 ? <Pill tone="good">RECOMMENDED</Pill> : <Pill tone="neutral">#{i + 1}</Pill>}>
                <p className="text-sm text-muted mb-2">{p.description}</p>
                <p className="text-xs text-muted mb-3">{p.rationale}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Success: <b className="text-good">{fmtPct(p.success_probability)}</b></div>
                  <div>ROI: <b>{p.roi}%</b></div>
                  <div>Revenue impact: <b>{fmtPct(p.revenue_impact)}</b></div>
                  <div>Risk: <b className="text-warn">{p.risk_score}</b></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
