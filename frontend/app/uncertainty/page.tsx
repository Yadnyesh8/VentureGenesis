"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, useAgent } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function UncertaintyPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.voi(r), [JSON.stringify(r)], "voi");
  const d = data?.data;
  const ledger = d?.ledger || [];
  const chart = ledger.map((it: any) => ({
    name: it.field.length > 18 ? it.field.slice(0, 18) + "…" : it.field,
    "VOI": Math.round((it.voi || 0) * 100),
    "cost": Math.round((it.cost_in_voi_units || 0) * 100),
  }));

  return (
    <div>
      <PageHeader
        title="Epistemic Uncertainty"
        desc="Agents compute the Value of Information for each missing fact, and only 'buy' data when VOI exceeds its cost."
      />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading label="Scoring information value…" /> : d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Metric label="Top unknown" value={d.top_unknown ?? "—"} tone="brand" />
            <Metric label="Fetches made" value={d.fetches_made} />
            <Metric label="External spend" value={`$${(d.spend?.usd_spent ?? 0).toFixed(3)}`} />
            <Metric label="Gaps found" value={ledger.length} />
          </div>

          <Card title="Value of Information vs Cost" className="mb-6">
            <ResponsiveContainer width="100%" height={Math.max(280, chart.length * 44)}>
              <BarChart data={chart} layout="vertical" barCategoryGap="30%" margin={{ left: 12, right: 12 }}>
                <XAxis type="number" {...axisProps} label={{ value: "relative units", position: "insideBottom", offset: -2, fill: CHART.axis, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} />
                <Bar dataKey="VOI" fill={CHART.aqua} radius={[0, 6, 6, 0]} {...ANIM} />
                <Bar dataKey="cost" fill={CHART.bad} radius={[0, 6, 6, 0]} {...ANIM} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="card-h mb-3">Information ledger</div>
          <div className="grid lg:grid-cols-2 gap-4">
            {ledger.map((it: any, i: number) => (
              <Card
                key={i}
                title={it.field}
                right={it.worth_fetching ? <Pill tone="good">FETCH</Pill> : <Pill tone="neutral">SKIP — LOW VOI</Pill>}
              >
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>VOI: <b className="text-aqua">{(it.voi ?? 0).toFixed(4)}</b></div>
                  <div>Cost: <b className="text-coral">${it.cost_usd}</b></div>
                  <div>Source: <b>{it.source}</b></div>
                  <div>Basis: <b>{it.basis === "model_perturbation" ? "model" : "prior"}</b></div>
                </div>
                <p className="text-xs text-muted">
                  {it.fetched
                    ? "✓ acquired"
                    : it.worth_fetching
                      ? (it.fetch_reason || "connector unavailable (would have been worth buying)")
                      : "VOI below cost — not worth buying"}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
