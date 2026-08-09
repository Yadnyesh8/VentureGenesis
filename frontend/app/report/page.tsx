"use client";
import { useStore } from "@/lib/store";
import { Card, PageHeader, fmtMoney, fmtPct } from "@/components/ui";
import AgentPipeline from "@/components/AgentPipeline";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList,
  AreaChart, Area, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

// Print-safe palette — darker/saturated so it stays legible on the white PDF page.
// (The app's neon signal hues are tuned for dark glass and wash out on paper.)
const RC = {
  good: "#15803D",    // green-700
  aqua: "#0E7490",    // cyan-700
  violet: "#6D28D9",  // violet-700
  bad: "#DC2626",     // red-600
  warn: "#B45309",    // amber-700
  neutral: "#6B7280", // gray-500
};

const lightAxis = { stroke: "#4b5563", fontSize: 11, tickLine: false, axisLine: false } as const;
const today = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const gColor = (s: number) => (s >= 75 ? RC.good : s >= 45 ? RC.aqua : RC.bad);

export default function ReportPage() {
  const { metrics, board, analysis, prewarm } = useStore();
  const report = board.report;
  const decision = board.decision;
  const running = analysis.status === "running";

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Executive Report"
          desc="Compiled from your board analysis — every agent already ran during launch."
          action={
            <div className="flex gap-2">
              <button className="btn" onClick={prewarm} disabled={running}>{running ? "Compiling…" : report ? "Re-run" : "Generate report"}</button>
              {report && <button className="btn-ghost" onClick={() => window.print()}>Download PDF</button>}
            </div>
          }
        />
        {board.steps.length > 0 && !report && <Card><AgentPipeline steps={board.steps} /></Card>}
        {!report && board.steps.length === 0 && (
          <Card><div className="text-text-dim text-sm">Click "Generate report" to run all agents and compile your executive document.</div></Card>
        )}
      </div>

      {report && <ReportDocument report={report} decision={decision} metrics={metrics} />}
    </div>
  );
}

function ReportDocument({ report, decision, metrics }: any) {
  const health = report.health || {};
  const pillars = Object.entries(health.components || {}).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v as number }));
  const fc = report.forecast || {};
  const hist = (fc.series || []).map((v: number, i: number) => ({ x: `H${i + 1}`, history: v }));
  const proj = (fc.projection || []).map((v: number, i: number) => ({ x: `+${i + 1}`, forecast: v }));
  const fcChart = [...hist, ...proj];
  const fail = report.failure || {};

  return (
    <div className="mt-2">
      {/* ───────── PAGE 1 — COVER ───────── */}
      <section className="sheet">
        <div className="flex items-center justify-between">
          <div className="doc-label">VENTUREGENESIS · BOARD INTELLIGENCE REPORT</div>
          <div className="doc-label">CONFIDENTIAL</div>
        </div>
        <div className="doc-strong-rule" />
        <div className="mt-10">
          <div className="doc-label">PREPARED FOR</div>
          <h1 className="text-5xl mt-1">{metrics.startup_name || "Startup"}</h1>
          <div className="text-sm text-gray-500 mt-2">
            {report.understanding?.industry || metrics.industry} · {report.understanding?.business_model || metrics.business_model} · {report.understanding?.stage || metrics.stage}
            {metrics.founding_year ? ` · est. ${metrics.founding_year}` : ""}
          </div>
        </div>

        <div className="mt-16 border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
          <div className="doc-label">BOARD VERDICT</div>
          <div className="text-6xl font-black tracking-tight mt-2" style={{ color: "#14181f", fontFamily: "var(--font-display)" }}>
            {decision?.board_decision || "—"}
          </div>
          <div className="doc-label mt-2">CONFIDENCE {Math.round((decision?.confidence || 0) * 100)}%</div>
        </div>

        {decision?.summary && <p className="text-[15px] leading-relaxed text-gray-700 mt-8">{decision.summary}</p>}

        <div className="grid grid-cols-4 gap-4 mt-10">
          {[
            ["Health", health.health_score ?? "—", health.grade ? `Grade ${health.grade}` : ""],
            ["12m Failure risk", fmtPct(fail.failure_12m), ""],
            ["Funding probability", fmtPct(report.funding?.funding_probability), ""],
            ["12m Revenue", fmtMoney(fc.forecast_12m), ""],
          ].map(([l, v, s]: any) => (
            <div key={l} className="border-t-2 border-gray-900 pt-2">
              <div className="doc-label">{l}</div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{v}</div>
              {s && <div className="text-[11px] text-gray-500">{s}</div>}
            </div>
          ))}
        </div>

        <div className="absolute" />
        <div className="mt-20 doc-rule" />
        <div className="flex justify-between doc-label">
          <span>GENERATED {today()}</span>
          <span>VENTUREGENESIS AI BOARD</span>
        </div>
      </section>

      {/* ───────── PAGE 2 — DIAGNOSTICS ───────── */}
      <section className="sheet">
        <div className="doc-label">SECTION 01</div>
        <h2 className="text-3xl">Diagnostics</h2>
        <div className="doc-strong-rule" />

        <h3 className="text-xl mb-1">Startup Health — {health.health_score ?? "—"}/100 (Grade {health.grade || "—"})</h3>
        <p className="text-sm text-gray-600 mb-3">Weighted composite across five pillars.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pillars} layout="vertical" margin={{ left: 40, right: 40 }}>
            <XAxis type="number" domain={[0, 100]} {...lightAxis} />
            <YAxis type="category" dataKey="name" width={120} {...lightAxis} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} isAnimationActive={false}>
              {pillars.map((p, i) => <Cell key={i} fill={gColor(p.value)} />)}
              <LabelList dataKey="value" position="right" style={{ fill: "#14181f", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="doc-rule" />
        <div className="grid grid-cols-3 gap-6 my-2">
          {[["6-month", fail.failure_6m], ["12-month", fail.failure_12m], ["24-month", fail.failure_24m]].map(([l, v]: any) => (
            <div key={l}>
              <div className="doc-label">{l} failure risk</div>
              <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: v < 0.35 ? RC.good : v < 0.6 ? RC.warn : RC.bad }}>{fmtPct(v)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">{fail.method}</p>

        <div className="doc-rule" />
        <h3 className="text-xl mb-1">Revenue Forecast</h3>
        <p className="text-sm text-gray-600 mb-3">3m {fmtMoney(fc.forecast_3m)} · 6m {fmtMoney(fc.forecast_6m)} · 12m {fmtMoney(fc.forecast_12m)}</p>
        {fcChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fcChart}>
              <defs>
                <linearGradient id="rh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RC.aqua} stopOpacity={0.28} /><stop offset="100%" stopColor={RC.aqua} stopOpacity={0.02} /></linearGradient>
                <linearGradient id="rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RC.violet} stopOpacity={0.28} /><stop offset="100%" stopColor={RC.violet} stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="x" {...lightAxis} />
              <YAxis {...lightAxis} tickFormatter={fmtMoney} width={54} />
              <ReferenceLine x={`H${hist.length}`} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: "NOW", fill: "#6b7280", fontSize: 10, position: "top" }} />
              <Area type="monotone" dataKey="history" stroke={RC.aqua} fill="url(#rh)" strokeWidth={2.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="forecast" stroke={RC.violet} fill="url(#rf)" strokeWidth={2.5} strokeDasharray="5 4" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-400">No revenue series available.</p>}
      </section>

      {/* ───────── PAGE 3 — INTELLIGENCE ───────── */}
      <section className="sheet">
        <div className="doc-label">SECTION 02</div>
        <h2 className="text-3xl">Intelligence</h2>
        <div className="doc-strong-rule" />

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg mb-1">Investor (VC)</h3>
            <p className="text-sm"><b>{report.investor?.would_invest ? "Would invest" : "Pass for now"}</b> · {Math.round((report.investor?.confidence || 0) * 100)}% confidence</p>
            <p className="text-sm text-gray-600 mt-1">{report.investor?.thesis}</p>
          </div>
          <div>
            <h3 className="text-lg mb-1">Financial Risk (CFO)</h3>
            <p className="text-sm">Runway <b>{report.financial_risk?.runway_months} mo</b> · risk <b>{report.financial_risk?.risk_level}</b></p>
            <p className="text-sm text-gray-600 mt-1">{report.financial_risk?.recommendation}</p>
          </div>
        </div>

        <div className="doc-rule" />
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg mb-1">Competitor — threat {report.competitor?.threat_score}/100</h3>
            <ul className="text-sm text-gray-700 list-disc pl-4 space-y-1">
              {(report.competitor?.competitive_gap || []).slice(0, 4).map((g: string, i: number) => <li key={i}>{g}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-lg mb-1">Market — opportunity {report.market?.opportunity_score}/100</h3>
            <p className="text-sm text-gray-700">Recommended: <b>{report.market?.recommended_market}</b></p>
            <ul className="text-sm text-gray-700 list-disc pl-4 space-y-1 mt-1">
              {(report.market?.trends || []).slice(0, 4).map((t: string, i: number) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>

        <div className="doc-rule" />
        <div>
          <h3 className="text-lg mb-1">Root causes of risk</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            {(report.root_cause?.causes || []).slice(0, 5).map((c: any, i: number) => (
              <li key={i}><b className="uppercase text-[10px] text-gray-500">{c.impact}</b> — {c.cause}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── PAGE 4 — STRATEGY & VERDICT ───────── */}
      <section className="sheet">
        <div className="doc-label">SECTION 03</div>
        <h2 className="text-3xl">Strategy &amp; Verdict</h2>
        <div className="doc-strong-rule" />

        <div className="grid grid-cols-2 gap-8">
          <DocList title="Strategic actions" items={decision?.strategic_actions} />
          <DocList title="Growth roadmap" items={decision?.growth_roadmap} />
          <DocList title="Risk mitigation" items={decision?.risk_mitigation} />
          <div>
            <div className="doc-label mb-1">Founder strategy</div>
            <ul className="text-sm text-gray-700 space-y-1">
              {(Array.isArray(report.founder_strategy?.recommendations) ? report.founder_strategy.recommendations : []).slice(0, 4).map((x: any, i: number) => (
                <li key={i}><b>{x.area}</b> — {x.action}</li>
              ))}
            </ul>
          </div>
        </div>

        {decision?.funding_strategy && (
          <>
            <div className="doc-rule" />
            <div className="doc-label mb-1">Funding strategy</div>
            <p className="text-sm text-gray-700">{decision.funding_strategy}</p>
          </>
        )}

        <div className="mt-10 border border-gray-200 rounded-lg p-6 bg-gray-50 flex items-center justify-between">
          <div>
            <div className="doc-label">FINAL BOARD VERDICT · DEBATE CONSENSUS: {(report.debate?.consensus || "—").toUpperCase()}</div>
            <div className="text-4xl font-black mt-1" style={{ fontFamily: "var(--font-display)" }}>{decision?.board_decision}</div>
          </div>
          <div className="text-right">
            <div className="doc-label">CONFIDENCE</div>
            <div className="text-4xl font-black" style={{ fontFamily: "var(--font-display)", color: gColor((decision?.confidence || 0) * 100) }}>
              {Math.round((decision?.confidence || 0) * 100)}%
            </div>
          </div>
        </div>

        <div className="mt-10 doc-rule" />
        <div className="flex justify-between doc-label">
          <span>VENTUREGENESIS · GENERATED {today()}</span>
          <span>END OF REPORT</span>
        </div>
      </section>
    </div>
  );
}

function DocList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="doc-label mb-1">{title}</div>
      <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
