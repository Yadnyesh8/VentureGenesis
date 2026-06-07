"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, useAgent } from "@/components/ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from "recharts";
import { CHART, axisProps, ANIM, riskColor } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function FailurePage() {
  const { ref } = useStore();
  const r = ref();
  const fail = useAgent(() => api.failure(r), [JSON.stringify(r)]);
  const d = fail.data?.data;
  const shap = (d?.feature_importance || []).map((x: any) => ({ name: x.feature, value: x.impact }));

  return (
    <div>
      <PageHeader title="Failure Prediction" desc="XGBoost + LightGBM ensemble with SHAP explainability (rule-based fallback)." />
      {fail.error && <ErrorBox error={fail.error} />}
      {fail.loading ? <Loading /> : d && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Metric label="6-month" value={fmtPct(d.failure_6m)} tone={d.failure_6m < 0.35 ? "good" : d.failure_6m < 0.6 ? "warn" : "bad"} />
            <Metric label="12-month" value={fmtPct(d.failure_12m)} tone={d.failure_12m < 0.35 ? "good" : d.failure_12m < 0.6 ? "warn" : "bad"} />
            <Metric label="24-month" value={fmtPct(d.failure_24m)} tone={d.failure_24m < 0.35 ? "good" : d.failure_24m < 0.6 ? "warn" : "bad"} />
          </div>
          <Card title="SHAP feature importance" right={<Pill tone={d.shap_available ? "good" : "neutral"}>{d.shap_available ? "SHAP" : "FEATURE WEIGHTS"}</Pill>}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={shap} layout="vertical" margin={{ left: 30, right: 20 }}>
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" width={120} {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<InstrumentTooltip />} />
                <ReferenceLine x={0} stroke={CHART.axis} strokeDasharray="2 6" />
                <Bar dataKey="value" radius={[4, 4, 4, 4]} {...ANIM}>
                  {shap.map((c: any, i: number) => (
                    <Cell key={i} fill={c.value >= 0 ? CHART.bad : CHART.aqua} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="label-mono mt-3">RISK-INCREASING (CORAL) · RISK-REDUCING (AQUA)</div>
            {d.model_base_probability != null && (
              <div className="text-[13px] text-text-dim mt-2">
                Model base {fmtPct(d.model_base_probability)} · financial adj {d.financial_adjustment >= 0 ? "+" : ""}{(d.financial_adjustment * 100).toFixed(1)}%
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
