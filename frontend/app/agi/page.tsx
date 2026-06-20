"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, useAgent } from "@/components/ui";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function AgiPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.agi(r), [JSON.stringify(r)], "agi");
  const d = data?.data;

  const curve = (d?.survival_curve || []).map((s: any) => ({
    name: `+${s.year_offset}y`,
    milestone: s.milestone,
    "surviving value (%)": Math.round(s.surviving_value * 100),
  }));

  const vectors = (d?.vectors || []).map((v: any) => ({
    name: v.vector.length > 22 ? v.vector.slice(0, 22) + "…" : v.vector,
    vector: v.vector,
    "contribution (%)": Math.round(v.contribution * 100),
    exposure: v.exposure,
  }));

  const resTone = (s: number) => (s >= 0.5 ? "good" : s >= 0.25 ? "warn" : "bad");
  const verdictTone =
    d?.verdict === "AGI-resistant" ? "good" : d?.verdict === "AGI-fragile" ? "bad" : "warn";

  return (
    <div>
      <PageHeader
        title="AGI Pre-Conditioner"
        desc="Stress-tests the business model against AGI milestones and scores how much defensibility survives."
      />
      {error && <ErrorBox error={error} />}
      {loading ? (
        <Loading label="Simulating AGI milestones…" />
      ) : (
        d && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Metric label="AGI-resistance" value={fmtPct(d.resistance_score)} tone={resTone(d.resistance_score)} />
              <Metric label="Years defensible" value={`${d.years_of_defensibility} yrs`} />
              <Metric label="Top threat" value={d.top_threat_vector} tone="brand" />
              {d.verdict && <Metric label="Verdict" value={d.verdict} tone={verdictTone} />}
            </div>

            <Card title="Defensibility survival curve" className="mb-6">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={curve}>
                  <defs>
                    <linearGradient id="agi-survive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.aqua} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART.aqua} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} domain={[0, 100]} />
                  <Tooltip cursor={{ stroke: "rgba(255,255,255,0.08)" }} content={<InstrumentTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="surviving value (%)"
                    stroke={CHART.aqua}
                    strokeWidth={2}
                    fill="url(#agi-survive)"
                    {...ANIM}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="AGI threat vectors" className="mb-6">
              <ResponsiveContainer width="100%" height={Math.max(220, vectors.length * 48)}>
                <BarChart data={vectors} layout="vertical" barCategoryGap="35%">
                  <XAxis type="number" {...axisProps} />
                  <YAxis type="category" dataKey="name" width={170} {...axisProps} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                  <Bar dataKey="contribution (%)" fill={CHART.bad} radius={[0, 6, 6, 0]} {...ANIM} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {vectors.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 border-b border-line/40 pb-1">
                    <span className="text-muted truncate">{v.vector}</span>
                    <b className="text-coral shrink-0">{fmtPct(v.exposure)}</b>
                  </div>
                ))}
              </div>
            </Card>

            {d.summary && (
              <Card title="Assessment" className="mb-6">
                <p className="text-sm text-muted leading-relaxed">{d.summary}</p>
              </Card>
            )}

            {d.milestone_breakage && d.milestone_breakage.length > 0 && (
              <Card title="How AGI milestones break the moat" className="mb-6">
                <div className="grid gap-3">
                  {d.milestone_breakage.map((m: any, i: number) => (
                    <div key={i} className="border-l-2 border-coral/40 pl-3">
                      <div className="label-mono text-coral mb-1">{m.milestone}</div>
                      <p className="text-sm text-muted">{m.how_it_breaks}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {d.resistant_redesigns && d.resistant_redesigns.length > 0 && (
              <div className="grid lg:grid-cols-2 gap-4">
                {d.resistant_redesigns.map((rd: any, i: number) => (
                  <Card key={i} title={rd.move} right={<Pill tone="good">REDESIGN</Pill>}>
                    <p className="text-sm text-muted leading-relaxed">{rd.why}</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
