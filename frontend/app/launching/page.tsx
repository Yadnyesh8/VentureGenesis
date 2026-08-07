"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import LottieLoader from "@/components/LottieLoader";
import AgentPipeline from "@/components/AgentPipeline";

const PHRASES = [
  "Reading your numbers…",
  "Waking the board of directors…",
  "Running failure & funding models…",
  "Scanning competitors and market…",
  "Letting the directors debate…",
  "Synthesizing the verdict…",
];

export default function Launching() {
  const router = useRouter();
  const { ready, hydrated, board, analysis, prewarm } = useStore();
  const [phrase, setPhrase] = useState(0);
  const started = useRef(false);

  // Kick off the full pipeline exactly once, when we have a profile to analyze.
  useEffect(() => {
    if (!hydrated) return;
    if (!ready) { router.replace("/onboarding"); return; }
    if (board.ran && analysis.status === "done") { router.replace("/dashboard"); return; }
    if (!started.current && analysis.status === "idle") {
      started.current = true;
      prewarm();
    }
  }, [hydrated, ready, board.ran, analysis.status]); // eslint-disable-line

  // When everything is ready, ease into the dashboard.
  useEffect(() => {
    if (analysis.status === "done" && board.ran) {
      const t = setTimeout(() => router.push("/dashboard"), 900);
      return () => clearTimeout(t);
    }
  }, [analysis.status, board.ran, router]);

  // Cycle the friendly status copy.
  useEffect(() => {
    const i = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2600);
    return () => clearInterval(i);
  }, []);

  const pct = analysis.total ? Math.round((analysis.done / analysis.total) * 100) : 0;
  const failed = analysis.status === "error";
  const done = analysis.status === "done";

  return (
    <div className="relative overflow-hidden -mx-5 px-5 -my-8 py-8 md:-my-10 md:py-10">
      <div className="relative z-10 min-h-[70vh] grid lg:grid-cols-[1fr_360px] gap-10 items-center">
      <div className="text-center lg:text-left">
        <LottieLoader size={300} />

        <div className="mt-2">
          <div className="label-mono text-amber">{done ? "ANALYSIS COMPLETE" : failed ? "SOMETHING WENT WRONG" : "BUILDING YOUR BOARD"}</div>
          <h1 className="display-hero text-[clamp(28px,4vw,46px)] leading-[0.95] mt-2">
            {done ? "YOUR BOARD" : "CONVENING"}<br />{done ? "IS READY" : "YOUR BOARD"}
          </h1>

          {!failed && (
            <AnimatePresence mode="wait">
              <motion.p
                key={done ? "done" : phrase}
                // Enters on position alone so a stalled engine can't leave the
                // status line invisible; only the outgoing message fades.
                initial={{ y: 8 }}
                animate={{ y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-text-dim mt-3 text-sm h-5"
              >
                {done ? "Taking you to your command center…" : PHRASES[phrase]}
              </motion.p>
            </AnimatePresence>
          )}

          {failed && (
            <div className="mt-3">
              <p className="text-coral text-sm mb-3">{analysis.error || "The pipeline failed."} You can still explore — agents will run on demand.</p>
              <div className="flex gap-2 justify-center lg:justify-start">
                <button className="btn" onClick={() => { started.current = false; prewarm(); }}>Retry</button>
                <button className="btn-ghost" onClick={() => router.push("/dashboard")}>Continue anyway →</button>
              </div>
            </div>
          )}

          {!failed && (
            <div className="mt-6 max-w-md mx-auto lg:mx-0">
              <div className="flex items-center justify-between mb-2 label-mono text-text-dim">
                <span>{analysis.done}/{analysis.total || "…"} agents</span>
                <span>{pct}%</span>
              </div>
              <div className="h-[3px] bg-surface2 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: "var(--text)" }}
                  animate={{ width: `${done ? 100 : pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card max-h-[440px] overflow-y-auto">
        {board.steps.length > 0 ? (
          <AgentPipeline steps={board.steps} />
        ) : (
          <div className="label-mono text-text-mute py-8 text-center">SPINNING UP AGENTS…</div>
        )}
      </div>
      </div>
    </div>
  );
}
