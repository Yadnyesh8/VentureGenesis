"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, useAgent } from "@/components/ui";
import Gauge from "@/components/Gauge";
import { gradeColor } from "@/lib/chartTheme";

export default function MarketPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.market(r), [JSON.stringify(r)]);
  const d = data?.data;
  const opp = d?.opportunity_score ?? 0;

  return (
    <div>
      <PageHeader title="Market Opportunity" desc="Industry trends, emerging tech and demand analysis." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading /> : d && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Opportunity score">
            <Gauge value={opp} color={gradeColor(opp)} unit="OPPORTUNITY / 100" decimals={1} />
            <div className="text-center mt-3 text-sm text-text-dim">Recommended market: <Pill tone="aqua">{d.recommended_market}</Pill></div>
          </Card>
          <Card title="Key trends">
            <ul className="space-y-2">
              {(d.trends || []).map((t: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm"><span className="text-good">▲</span> {t}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
