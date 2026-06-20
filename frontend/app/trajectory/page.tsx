"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtPct, useAgent, CountUp } from "@/components/ui";
import { CHART } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";

export default function TrajectoryPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.causal(r), [JSON.stringify(r)], "causal");
  const d = data?.data;

  // Edges are the chain elements that carry a `from` field.
  const edges = ((d?.chain || []) as any[]).filter((c: any) => c.from);
  // Ordered node list: root node first, then each edge's target.
  const nodes: string[] = d?.chain?.length
    ? [d.chain[0].node, ...edges.map((e: any) => e.to)]
    : [];
  const maxLeverage = Math.max(1e-6, ...edges.map((e: any) => Number(e.leverage) || 0));

  return (
    <div>
      <PageHeader
        title="Causal Trajectory"
        desc="Maps the causal cascade from your current KPI deterioration to startup death — and where to cut the chain."
      />
      {error && <ErrorBox error={error} />}
      {loading ? (
        <Loading label="Tracing causal cascade…" />
      ) : d && (
        (d.chain || []).length === 0 ? (
          <Card title="No active death path" right={<Pill tone="good" dot>STABLE</Pill>}>
            <p className="text-sm text-text-dim leading-relaxed">
              {d.note || "No KPI deterioration detected — there is no active causal path to death right now."}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Metric
                label="Death probability"
                value={fmtPct(d.death_probability)}
                tone={d.death_probability > 0.4 ? "bad" : d.death_probability > 0.2 ? "warn" : "good"}
              />
              <Metric
                label="Time to death"
                value={d.months_to_death != null ? `${d.months_to_death} mo` : "—"}
              />
              <Metric label="Root cause" value={d.root_cause || "—"} tone="brand" />
              <Metric label="Engine" value={d.engine || "—"} />
            </div>

            <Card title="The kill chain" className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                {nodes.map((n: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-text-mute" aria-hidden>→</span>}
                    <div className="px-3 py-2 rounded-xl border border-line bg-surface2 text-sm">
                      {n}
                    </div>
                  </div>
                ))}
              </div>
              <div className="tick-ruler mt-4 mb-2 w-2/3" />
              <div className="text-xs text-text-dim">
                {d.months_to_death != null
                  ? <>Full cascade unfolds over <b className="text-coral">{d.months_to_death} months</b> if left uninterrupted.</>
                  : "Cascade timeline unbounded."}
              </div>
            </Card>

            <Card title="Cascade edges" className="mb-6">
              <div className="flex flex-col gap-3">
                {edges.map((e: any, i: number) => {
                  const lev = Number(e.leverage) || 0;
                  return (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-center">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span>{e.from}</span>
                        <span className="text-text-mute" aria-hidden>→</span>
                        <span>{e.to}</span>
                        <span className="label-mono text-text-dim ml-1">w {Number(e.weight).toFixed(2)}</span>
                        <span className="label-mono text-amber">+{e.lag_months}mo</span>
                      </div>
                      <div className="flex items-center gap-2 sm:w-48">
                        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: CHART.track }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, (lev / maxLeverage) * 100)}%`, background: CHART.violet }}
                          />
                        </div>
                        <span className="label-mono text-text-dim shrink-0" style={{ color: CHART.violet }}>{lev.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Intervention points" className="mb-6">
              <div className="grid lg:grid-cols-2 gap-4">
                {(d.interventions || []).map((iv: any, i: number) => (
                  <Card key={i} title={undefined} hover right={undefined}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Pill tone="warn" dot>{iv.edge}</Pill>
                      <span className="label-mono text-text-dim">
                        leverage <b className="text-amber"><CountUp value={Number(iv.leverage).toFixed(2)} /></b>
                      </span>
                    </div>
                    <p className="text-sm text-text-dim leading-relaxed">{iv.action}</p>
                  </Card>
                ))}
              </div>
            </Card>

            {(d.story || d.summary || (d.kill_chain && d.kill_chain.length) || d.earliest_intervention) && (
              <Card title="Causal narrative">
                {d.story && <p className="text-sm text-text leading-relaxed mb-3">{d.story}</p>}
                {d.summary && <p className="text-sm text-text-dim leading-relaxed mb-3">{d.summary}</p>}
                {d.kill_chain && d.kill_chain.length > 0 && (
                  <ol className="list-decimal list-inside flex flex-col gap-1.5 text-sm text-text-dim mb-3">
                    {d.kill_chain.map((step: any, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
                {d.earliest_intervention && (
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="label-mono text-text-dim">Earliest cut:</span>
                    <Pill tone="good" dot>{d.earliest_intervention}</Pill>
                  </div>
                )}
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}
