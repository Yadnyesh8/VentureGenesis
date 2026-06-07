"use client";
import { useState } from "react";
import { streamBoard } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, PageHeader, Pill, fmtMoney, fmtPct } from "@/components/ui";
import AgentPipeline, { StepState } from "@/components/AgentPipeline";

export default function ReportPage() {
  const { ref, metrics } = useStore();
  const [steps, setSteps] = useState<StepState[]>([]);
  const [report, setReport] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [running, setRunning] = useState(false);

  function patch(key: string, u: Partial<StepState>) {
    setSteps((p) => p.map((s) => (s.key === key ? { ...s, ...u } : s)));
  }

  async function run() {
    setRunning(true);
    setReport(null);
    setDecision(null);
    try {
      await streamBoard(ref(), (ev) => {
        if (ev.type === "start") setSteps(ev.steps.map((s: any) => ({ ...s, status: "pending" })));
        if (ev.type === "agent_start") patch(ev.key, { status: "running" });
        if (ev.type === "agent_done") patch(ev.key, { status: "done", ms: ev.ms });
        if (ev.type === "agent_error") patch(ev.key, { status: "error", ms: ev.ms });
        if (ev.type === "complete") { setReport(ev.report); setDecision(ev.decision); }
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Executive Report"
        desc="Runs every agent live and compiles the full report."
        action={
          <div className="flex gap-2">
            <button className="btn" onClick={run} disabled={running}>{running ? "Compiling…" : report ? "Re-run" : "Generate report"}</button>
            {report && <button className="btn-ghost" onClick={() => window.print()}>⬇ PDF</button>}
          </div>
        }
      />

      {steps.length > 0 && !report && (
        <Card><AgentPipeline steps={steps} /></Card>
      )}

      {!report && steps.length === 0 && (
        <Card><div className="text-text-dim text-sm">Click "Generate report" to run all agents live and compile your executive plate.</div></Card>
      )}

      {report && (
        <div className="space-y-4" id="report">
          <Card title={`${metrics.startup_name} — Board Verdict`}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="display-hero text-aqua text-[clamp(28px,4vw,52px)]">{decision?.board_decision}</div>
              <Pill>confidence {Math.round((decision?.confidence || 0) * 100)}%</Pill>
              <span className="text-sm text-text-dim">{report.understanding?.industry} · {report.understanding?.business_model} · {report.understanding?.stage} · {report.understanding?.profile}</span>
            </div>
            {decision?.summary && <p className="text-sm text-text-dim mt-3">{decision.summary}</p>}
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Health" value={report.health?.health_score} sub={`Grade ${report.health?.grade || ""}`} />
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
                  {c.cause} <span className="text-text-mute text-xs">({c.evidence})</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Founder strategy">
              <ul className="space-y-1 text-sm">
                {(report.founder_strategy?.recommendations || []).map((x: any, i: number) => (
                  <li key={i}>• <span className="text-aqua">{x.area}</span> — {x.action}</li>
                ))}
              </ul>
            </Card>
            <Card title="Investor & CFO view">
              <p className="text-sm">Investor: <b>{report.investor?.would_invest ? "Would invest" : "Pass for now"}</b> ({Math.round((report.investor?.confidence || 0) * 100)}%)</p>
              <p className="text-sm text-text-dim mt-1">{report.investor?.thesis}</p>
              <p className="text-sm mt-3">CFO: runway <b>{report.financial_risk?.runway_months}mo</b> · risk <Pill tone={report.financial_risk?.risk_level === "low" ? "good" : "warn"}>{report.financial_risk?.risk_level}</Pill></p>
              <p className="text-sm text-text-dim mt-1">{report.financial_risk?.recommendation}</p>
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
            <div className="mt-2 space-y-1 text-xs text-text-dim max-h-48 overflow-y-auto">
              {(report.debate?.transcript || []).map((m: any, i: number) => (
                <div key={i}><b className="text-text">R{m.round} {m.role}:</b> {m.message}</div>
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
      {sub && <div className="text-xs text-text-mute">{sub}</div>}
    </Card>
  );
}
