"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Loading, ErrorBox, PageHeader, Pill, fmtMoney, fmtPct } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

const SCENARIOS = [
  { key: "marketing_increase", label: "Marketing +", desc: "revenue +10%, burn +5%" },
  { key: "hiring_increase", label: "Hiring +", desc: "growth +7%, expenses +12%" },
  { key: "product_launch", label: "Product Launch", desc: "customer growth +18%" },
  { key: "cost_cutting", label: "Cost Cutting", desc: "expenses −15%, burn −18%" },
];

// Twin-state metrics live on different scales: money ($), counts, and rates (0–1).
// Format each by kind so a customer count never renders as currency ("$1K").
const MONEY_KEYS = new Set(["revenue", "burn_rate", "expenses", "funding"]);
const RATE_KEYS = new Set(["growth_rate", "market_share"]);
function fmtMetric(key: string, val: any) {
  if (typeof val !== "number") return val;
  if (MONEY_KEYS.has(key)) return fmtMoney(val);
  if (RATE_KEYS.has(key)) return fmtPct(val);
  return Math.round(val).toLocaleString();
}

export default function SimulationPage() {
  const { metrics } = useStore();
  const [scenario, setScenario] = useState("product_launch");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(s: string) {
    setScenario(s);
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulate({ metrics, scenario: s });
      setResult(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const diff = result?.diff || {};
  // Metrics live on wildly different scales ($8.5M revenue vs 1,200 customers vs 0.22
  // growth), so plotting raw before/after on one axis is unreadable. Show % change per
  // metric instead — a single, comparable scale.
  const chart = ["revenue", "customers", "burn_rate", "growth_rate", "expenses"]
    .filter((k) => diff[k])
    .map((k) => ({ name: k.replace(/_/g, " "), change: diff[k].pct }));

  return (
    <div>
      <PageHeader title="Digital Twin — Scenario Simulator" desc="Apply a scenario to a virtual copy of your startup, then re-run the trained models to predict the impact." />
      <div className="flex flex-wrap gap-2 mb-6">
        {SCENARIOS.map((s) => (
          <button key={s.key} onClick={() => run(s.key)} className={scenario === s.key && result ? "btn" : "btn-ghost"}>
            {s.label} <span className="text-[10px] text-muted ml-1">{s.desc}</span>
          </button>
        ))}
      </div>
      {error && <ErrorBox error={error} />}
      {!result && !loading && <Card><div className="text-muted text-sm">Pick a scenario to simulate.</div></Card>}
      {loading ? <Loading label="Running digital twin + trained models…" /> : result && (
        <>
          {result.predicted_impact && (
            <Card title="Predicted impact (trained models re-run on the simulated company)" className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ImpactStat label="12-month failure risk" v={result.predicted_impact.failure_12m} pct lowerBetter />
                <ImpactStat label="Health score" v={result.predicted_impact.health_score} lowerBetter={false} />
                <ImpactStat label="Funding probability" v={result.predicted_impact.funding_probability} pct lowerBetter={false} />
              </div>
            </Card>
          )}
          <Card title={`Twin state: ${scenario.replace(/_/g, " ")} — % change per metric`} className="mb-6">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chart} barCategoryGap="35%">
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} unit="%" />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                <Bar dataKey="change" name="% change" fill={CHART.violet} radius={[6, 6, 0, 0]} {...ANIM} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(diff).map(([k, v]: any) => (
              <Card key={k} title={k.replace(/_/g, " ")}>
                <div className="text-lg font-bold">{fmtMetric(k, v.after)}</div>
                <Pill tone={v.change >= 0 ? "good" : "bad"}>{v.change >= 0 ? "+" : ""}{v.pct}%</Pill>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ImpactStat({ label, v, pct = false, lowerBetter }: any) {
  if (!v) return null;
  const fmt = (x: number) => (pct ? fmtPct(x) : x);
  const improved = lowerBetter ? v.change < 0 : v.change > 0;
  const neutral = v.change === 0;
  const tone = neutral ? "text-text-dim" : improved ? "text-signal" : "text-coral";
  const arrow = neutral ? "→" : v.change > 0 ? "↑" : "↓";
  return (
    <div className="rounded-xl border border-line bg-surface2 p-4">
      <div className="card-h !mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-text-dim text-lg">{fmt(v.before)}</span>
        <span className={`text-lg ${tone}`}>{arrow}</span>
        <span className={`display-stat text-2xl ${tone}`}>{fmt(v.after)}</span>
      </div>
      <div className={`label-mono mt-1 ${tone}`}>
        {neutral ? "NO CHANGE" : `${improved ? "IMPROVED" : "WORSE"} · ${v.change > 0 ? "+" : ""}${pct ? (v.change * 100).toFixed(1) + "PP" : v.change}`}
      </div>
    </div>
  );
}
