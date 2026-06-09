"use client";
import { useRef, useState } from "react";
import { streamBoard } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, PageHeader, Pill } from "@/components/ui";
import AgentPipeline, { StepState } from "@/components/AgentPipeline";

// Professional monogram codes (no emoji).
const ROLE_CODE: any = {
  Founder: "FND", Investor: "INV", Financial: "CFO", Customer: "CX", Market: "MKT", Competitor: "CMP",
};

export default function BoardPage() {
  const { ref } = useStore();
  const [steps, setSteps] = useState<StepState[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [decision, setDecision] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  function patch(key: string, updates: Partial<StepState>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...updates } : s)));
  }

  async function convene() {
    setMessages([]);
    setDecision(null);
    setRunning(true);
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      await streamBoard(ref(), (ev) => {
        switch (ev.type) {
          case "start":
            setSteps(ev.steps.map((s: any) => ({ ...s, status: "pending" })));
            break;
          case "agent_start":
            patch(ev.key, { status: "running" });
            break;
          case "agent_done":
            patch(ev.key, { status: "done", ms: ev.ms });
            if (ev.key === "board") setDecision(ev.result);
            break;
          case "agent_error":
            patch(ev.key, { status: "error", ms: ev.ms });
            break;
          case "debate_message":
            setMessages((m) => [...m, ev]);
            setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 40);
            break;
          case "complete":
            if (ev.decision) setDecision(ev.decision);
            break;
        }
      });
    } catch (e) {
      /* surfaced via step error states */
    } finally {
      clearInterval(timerRef.current);
      setRunning(false);
    }
  }

  const fmtT = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        title="Board of Directors"
        desc="Every agent runs live (real LLM calls). This genuinely takes a few minutes — watch each agent work."
        action={
          <button className="btn" onClick={convene} disabled={running}>
            {running ? `Deliberating · ${fmtT}` : "Convene the Board"}
          </button>
        }
      />

      {steps.length === 0 && !running && (
        <Card><div className="text-text-dim text-sm">Click "Convene the Board" to run all 16 agents live. Each lights up as it works; the boardroom debate streams in real time.</div></Card>
      )}

      {steps.length > 0 && (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <AgentPipeline steps={steps} />
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Card title={`Boardroom debate ${running ? "· live" : ""}`} right={messages.length > 0 && <Pill tone="neutral">{messages.length} statements</Pill>}>
              <div ref={scrollRef} className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {messages.length === 0 && <div className="text-text-mute text-sm label-mono">AWAITING DEBATE…</div>}
                {messages.map((m, i) => (
                  <div key={i} className="flex gap-3 animate-[fadeIn_0.3s_ease]">
                    <div className="w-11 h-11 shrink-0 rounded-lg border border-line bg-surface grid place-items-center">
                      <span className="title-display text-[12px] text-aqua leading-none">{ROLE_CODE[m.role] || "AGT"}</span>
                    </div>
                    <div className="flex-1 bg-surface2 border border-line rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{m.role}</span>
                        <Pill tone={m.stance}>{m.stance}</Pill>
                        <span className="label-mono text-[9px] ml-auto">ROUND {m.round}</span>
                      </div>
                      <div className="text-sm text-text">{m.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {decision && (
              <Card title="Board verdict">
                <div className="text-center mb-3">
                  <div className="display-hero text-aqua text-[clamp(36px,5vw,60px)]">{decision.board_decision}</div>
                  <div className="label-mono mt-1">CONFIDENCE {Math.round((decision.confidence || 0) * 100)}%</div>
                  <div className="tick-ruler mt-3 mx-auto w-1/2" />
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
