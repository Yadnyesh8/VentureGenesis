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
  Founder: "#34E1D2", Investor: "#7C6CFF", Financial: "#C2F24A", Customer: "#FF4FA3", Market: "#FFB13C", Competitor: "#FF5D5D",
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
                  const hex = ROLE_HEX[m.role] || "#34E1D2";
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
                          <span className="label-mono text-[9px] ml-auto text-text-faint">ROUND {m.round}</span>
                        </div>
                        <div className="text-sm text-text-dim leading-relaxed">{m.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {decision && (
              <Card title="Board verdict" className="glow-aqua">
                <div className="text-center mb-5 py-2">
                  <div className="display-hero !bg-none text-aqua text-[clamp(38px,5.4vw,64px)]" style={{ WebkitTextFillColor: "#34E1D2", textShadow: "0 0 40px rgba(52,225,210,0.35)" }}>{decision.board_decision}</div>
                  <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full border border-line bg-surface2">
                    <span className="label-mono text-text-faint">CONFIDENCE</span>
                    <span className="label-mono text-aqua">{Math.round((decision.confidence || 0) * 100)}%</span>
                  </div>
                  <div className="tick-ruler mt-4 mx-auto w-1/2" />
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
