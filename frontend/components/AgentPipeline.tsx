"use client";
import { motion } from "framer-motion";

export type StepState = {
  key: string;
  label: string;
  kind: "ml" | "llm";
  status: "pending" | "running" | "done" | "error";
  ms?: number;
  note?: string;
};

function StatusGlyph({ status }: { status: StepState["status"] }) {
  if (status === "running")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="[animation:sweep_0.9s_linear_infinite]" aria-label="running">
        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (status === "done")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-label="done"><path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
  if (status === "error")
    return <svg width="16" height="16" viewBox="0 0 16 16" aria-label="error"><path d="M4 4 L12 12 M12 4 L4 12" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <span className="w-2 h-2 rounded-full bg-line-strong" />;
}

export default function AgentPipeline({ steps }: { steps: StepState[] }) {
  const done = steps.filter((s) => s.status === "done" || s.status === "error").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono text-text-dim">AGENT PIPELINE</div>
        <div className="label-mono tabular-nums">{done}/{steps.length} <span className="text-text-faint">·</span> {pct}%</div>
      </div>
      <div className="h-[4px] bg-surface3 rounded-full mb-5 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: "var(--text)" }}
          animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => {
          const active = s.status === "running";
          return (
            <motion.div
              key={s.key}
              layout
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                active ? "border-amber/60 bg-amber/5" : s.status === "done" ? "border-line bg-surface/40" : s.status === "error" ? "border-coral/40 bg-coral/5" : "border-transparent"
              }`}
              style={active ? { boxShadow: "0 0 0 1px rgba(255,177,60,0.25), 0 8px 24px -12px rgba(255,177,60,0.4)" } : undefined}
              animate={active ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
              transition={active ? { repeat: Infinity, duration: 1.4 } : { duration: 0.2 }}
            >
              <span className="grid place-items-center w-4 h-4 shrink-0"><StatusGlyph status={s.status} /></span>
              <span className={`text-sm flex-1 truncate ${s.status === "pending" ? "text-text-mute" : "text-text"}`}>{s.label}</span>
              {s.ms != null && s.status !== "running" && (
                <span className="label-mono text-[9px] w-12 text-right tabular-nums">{(s.ms / 1000).toFixed(1)}s</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
