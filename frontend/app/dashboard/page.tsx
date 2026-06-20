"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, PageHeader, fmtMoney, fmtPct, useAgent, Pill } from "@/components/ui";
import Gauge from "@/components/Gauge";
import { gradeColor } from "@/lib/chartTheme";

const EXPLORE: { href: string; label: string; tag: string; tone: string }[] = [
  { href: "/failure", label: "Failure + SHAP", tag: "MODEL", tone: "coral" },
  { href: "/forecast", label: "Revenue Forecast", tag: "PROPHET", tone: "aqua" },
  { href: "/funding", label: "Funding Readiness", tag: "MODEL", tone: "signal" },
  { href: "/customer", label: "Customer Sentiment", tag: "FINBERT", tone: "violet" },
  { href: "/competitor", label: "Competitor Map", tag: "LLM", tone: "magenta" },
  { href: "/market", label: "Market Opportunity", tag: "LLM", tone: "amber" },
  { href: "/pivots", label: "Pivot Engine", tag: "LLM", tone: "violet" },
  { href: "/simulation", label: "Digital Twin", tag: "SIM", tone: "aqua" },
  { href: "/report", label: "Executive Report", tag: "DOC", tone: "signal" },
];

const TONE_HEX: Record<string, string> = {
  coral: "#FF5D5D", aqua: "#34E1D2", signal: "#C2F24A", violet: "#7C6CFF", magenta: "#FF4FA3", amber: "#FFB13C",
};

export default function Dashboard() {
  const { ref, metrics, clearProfile } = useStore();
  const r = ref();
  const key = JSON.stringify(r);
  const health = useAgent(() => api.health(r), [key], "health");
  const failure = useAgent(() => api.failure(r), [key], "failure");
  const funding = useAgent(() => api.funding(r), [key], "funding");

  const hs = health.data?.data?.health_score ?? 0;
  const f12 = failure.data?.data?.failure_12m ?? 0;
  const fp = funding.data?.data?.funding_probability ?? 0;
  const trained = failure.data?.data?.trained;

  return (
    <div>
      <PageHeader
        title={metrics.startup_name || "Command Center"}
        coord="01 · COMMAND CENTER"
        desc="Your AI board of directors — every figure is computed from your questionnaire, nothing is fabricated."
        action={<Link href="/board" className="btn">Convene the Board →</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Metric label="Health Score" value={health.loading ? "…" : `${hs}`} tone={hs >= 65 ? "good" : hs >= 45 ? "warn" : "bad"} sub="0–100 composite" />
        <Metric label="12m Failure Risk" value={failure.loading ? "…" : fmtPct(f12)} tone={f12 < 0.35 ? "good" : f12 < 0.6 ? "warn" : "bad"} sub="calibrated model" />
        <Metric label="Funding Probability" value={funding.loading ? "…" : fmtPct(fp)} tone={fp >= 0.5 ? "good" : "warn"} sub="readiness score" />
        <Metric label="Runway" value={`${metrics.runway ?? 0} mo`} tone={(metrics.runway ?? 0) >= 9 ? "good" : "bad"} sub="cash ÷ burn" />
      </div>

      {trained !== undefined && (
        <div className="mb-6 flex items-center gap-2 text-xs text-text-mute">
          <Pill tone={trained ? "good" : "neutral"} dot>{trained ? "Trained model" : "Rule-based"}</Pill>
          <span className="label-mono">{failure.data?.data?.method}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Revenue"><div className="stat">{fmtMoney(metrics.revenue || 0)}</div><div className="text-xs text-text-mute mt-1.5">Annual</div></Card>
        <Card title="Customers"><div className="stat">{(metrics.customer_count || 0).toLocaleString()}</div><div className="text-xs text-text-mute mt-1.5">Growth <span className="text-signal">{fmtPct(metrics.customer_growth || 0)}</span></div></Card>
        <Card title="Valuation"><div className="stat">{fmtMoney(metrics.valuation || 0)}</div><div className="text-xs text-text-mute mt-1.5">Raised {fmtMoney(metrics.funding_amount || 0)}</div></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Health Gauge">
          {health.loading ? <Loading label="SCORING" /> : <Gauge value={hs} color={gradeColor(hs)} unit="HEALTH / 100" height={210} />}
        </Card>
        <Card title="Explore the board" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {EXPLORE.map(({ href, label, tag, tone }) => (
              <Link
                key={href}
                href={href}
                className="group relative flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface2/50 px-3.5 py-3 hover:border-line-strong hover:bg-surface2 transition-colors min-h-[78px]"
              >
                <div className="flex items-center justify-between">
                  <span className="label-mono text-[8px]" style={{ color: TONE_HEX[tone] }}>{tag}</span>
                  <svg width="13" height="13" viewBox="0 0 16 16" className="text-text-faint group-hover:text-text transition-colors" aria-hidden>
                    <path d="M5 11 L11 5 M11 5 H6 M11 5 V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span className="text-sm text-text-dim group-hover:text-text transition-colors leading-tight">{label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-line-soft flex items-center gap-2 flex-wrap">
            <Pill dot>{metrics.industry || "—"}</Pill>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 text-sm">
          {[
            ["Revenue", fmtMoney(metrics.revenue || 0)],
            ["Expenses", fmtMoney(metrics.expenses || 0)],
            ["Monthly burn", fmtMoney(metrics.burn_rate || 0)],
            ["Runway", `${metrics.runway ?? 0} mo`],
            ["Customers", (metrics.customer_count || 0).toLocaleString()],
            ["Growth", fmtPct(metrics.customer_growth || 0)],
            ["Team", `${metrics.employee_count ?? 0}`],
            ["Industry", metrics.industry || "—"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="label-mono text-text-faint mb-1.5">{k}</div>
              <div className="font-semibold text-text">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
