"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, useAgent } from "@/components/ui";
import Gauge from "@/components/Gauge";
import { CHART } from "@/lib/chartTheme";

export default function CompetitorPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.competitor(r), [JSON.stringify(r)]);
  const d = data?.data;
  const threat = d?.threat_score ?? 0;

  return (
    <div>
      <PageHeader title="Competitor Intelligence" desc="Threat scoring across features, pricing, funding, market position." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading /> : d && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Threat level">
            <Gauge value={threat} color={threat < 40 ? CHART.good : threat < 70 ? CHART.warn : CHART.bad} unit="THREAT / 100" decimals={1} />
            <p className="text-sm text-text-dim mt-3">{d.summary}</p>
          </Card>
          <Card title="Competitive gaps to close">
            <ul className="space-y-2">
              {(d.competitive_gap || []).map((g: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-bad">▸</span> {g}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
