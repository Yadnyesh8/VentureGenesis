"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, useAgent } from "@/components/ui";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import { CHART, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

const COLORS: any = { positive: CHART.good, neutral: CHART.axis, negative: CHART.bad };

export default function CustomerPage() {
  const { ref, reviews, setReviews } = useStore();
  const [draft, setDraft] = useState(reviews.join("\n"));
  const r = ref();
  const { data, loading, error, refetch } = useAgent(() => api.customer(r), [JSON.stringify(r)]);
  const sent = data?.data?.sentiment;
  const dist = sent ? Object.entries(sent.distribution).map(([k, v]) => ({ name: k, value: v as number })) : [];

  return (
    <div>
      <PageHeader title="Customer Sentiment" desc="FinBERT analyzes your customer reviews into positive / neutral / negative." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading label="ANALYZING SENTIMENT" /> : sent && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Metric label="Overall sentiment" value={sent.sentiment} tone={sent.sentiment === "positive" ? "good" : sent.sentiment === "negative" ? "bad" : "warn"} sub={sent.method} />
            <Metric label="Sentiment score" value={sent.sentiment_score ?? "—"} tone="brand" sub="-1 to +1" />
            <Metric label="Reviews analyzed" value={(sent.breakdown || []).length} tone="default" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Sentiment distribution">
              {dist.length > 0 && sent.sentiment !== "no_data" ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={dist} dataKey="value" nameKey="name" innerRadius={66} outerRadius={100} paddingAngle={4} stroke="none" {...ANIM}>
                        {dist.map((e, i) => <Cell key={i} fill={COLORS[e.name]} />)}
                      </Pie>
                      <Tooltip content={<InstrumentTooltip />} />
                      <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-28px" }}>
                    <div className="display-stat text-3xl" style={{ color: (sent.sentiment_score ?? 0) >= 0 ? CHART.good : CHART.bad }}>
                      {sent.sentiment_score != null ? sent.sentiment_score : "—"}
                    </div>
                    <div className="label-mono mt-1">NET SENTIMENT</div>
                  </div>
                </div>
              ) : (
                <div className="label-mono py-16 text-center">NO REVIEWS PROVIDED — ADD SOME →</div>
              )}
            </Card>
            <Card title="Customer reviews (drive FinBERT)">
              <textarea
                className="input-field h-32"
                placeholder="One review per line…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="btn mt-2" onClick={() => { setReviews(draft.split("\n").filter(Boolean)); refetch(); }}>
                Analyze reviews
              </button>
              <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                {(sent.breakdown || []).map((b: any, i: number) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <Pill tone={b.sentiment === "positive" ? "good" : b.sentiment === "negative" ? "bad" : "neutral"}>{b.sentiment}</Pill>
                    <span className="text-text-dim truncate">{b.review}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
