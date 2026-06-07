"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Loading, PageHeader, Pill, fmtMoney, fmtPct, useAgent } from "@/components/ui";

export default function ReportPage() {
  const { ref, metrics } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.board(r), [JSON.stringify(r)]);
  const report = data?.data?.full_report;
  const decision = data?.data?.board_decision_obj;

  return (
    <div>
      <PageHeader
        title="Executive Report"
        desc="Full aggregated analysis from every agent."
        action={<button className="btn" onClick={() => window.print()}>⬇ Download PDF</button>}
      />
      {error && <div className="text-bad text-sm">{error}</div>}
      {loading ? <Loading label="Compiling full report (running all agents)…" /> : report && (
        <div className="space-y-4" id="report">
          <Card title={`${metrics.startup_name} — Board Verdict`}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="display-hero text-[clamp(24px,3vw,40px)]">{decision?.board_decision}</div>
              <Pill>confidence {Math.round((decision?.confidence || 0) * 100)}%</Pill>
              <span className="text-sm text-muted">{report.understanding?.industry} · {report.understanding?.business_model} · {report.understanding?.stage} · {report.understanding?.profile}</span>
            </div>
            <p className="text-sm text-muted mt-3">{decision?.summary}</p>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Health" value={report.health?.health_score} sub={`Grade ${report.health?.grade}`} />
            <Stat label="12m Failure" value={fmtPct(report.failure?.failure_12m)} />
            <Stat label="Funding prob" value={fmtPct(report.funding?.funding_probability)} />
            <Stat label="12m Revenue" value={fmtMoney(report.forecast?.forecast_12m)} />
            <Stat label="Churn risk" value={fmtPct(report.churn?.churn_risk)} />
            <Stat label="Sentiment" value={report.sentiment?.sentiment} />
            <Stat label="Threat" value={report.competitor?.threat_score} />
            <Stat label="Opportunity" value={report.market?.opportunity_score} />
          </div>

          <Card title="Root cause analysis">
            <ul className="space-y-1">
              {(report.root_cause?.causes || []).map((c: any, i: number) => (
                <li key={i} className="text-sm flex gap-2">
                  <Pill tone={c.impact === "high" ? "bad" : c.impact === "medium" ? "warn" : "neutral"}>{c.impact}</Pill>
                  {c.cause} <span className="text-muted text-xs">({c.evidence})</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Founder strategy">
              <ul className="space-y-1 text-sm">
                {(report.founder_strategy?.recommendations || []).map((x: any, i: number) => (
                  <li key={i}>• <span className="text-accent">{x.area}</span> — {x.action}</li>
                ))}
              </ul>
            </Card>
            <Card title="Investor & CFO view">
              <p className="text-sm">Investor: <b>{report.investor?.would_invest ? "Would invest" : "Pass for now"}</b> ({Math.round((report.investor?.confidence || 0) * 100)}%)</p>
              <p className="text-sm text-muted mt-1">{report.investor?.thesis}</p>
              <p className="text-sm mt-3">CFO: runway <b>{report.financial_risk?.runway_months}mo</b> · risk <Pill tone={report.financial_risk?.risk_level === "low" ? "good" : "warn"}>{report.financial_risk?.risk_level}</Pill></p>
              <p className="text-sm text-muted mt-1">{report.financial_risk?.recommendation}</p>
            </Card>
          </div>

          <Card title="Recommended pivot">
            <div className="flex items-center gap-3 flex-wrap">
              <Pill tone="good">{report.pivots?.recommended_pivot}</Pill>
              <span className="text-sm">Success {fmtPct(report.pivots?.success_probability)} · ROI {report.pivots?.roi}% · Risk {report.pivots?.risk_score}</span>
            </div>
          </Card>

          <Card title="Debate consensus">
            <Pill tone={report.debate?.consensus}>{report.debate?.consensus}</Pill>
            <div className="mt-2 space-y-1 text-xs text-muted max-h-48 overflow-y-auto">
              {(report.debate?.transcript || []).map((m: any, i: number) => (
                <div key={i}><b className="text-gray-300">R{m.round} {m.role}:</b> {m.message}</div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: any) {
  return (
    <Card>
      <div className="card-h">{label}</div>
      <div className="display-stat text-xl">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}
