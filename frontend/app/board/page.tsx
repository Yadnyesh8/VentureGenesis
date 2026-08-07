"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Card, PageHeader, Pill } from "@/components/ui";
import AgentPipeline from "@/components/AgentPipeline";
import { TraceGlyph } from "@/components/instrument";

// Professional monogram codes (no emoji) + fixed accent per role.
const ROLE_CODE: any = {
  Founder: "FND", Investor: "INV", Financial: "CFO", Customer: "CX", Market: "MKT", Competitor: "CMP",
};
const ROLE_HEX: Record<string, string> = {
  Founder: "var(--aqua)", Investor: "var(--signal)", Financial: "var(--amber)", Customer: "var(--coral)", Market: "var(--text-mute)", Competitor: "var(--text-faint)",
};

export default function BoardPage() {
  const { board, analysis, prewarm } = useStore();
  const { steps, messages, decision } = board;
  const running = analysis.status === "running";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the debate as statements stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div>
      <PageHeader
        title="Board of Directors"
        desc="Your full board — every agent already ran during launch. Re-run any time to refresh the deliberation."
        action={
          <button className="btn" onClick={prewarm} disabled={running}>
            {running ? "Deliberating…" : board.ran ? "Re-run board" : "Convene the Board"}
          </button>
        }
      />

      {steps.length === 0 && !running && (
        <Card hover={false}>
          <div className="flex items-start gap-4 py-2">
            <span className="grid place-items-center w-11 h-11 rounded-xl border border-line bg-surface2 shrink-0">
              <TraceGlyph size={22} animated />
            </span>
            <div>
              <div className="title-display text-lg">No deliberation yet</div>
              <div className="text-text-dim text-sm mt-1 max-w-xl">Click <span className="text-text">Convene the Board</span> to run all agents live — each lights up as it works and the boardroom debate streams in real time.</div>
            </div>
          </div>
        </Card>
      )}

      {steps.length > 0 && (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <AgentPipeline steps={steps} />
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Card
              title={`Boardroom debate`}
              right={
                <div className="flex items-center gap-2">
                  {running && <span className="flex items-center gap-1.5 label-mono text-amber"><span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />LIVE</span>}
                  {messages.length > 0 && <Pill tone="neutral">{messages.length} statements</Pill>}
                </div>
              }
            >
              <div ref={scrollRef} className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1.5 -mr-1">
                {messages.length === 0 && <div className="text-text-mute text-sm label-mono py-6 text-center">AWAITING DEBATE…</div>}
                {messages.map((m, i) => {
                  const hex = ROLE_HEX[m.role] || "var(--aqua)";
                  return (
                    <div key={i} className="flex gap-3 animate-fadeIn">
                      <div className="w-11 h-11 shrink-0 rounded-xl border bg-surface grid place-items-center" style={{ borderColor: `${hex}55` }}>
                        <span className="title-display text-[12px] leading-none" style={{ color: hex }}>{ROLE_CODE[m.role] || "AGT"}</span>
                      </div>
                      <div className="flex-1 bg-surface2 border border-line rounded-2xl rounded-tl-md p-3.5 relative">
                        <span className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full" style={{ background: hex, opacity: 0.6 }} />
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-sm">{m.role}</span>
                          <Pill tone={m.stance} dot>{m.stance}</Pill>
                          {m.computed_stance && m.computed_stance !== m.stance && (
                            <span className="label-mono text-[9px] text-amber" title={m.computed_why}>
                              ↳ MOVED OFF {m.computed_stance.toUpperCase()}
                            </span>
                          )}
                          {m.computed_stance && m.computed_stance === m.stance && (
                            <span className="label-mono text-[9px] text-text-faint" title={m.computed_why}>
                              ✓ COMPUTED
                            </span>
                          )}
                          <span className="label-mono text-[9px] ml-auto text-text-faint">ROUND {m.round}</span>
                        </div>
                        <div className="text-sm text-text-dim leading-relaxed">{m.message}</div>
                        {m.lens && m.lens.focus && <LensChips lens={m.lens} hex={hex} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {decision && (
              <Card title="Board verdict">
                <div className="text-center mb-5 py-2">
                  <div className="display-hero text-aqua text-[clamp(38px,5.4vw,64px)]">{decision.board_decision}</div>
                  <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full border border-line bg-surface2">
                    <span className="label-mono text-text-faint">CONFIDENCE</span>
                    <span className="label-mono text-aqua">{Math.round((decision.confidence || 0) * 100)}%</span>
                  </div>
                </div>
                <Section title="Strategic actions" items={decision.strategic_actions} />
                <Section title="Growth roadmap" items={decision.growth_roadmap} />
                <Section title="Risk mitigation" items={decision.risk_mitigation} />
                {decision.funding_strategy && (
                  <div className="mt-2"><div className="card-h">Funding strategy</div><p className="text-sm text-text-dim">{decision.funding_strategy}</p></div>
                )}
                {decision.summary && <p className="text-xs text-text-mute border-t border-line pt-2 mt-2">{decision.summary}</p>}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders an agent's specialist lens — the distinct quantitative inputs it reasoned over —
// as compact chips, so the boardroom visibly shows each agent works from different numbers.
const LENS_SKIP = new Set(["focus", "read", "basis", "industry", "stage"]);
const LENS_LABELS: Record<string, string> = {
  capital_efficiency_arr_per_$: "cap. efficiency", valuation_to_revenue_multiple: "val/rev ×",
  implied_dilution_pct: "dilution %", burn_multiple: "burn ×", net_margin: "net margin",
  runway_months: "runway mo", default_alive: "default-alive", tam_usd: "TAM",
  current_share_of_sam_pct: "share of SAM %", moat_proxy: "moat", funding_vs_stage_peer_x: "funding vs peers ×",
  competitive_density: "density", hiring_velocity_per_year: "hires/yr", arpu_annual_usd: "ARPU",
  churn_implied_lifetime_months: "lifetime mo", nrr_proxy: "NRR", ltv_usd: "LTV",
  age_vs_stage_gap_years: "stage gap yr", yoy_growth_pct: "growth %",
};
const fmtLensVal = (v: any): string => {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v !== "number") return String(v);
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `$${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
};

function LensChips({ lens, hex }: { lens: Record<string, any>; hex: string }) {
  const entries = Object.entries(lens)
    .filter(([k, v]) => !LENS_SKIP.has(k) && v != null)
    .slice(0, 4);
  return (
    <div className="mt-2.5 pt-2.5 border-t border-line/60">
      <div className="label-mono text-[9px] text-text-faint mb-1.5">SPECIALIST LENS · {String(lens.focus).toUpperCase()}</div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: `${hex}40`, background: `${hex}10` }}>
            <span className="text-text-faint">{LENS_LABELS[k] || k.replace(/_/g, " ")}</span>
            <b style={{ color: hex }}>{fmtLensVal(v)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mb-2">
      <div className="card-h">{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm flex gap-2"><span className="text-violet">•</span>{it}</li>
        ))}
      </ul>
    </div>
  );
}
