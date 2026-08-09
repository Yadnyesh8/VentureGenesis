"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Loading, ErrorBox, PageHeader, Pill, useAgent } from "@/components/ui";

const VERDICT_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  promising: "good",
  conditional: "warn",
  weak: "bad",
};

const SCORE_LABELS: Record<string, string> = {
  novelty: "Novelty",
  demand_evidence: "Demand evidence",
  defensibility: "Defensibility",
  execution_realism: "Execution realism",
};

function scoreColour(v: number) {
  if (v >= 70) return "var(--signal)";
  if (v >= 45) return "var(--amber)";
  return "var(--coral)";
}

/** Horizontal score bar. The figure is always rendered, so the bar is decoration
 *  on top of a number rather than the only way to read the value. */
function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-dim">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-text">{v}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreColour(v) }} />
      </div>
    </div>
  );
}

function List({ items, tone }: { items?: string[]; tone?: "good" | "bad" }) {
  if (!items?.length) return <p className="text-sm text-text-faint">Nothing recorded.</p>;
  const mark = tone === "good" ? "var(--signal)" : tone === "bad" ? "var(--coral)" : "var(--text-faint)";
  return (
    <ul className="space-y-2.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-text-dim">
          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: mark }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function IdeaPage() {
  const { ref, metrics } = useStore();
  const r = ref();
  const hasIdea = Boolean((metrics.description || "").trim());

  // Only run the loop when there is something to assess. Hooks can't sit behind
  // the early return below, so without `enabled` this would still fire and the
  // page would render a 422 as an error instead of the empty state.
  const { data, loading, error } = useAgent(
    () => api.idea(r),
    [JSON.stringify(r)],
    "idea",
    { enabled: hasIdea }
  );

  const d = hasIdea ? data?.data : null;
  const analysis = d?.analysis ?? {};
  const loop = d?.loop;
  const scores: Record<string, number> = d?.scores ?? {};
  const verdict = String(d?.verdict ?? "");

  if (!hasIdea) {
    return (
      <div>
        <PageHeader
          title="Idea Diligence"
          desc="Assesses the idea itself: what already exists like it, what is genuinely different, and whether it holds up."
        />
        <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <p className="text-[17px] font-semibold text-text">No idea summary yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-mute">
            Every other module reads your numbers. This one reads your idea — add a sentence or two
            describing what you are building and who it is for.
          </p>
          <Link href="/onboarding" className="btn mt-5 inline-flex">
            Add your idea
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Idea Diligence"
        desc="Assesses the idea itself: what already exists like it, what is genuinely different, and whether it holds up."
      />

      {error && <ErrorBox error={error} />}

      {loading ? (
        <Loading label="Running the analyse / review loop — this takes a few minutes on the free tier" />
      ) : d ? (
        <div className="space-y-4">
          {/* Verdict */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2.5">
                  <Pill tone={VERDICT_TONE[verdict] || "neutral"}>{verdict || "—"}</Pill>
                  {loop && (
                    <span className="text-xs text-text-faint">
                      {loop.rounds_run} of {loop.max_rounds} rounds · {loop.stopped_because}
                    </span>
                  )}
                </div>
                <p className="max-w-2xl text-[15px] leading-relaxed text-text-dim">{d.summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="stat" style={{ color: scoreColour(d.viability_score ?? 0) }}>
                  {Math.round(d.viability_score ?? 0)}
                </div>
                <div className="mt-1 text-xs text-text-faint">Viability / 100</div>
              </div>
            </div>

            {Object.keys(scores).length > 0 && (
              <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {Object.entries(scores).map(([k, v]) => (
                  <ScoreBar key={k} label={SCORE_LABELS[k] || k} value={Number(v) || 0} />
                ))}
              </div>
            )}
          </Card>

          {/* What already exists */}
          <Card title="Products that already do this">
            {analysis.similar_products?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.similar_products.map((p: any, i: number) => (
                  <div key={i} className="rounded-xl border border-line bg-surface2 p-3.5">
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-text">{p.name}</span>
                      {typeof p.confidence === "number" && (
                        <span className="shrink-0 text-xs tabular-nums text-text-faint">
                          {Math.round(p.confidence * 100)}% confident
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-text-mute">{p.what_it_does}</p>
                    {p.overlap && (
                      <p className="mt-2 text-sm leading-relaxed text-text-dim">
                        <span className="text-text-faint">Overlap: </span>
                        {p.overlap}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-mute">
                No comparable products were named with confidence. That is a finding, not an absence of
                one — treat it as a prompt to search harder rather than proof the space is empty.
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Genuinely differentiated">
              <List items={analysis.differentiation} tone="good" />
            </Card>
            <Card title="Not actually differentiating">
              <List items={analysis.weak_differentiators} tone="bad" />
            </Card>
          </div>

          {/* Assumptions */}
          <Card title="Assumptions the idea rests on">
            {analysis.key_assumptions?.length ? (
              <ul className="space-y-3.5">
                {analysis.key_assumptions.map((a: any, i: number) => (
                  <li key={i} className="border-t border-line pt-3.5 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="font-medium text-text">{a.assumption}</span>
                      {a.testable_in_weeks != null && (
                        <span className="shrink-0 text-xs text-text-faint">
                          testable in ~{a.testable_in_weeks}w
                        </span>
                      )}
                    </div>
                    {a.why_it_matters && (
                      <p className="mt-1 text-sm leading-relaxed text-text-mute">{a.why_it_matters}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-faint">Nothing recorded.</p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="The case for">
              <List items={d.the_case_for} tone="good" />
            </Card>
            <Card title="The case against">
              <List items={d.the_case_against} tone="bad" />
            </Card>
          </div>

          {d.next_test && (
            <Card title="Cheapest next test">
              <p className="text-sm leading-relaxed text-text-dim">{d.next_test}</p>
            </Card>
          )}

          {analysis.risks?.length > 0 && (
            <Card title="Risks">
              <List items={analysis.risks} tone="bad" />
            </Card>
          )}

          {/* The loop, shown rather than asserted */}
          {loop?.trace?.length > 0 && (
            <Card title="How the loop ran">
              <p className="mb-4 text-sm leading-relaxed text-text-mute">
                Each pass is reviewed before it is accepted. The loop stops when the reviewer is
                satisfied, so a muddy idea earns more scrutiny than a clear one.
              </p>
              <ol className="space-y-3.5">
                {loop.trace.map((t: any) => (
                  <li key={t.round} className="border-t border-line pt-3.5 first:border-0 first:pt-0">
                    <div className="mb-1 flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-text">Round {t.round}</span>
                      <Pill tone={t.sufficient ? "good" : "warn"}>
                        {t.sufficient ? "accepted" : "sent back"}
                      </Pill>
                    </div>
                    {t.reason && <p className="text-sm leading-relaxed text-text-mute">{t.reason}</p>}
                    {t.gaps?.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {t.gaps.map((g: string, i: number) => (
                          <li key={i} className="flex gap-2.5 text-sm text-text-dim">
                            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
