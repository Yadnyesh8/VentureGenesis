"use client";
import { useRef, useState } from "react";
import { api, streamDebate } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Loading, PageHeader, Pill } from "@/components/ui";

const ROLE_ICON: any = {
  Founder: "🚀", Investor: "💼", Financial: "💰", Customer: "👥", Market: "🌐", Competitor: "⚔",
};

export default function BoardPage() {
  const { ref } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [consensus, setConsensus] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [decision, setDecision] = useState<any>(null);
  const [decLoading, setDecLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function startDebate() {
    setMessages([]);
    setConsensus(null);
    setDecision(null);
    setStreaming(true);
    setRound(0);
    try {
      await streamDebate(ref(), (ev) => {
        if (ev.type === "round_start") setRound(ev.round);
        if (ev.type === "message") {
          setMessages((m) => [...m, ev]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
        }
        if (ev.type === "consensus") setConsensus(ev.consensus);
      });
    } finally {
      setStreaming(false);
    }
  }

  async function getDecision() {
    setDecLoading(true);
    try {
      const res = await api.board(ref());
      setDecision(res.data.board_decision_obj);
    } finally {
      setDecLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Board of Directors"
        desc="Six AI agents debate across 3 rounds, then the Chair issues a decision."
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={startDebate} disabled={streaming}>{streaming ? "Debating…" : "Run Debate"}</button>
            <button className="btn" onClick={getDecision} disabled={decLoading}>{decLoading ? "Deciding…" : "Board Decision"}</button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title={`Live debate ${round ? `· Round ${round}/3` : ""}`} right={consensus && <Pill tone={consensus}>{consensus} consensus</Pill>}>
            <div ref={scrollRef} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {messages.length === 0 && !streaming && <div className="text-muted text-sm">Click "Run Debate" to begin the live multi-agent debate.</div>}
              {messages.map((m, i) => (
                <div key={i} className="flex gap-3 animate-[fadeIn_0.3s_ease]">
                  <div className="text-2xl">{ROLE_ICON[m.role] || "🤖"}</div>
                  <div className="flex-1 bg-panel2 border border-edge rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{m.role}</span>
                      <Pill tone={m.stance}>{m.stance}</Pill>
                      <span className="text-[10px] text-muted ml-auto">Round {m.round}</span>
                    </div>
                    <div className="text-sm text-gray-200">{m.message}</div>
                    {m.final_recommendation && <div className="text-xs text-accent mt-1">→ {m.final_recommendation}</div>}
                  </div>
                </div>
              ))}
              {streaming && <Loading label="Agents are deliberating…" />}
            </div>
          </Card>
        </div>

        <div>
          <Card title="Board decision">
            {decLoading ? <Loading label="SYNTHESIZING VERDICT" /> : decision ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="display-hero text-[clamp(28px,4vw,48px)]">{decision.board_decision}</div>
                  <div className="label-mono mt-1">CONFIDENCE {Math.round((decision.confidence || 0) * 100)}%</div>
                  <div className="tick-ruler mt-3 mx-auto w-1/2" />
                </div>
                <Section title="Strategic actions" items={decision.strategic_actions} />
                <Section title="Growth roadmap" items={decision.growth_roadmap} />
                <Section title="Risk mitigation" items={decision.risk_mitigation} />
                <div>
                  <div className="card-h">Funding strategy</div>
                  <p className="text-sm text-muted">{decision.funding_strategy}</p>
                </div>
                <p className="text-xs text-muted border-t border-edge pt-2">{decision.summary}</p>
              </div>
            ) : (
              <div className="text-muted text-sm">Run the board decision to aggregate all agents into one verdict.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="card-h">{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm flex gap-2"><span className="text-brand">•</span>{it}</li>
        ))}
      </ul>
    </div>
  );
}
