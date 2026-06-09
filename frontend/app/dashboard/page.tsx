"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, PageHeader, fmtMoney, fmtPct, useAgent, Pill } from "@/components/ui";
import Gauge from "@/components/Gauge";
import { gradeColor } from "@/lib/chartTheme";

export default function Dashboard() {
  const { ref, metrics, clearProfile } = useStore();
  const r = ref();
  const key = JSON.stringify(r);
  const health = useAgent(() => api.health(r), [key]);
  const failure = useAgent(() => api.failure(r), [key]);
  const funding = useAgent(() => api.funding(r), [key]);

  const hs = health.data?.data?.health_score ?? 0;
  const f12 = failure.data?.data?.failure_12m ?? 0;
  const fp = funding.data?.data?.funding_probability ?? 0;
  const trained = failure.data?.data?.trained;

  return (
    <div>
      <PageHeader
        title={metrics.startup_name || "Command Center"}
        desc="Your AI board of directors — analysis built from your questionnaire."
        action={<Link href="/board" className="btn">Convene the Board →</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric label="Health Score" value={health.loading ? "…" : `${hs}`} tone={hs >= 65 ? "good" : hs >= 45 ? "warn" : "bad"} sub="0–100 composite" />
        <Metric label="12m Failure Risk" value={failure.loading ? "…" : fmtPct(f12)} tone={f12 < 0.35 ? "good" : f12 < 0.6 ? "warn" : "bad"} />
        <Metric label="Funding Probability" value={funding.loading ? "…" : fmtPct(fp)} tone={fp >= 0.5 ? "good" : "warn"} />
        <Metric label="Runway" value={`${metrics.runway ?? 0} mo`} tone={(metrics.runway ?? 0) >= 9 ? "good" : "bad"} />
      </div>

      {trained !== undefined && (
        <div className="mb-6 text-xs text-muted">
          <Pill tone={trained ? "good" : "neutral"}>{trained ? "Trained model" : "Rule-based"}</Pill>{" "}
          {failure.data?.data?.method}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Revenue"><div className="stat">{fmtMoney(metrics.revenue || 0)}</div><div className="text-xs text-muted mt-1">Annual</div></Card>
        <Card title="Customers"><div className="stat">{(metrics.customer_count || 0).toLocaleString()}</div><div className="text-xs text-muted mt-1">Growth {fmtPct(metrics.customer_growth || 0)}</div></Card>
        <Card title="Valuation"><div className="stat">{fmtMoney(metrics.valuation || 0)}</div><div className="text-xs text-muted mt-1">Funding raised {fmtMoney(metrics.funding_amount || 0)}</div></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Health Gauge">
          {health.loading ? <Loading /> : <Gauge value={hs} color={gradeColor(hs)} unit="HEALTH / 100" height={200} />}
        </Card>
        <Card title="Explore" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ["/failure", "Failure + SHAP"],
              ["/forecast", "Revenue Forecast"],
              ["/funding", "Funding Readiness"],
              ["/customer", "Customer Sentiment"],
              ["/competitor", "Competitor Map"],
              ["/market", "Market Opportunity"],
              ["/pivots", "Pivot Engine"],
              ["/simulation", "Digital Twin"],
              ["/report", "Executive Report"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="btn-ghost text-center">{label}</Link>
            ))}
          </div>
          <div className="mt-4 text-sm text-muted flex items-center gap-2 flex-wrap">
            <Pill>{metrics.industry || "—"}</Pill>
            <Pill tone="neutral">{metrics.business_model || "—"}</Pill>
            <Pill tone="neutral">{metrics.stage || "—"}</Pill>
            {metrics.founding_year && <Pill tone="neutral">est. {metrics.founding_year}</Pill>}
          </div>
        </Card>
      </div>

      <Card title="Your startup profile" right={<div className="flex gap-2">
        <Link href="/onboarding" className="btn-ghost">Edit profile</Link>
        <button className="btn-ghost" onClick={clearProfile}>Start over</button>
      </div>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            ["Revenue", fmtMoney(metrics.revenue || 0)],
            ["Expenses", fmtMoney(metrics.expenses || 0)],
            ["Monthly burn", fmtMoney(metrics.burn_rate || 0)],
            ["Runway", `${metrics.runway ?? 0} mo`],
            ["Customers", (metrics.customer_count || 0).toLocaleString()],
            ["Growth", fmtPct(metrics.customer_growth || 0)],
            ["Team", metrics.employee_count ?? 0],
          ].map(([k, v]) => (
            <div key={k as string}><div className="text-muted text-xs">{k}</div><div className="font-semibold">{v}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}
