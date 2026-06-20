"use client";
import React from "react";
import { api, type SpinoutProject } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, CountUp } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

const SLIDERS: { field: keyof SpinoutProject; help: string }[] = [
  { field: "market_disruption", help: "How disruptive the project is to its market." },
  { field: "cannibalization_risk", help: "Risk it cannibalizes the parent's core revenue." },
  { field: "capital_intensity", help: "How capital-hungry it is to scale." },
  { field: "talent_flight_risk", help: "Risk key talent leaves if kept internal." },
  { field: "strategic_adjacency", help: "How adjacent it is to the parent's core strategy." },
];

const DEFAULTS: SpinoutProject = {
  project_name: "Internal R&D Project",
  market_disruption: 0.6,
  cannibalization_risk: 0.4,
  capital_intensity: 0.5,
  talent_flight_risk: 0.5,
  strategic_adjacency: 0.5,
};

// "market_disruption" -> "Market disruption"
function humanize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const REC_LABEL: Record<string, string> = {
  SPIN_OUT: "Spin out",
  KEEP_INTERNAL: "Keep internal",
  TOSS_UP: "Toss-up",
};

function recTone(rec: string) {
  return rec === "SPIN_OUT" ? "good" : rec === "KEEP_INTERNAL" ? "brand" : "warn";
}

export default function SpinoutPage() {
  const { ref } = useStore();
  const [project, setProject] = React.useState<SpinoutProject>(DEFAULTS);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = (field: keyof SpinoutProject, value: number | string) =>
    setProject((p) => ({ ...p, [field]: value }));

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.spinout({ project, metrics: ref().metrics });
      setData(res.data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const d = data;
  const evWinner: "spin" | "internal" | null = d
    ? d.ev_spinout >= d.ev_internal
      ? "spin"
      : "internal"
    : null;

  const evChart = d
    ? [
        { name: "Spin-out", ev: Number(d.ev_spinout), key: "spin" },
        { name: "Internal", ev: Number(d.ev_internal), key: "internal" },
      ]
    : [];

  const contribChart = d
    ? Object.entries(d.factor_contributions || {}).map(([k, v]: [string, any]) => ({
        name: humanize(k),
        value: Math.round(Number(v) * 100),
      }))
    : [];

  return (
    <div>
      <PageHeader
        title="Spin-out Viability"
        desc="Should an internal R&D project win as an independent VC-backed startup, or stay an internal unit? The Innovator's Dilemma, solved numerically."
      />

      <Card title="Project parameters" className="mb-6">
        <div className="mb-5">
          <label className="card-h block mb-2">Project name</label>
          <input
            className="input-field"
            type="text"
            value={project.project_name ?? ""}
            onChange={(e) => set("project_name", e.target.value)}
            placeholder="Internal R&D Project"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {SLIDERS.map(({ field, help }) => {
            const val = Number(project[field] ?? 0);
            return (
              <div key={field as string}>
                <div className="flex items-center justify-between mb-2">
                  <label className="card-h !mb-0" title={help}>{humanize(field as string)}</label>
                  <span className="label-mono text-aqua">{fmtPct(val)}</span>
                </div>
                <input
                  className="w-full accent-violet cursor-pointer"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={val}
                  onChange={(e) => set(field, Number(e.target.value))}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <button className="btn" onClick={run} disabled={loading}>
            {loading ? "Evaluating…" : "Evaluate"}
          </button>
        </div>
      </Card>

      {error && <ErrorBox error={error} />}
      {loading && <Loading label="Computing expected values…" />}

      {!loading && d && (
        <>
          {/* 1. Verdict */}
          <Card className="mb-6" title="Board verdict" right={<Pill tone={recTone(d.recommendation)} dot>{REC_LABEL[d.recommendation] || d.recommendation}</Pill>}>
            <div className={`display-stat text-[clamp(28px,4vw,52px)] ${
              recTone(d.recommendation) === "good" ? "text-good" : recTone(d.recommendation) === "brand" ? "text-violet" : "text-warn"
            }`}>
              <CountUp value={REC_LABEL[d.recommendation] || d.recommendation} />
            </div>
            <p className="text-sm text-muted mt-3">
              Expected-value edge of{" "}
              <b className={d.delta >= 0 ? "text-good" : "text-warn"}>{Number(d.delta).toFixed(2)}</b>{" "}
              for the {d.delta >= 0 ? "spin-out" : "internal"} path.
              {d.survival_basis ? <span className="block text-xs text-muted mt-1">Survival basis: {d.survival_basis}</span> : null}
            </p>
          </Card>

          {/* 2. Metric row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Metric label="EV — spin-out" value={Number(d.ev_spinout).toFixed(2)} tone={evWinner === "spin" ? "good" : "default"} />
            <Metric label="EV — internal" value={Number(d.ev_internal).toFixed(2)} tone={evWinner === "internal" ? "brand" : "default"} />
            <Metric label="Survival prob" value={fmtPct(d.survival_probability)} tone="accent" />
            <Metric label="Spin quality" value={fmtPct(d.spin_quality)} tone="brand" />
          </div>

          {/* 3. EV comparison */}
          <Card title="EV comparison" className="mb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={evChart} barCategoryGap="40%">
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip fmt={(v: number) => Number(v).toFixed(2)} />} />
                <Bar dataKey="ev" radius={[6, 6, 0, 0]} {...ANIM}>
                  {evChart.map((row, i: number) => (
                    <Cell key={i} fill={row.key === "spin" ? CHART.good : CHART.violet} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 4. Factor contributions */}
          {contribChart.length > 0 && (
            <Card title="Factor contributions" className="mb-6">
              <p className="text-xs text-muted mb-3">Positive bars favor a spin-out; negative bars favor keeping it internal.</p>
              <ResponsiveContainer width="100%" height={Math.max(220, contribChart.length * 52)}>
                <BarChart data={contribChart} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <XAxis type="number" {...axisProps} />
                  <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} {...ANIM}>
                    {contribChart.map((row, i: number) => (
                      <Cell key={i} fill={row.value >= 0 ? CHART.good : CHART.bad} />
                    ))}
                    <LabelList dataKey="value" position="right" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: CHART.axis }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* 5. Decision sensitivity */}
          {d.flip_factor && (
            <Card title="Decision sensitivity" className="mb-6" right={<Pill tone="warn" dot>FLIP POINT</Pill>}>
              <p className="text-sm text-muted">
                Set <b className="text-text">{humanize(d.flip_factor.field)}</b> to{" "}
                <b className="text-aqua">{d.flip_factor.set_to === 1 ? "max" : "min"}</b> → recommendation flips to{" "}
                <Pill tone={recTone(d.flip_factor.would_become)}>{REC_LABEL[d.flip_factor.would_become] || d.flip_factor.would_become}</Pill>.
              </p>
            </Card>
          )}

          {/* 6. LLM sections */}
          {d.rationale && (
            <Card title="Rationale" className="mb-6">
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{d.rationale}</p>
            </Card>
          )}

          {(Array.isArray(d.key_drivers) && d.key_drivers.length > 0) ||
          (Array.isArray(d.risks_if_wrong) && d.risks_if_wrong.length > 0) ? (
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              {Array.isArray(d.key_drivers) && d.key_drivers.length > 0 && (
                <Card title="Key drivers" right={<Pill tone="good">DRIVERS</Pill>}>
                  <ul className="space-y-2">
                    {d.key_drivers.map((x: string, i: number) => (
                      <li key={i} className="text-sm text-muted flex gap-2">
                        <span className="text-good shrink-0">▸</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {Array.isArray(d.risks_if_wrong) && d.risks_if_wrong.length > 0 && (
                <Card title="Risks if wrong" right={<Pill tone="bad">RISKS</Pill>}>
                  <ul className="space-y-2">
                    {d.risks_if_wrong.map((x: string, i: number) => (
                      <li key={i} className="text-sm text-muted flex gap-2">
                        <span className="text-coral shrink-0">▸</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          ) : null}

          {Array.isArray(d.first_90_days) && d.first_90_days.length > 0 && (
            <Card title="First 90 days" className="mb-6" right={<Pill tone="aqua">PLAYBOOK</Pill>}>
              <ol className="space-y-2">
                {d.first_90_days.map((x: string, i: number) => (
                  <li key={i} className="text-sm text-muted flex gap-3">
                    <span className="label-mono text-aqua shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
