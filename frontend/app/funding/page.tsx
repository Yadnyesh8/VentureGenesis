"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, useAgent } from "@/components/ui";
import Gauge from "@/components/Gauge";
import { gradeColor } from "@/lib/chartTheme";

export default function FundingPage() {
  const { ref } = useStore();
  const r = ref();
  const fund = useAgent(() => api.funding(r), [JSON.stringify(r)]);
  const invest = useAgent(() => api.strategy(r), [JSON.stringify(r)]); // founder strategy recs
  const d = fund.data?.data;
  const score = d?.investor_score ?? 0;

  return (
    <div>
      <PageHeader title="Funding Readiness" desc="XGBoost classifier scores investability (rule-based fallback)." />
      {fund.error && <ErrorBox error={fund.error} />}
      {fund.loading ? <Loading /> : d && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Investor score">
            <Gauge value={score} color={gradeColor(score)} unit="INVESTOR SCORE / 100" decimals={1} />
            <div className="text-center text-text-dim text-sm mt-3 flex items-center justify-center gap-2">
              Funding probability {fmtPct(d.funding_probability)} <Pill tone={d.trained ? "good" : "neutral"}>{d.trained ? "TRAINED" : "RULE-BASED"}</Pill>
            </div>
          </Card>
          <Card title="What investors want to see next">
            {invest.loading ? <Loading /> : (
              <ul className="space-y-2">
                {(invest.data?.data?.recommendations || []).map((rec: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Pill tone={rec.priority === "high" ? "bad" : rec.priority === "medium" ? "warn" : "neutral"}>{rec.priority}</Pill>
                    <span><span className="text-accent">{rec.area}</span> — {rec.action}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
