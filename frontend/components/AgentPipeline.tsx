"use client";
import { motion, AnimatePresence } from "framer-motion";

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
      <svg width="16" height="16" viewBox="0 0 16 16" className="[animation:sweep_0.9s_linear_infinite]">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#1A1E29" strokeWidth="2" />
        <path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke="#FF8A3D" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (status === "done")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
  if (status === "error")
    return <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4 L12 12 M12 4 L4 12" stroke="#FF5D5D" strokeWidth="2" strokeLinecap="round" /></svg>;
  return <span className="w-2 h-2 rounded-full bg-line-strong" />;
}

export default function AgentPipeline({ steps }: { steps: StepState[] }) {
  const done = steps.filter((s) => s.status === "done" || s.status === "error").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono">AGENT PIPELINE</div>
        <div className="label-mono text-text-dim">{done}/{steps.length} · {pct}%</div>
      </div>
      <div className="h-[3px] bg-surface2 rounded-full mb-4 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#FF5D5D,#FF8A3D,#FFC83D)" }}
          animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
      </div>
      <div className="space-y-1">
        {steps.map((s) => {
          const active = s.status === "running";
          return (
            <motion.div
              key={s.key}
              layout
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${
                active ? "border-amber bg-amber/5" : s.status === "done" ? "border-line" : "border-transparent"
              }`}
              animate={active ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
              transition={active ? { repeat: Infinity, duration: 1.4 } : { duration: 0.2 }}
            >
              <StatusGlyph status={s.status} />
              <span className={`text-sm flex-1 ${s.status === "pending" ? "text-text-mute" : "text-text"}`}>{s.label}</span>
              <span className={`pill ${s.kind === "llm" ? "text-amber border-amber bg-amber/10" : "text-coral border-coral bg-coral/10"}`}>
                {s.kind === "llm" ? "LLM" : "MODEL"}
              </span>
              {s.ms != null && s.status !== "running" && (
                <span className="label-mono text-[9px] w-14 text-right">{(s.ms / 1000).toFixed(1)}s</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
