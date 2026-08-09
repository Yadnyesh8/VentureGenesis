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

  // This is the most call-hungry agent in the app — several sequential model
  // calls plus live search — so it never starts on its own. `enabled: false`
  // holds it until the founder asks for it; a cached result from an earlier run
  // still shows immediately.
  const { data, loading, error, refetch } = useAgent(
    () => api.idea(r),
    [JSON.stringify(r)],
    "idea",
    { enabled: false }
  );

  const d = hasIdea ? data?.data : null;
  const analysis = d?.analysis ?? {};
  const loop = d?.loop;
  const evidence = d?.evidence;
  const scores: Record<string, number> = d?.scores ?? {};
  const verdict = String(d?.verdict ?? "");
  // Anything other than the untouched state means the run has been asked for.
  const started = loading || Boolean(d) || Boolean(error);

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

      {!started ? (
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-text">Run idea diligence</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-mute">
            The agent analyses your idea, searches for products that already do it, then reviews
            its own work and refines until the review passes. You will get comparable products,
            what is genuinely differentiated, the assumptions the idea rests on, and a verdict.
          </p>

          <div className="mt-5 rounded-xl border border-amber/40 p-4" style={{ background: "var(--amber-12)" }}>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" />
              <span className="text-sm font-semibold text-amber">This one is slow</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
              It makes several model calls in sequence rather than one, so expect{" "}
              <strong className="text-text">two to four minutes</strong> — longer if the backend is
              waking up. Leave the tab open. The result is kept, so you only pay this once per
              profile.
            </p>
          </div>

          <button type="button" onClick={refetch} className="btn mt-5">
            Run idea diligence
          </button>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <Loading label="Analysing, searching, then reviewing its own work" />
          <p className="max-w-xl text-sm leading-relaxed text-text-mute">
            Several model calls run in sequence. Two to four minutes is normal — this is not stuck.
          </p>
        </div>
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
                  <button type="button" onClick={refetch} className="btn-ghost !px-2.5 !py-1 text-xs">
                    Run again
                  </button>
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

          {/* Where the comparables came from. A verdict grounded in live search
              is a different thing from one drawn out of recall, and the founder
              should be able to tell which they are holding. */}
          {evidence && (
            <Card title="What this was based on">
              {evidence.available ? (
                <p className="text-sm leading-relaxed text-text-dim">
                  Grounded in <strong className="text-text">{evidence.results_count} live search result
                  {evidence.results_count === 1 ? "" : "s"}</strong>
                  {evidence.spend_usd > 0 && <> · ${evidence.spend_usd.toFixed(3)} spent</>}.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-text-dim">
                  <strong className="text-amber">No live search ran</strong>, so the comparables below
                  come from the model&apos;s own knowledge and may be out of date or incomplete. Treat the
                  confidence figures as the model&apos;s self-assessment, not verification.
                  {evidence.reason && (
                    <span className="mt-1.5 block text-xs text-text-faint">Reason: {evidence.reason}</span>
                  )}
                </p>
              )}
              {evidence.queries?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {evidence.queries.map((q: string, i: number) => (
                    <span key={i} className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-xs text-text-mute">
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

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
