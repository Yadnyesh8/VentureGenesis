"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Metrics, Ref } from "./api";
import { streamBoard } from "./api";

// NO demo defaults — the profile is built entirely from the founder's questionnaire.
const EMPTY: Metrics = {};

// Live board pipeline state, shared across the whole app so it only runs once.
export type BoardStep = { key: string; label: string; kind: "ml" | "llm"; status: "pending" | "running" | "done" | "error"; ms?: number };
type BoardState = { steps: BoardStep[]; messages: any[]; decision: any; report: any; ran: boolean };
type Analysis = { status: "idle" | "running" | "done" | "error"; done: number; total: number; current: string; error?: string };

const EMPTY_BOARD: BoardState = { steps: [], messages: [], decision: null, report: null, ran: false };
const EMPTY_ANALYSIS: Analysis = { status: "idle", done: 0, total: 0, current: "" };

type Store = {
  metrics: Metrics;
  ready: boolean; // true once the questionnaire has been completed
  setProfile: (m: Metrics, startupId?: number | null) => void;
  clearProfile: () => void;
  startupId: number | null;
  ref: () => Ref;
  hydrated: boolean;
  // shared agent-result cache (keyed by endpoint name; values are {ok, data} like the API)
  cache: Record<string, any>;
  setCache: (key: string, value: any) => void;
  // board pipeline (runs every agent + debate + verdict once)
  board: BoardState;
  analysis: Analysis;
  prewarm: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetricsState] = useState<Metrics>(EMPTY);
  const [ready, setReady] = useState(false);
  const [startupId, setStartupId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cache, setCacheState] = useState<Record<string, any>>({});
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [analysis, setAnalysis] = useState<Analysis>(EMPTY_ANALYSIS);
  const running = useRef(false);

  useEffect(() => {
    try {
      const m = localStorage.getItem("vg_metrics");
      const r = localStorage.getItem("vg_ready");
      const id = localStorage.getItem("vg_startup_id");
      const c = localStorage.getItem("vg_cache");
      const b = localStorage.getItem("vg_board");
      if (m) setMetricsState(JSON.parse(m));
      if (r) setReady(JSON.parse(r));
      if (id) setStartupId(JSON.parse(id));
      if (c) setCacheState(JSON.parse(c));
      if (b) { const bs = JSON.parse(b); setBoard(bs); if (bs.ran) setAnalysis((a) => ({ ...a, status: "done" })); }
    } catch {}
    setHydrated(true);
  }, []);

  const setProfile = (m: Metrics, sid: number | null = null) => {
    setMetricsState(m);
    setReady(true);
    setStartupId(sid);
    localStorage.setItem("vg_metrics", JSON.stringify(m));
    localStorage.setItem("vg_ready", "true");
    localStorage.setItem("vg_startup_id", JSON.stringify(sid));
    // a new/edited profile invalidates every prior analysis
    resetAnalysis();
  };

  const resetAnalysis = () => {
    setCacheState({});
    setBoard(EMPTY_BOARD);
    setAnalysis(EMPTY_ANALYSIS);
    localStorage.removeItem("vg_cache");
    localStorage.removeItem("vg_board");
  };

  const clearProfile = () => {
    setMetricsState(EMPTY);
    setReady(false);
    setStartupId(null);
    localStorage.removeItem("vg_metrics");
    localStorage.removeItem("vg_ready");
    localStorage.removeItem("vg_startup_id");
    resetAnalysis();
  };

  const setCache = (key: string, value: any) => {
    setCacheState((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("vg_cache", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const ref = (): Ref => ({
    startup_id: startupId,
    metrics,
  });

  // Run the full board pipeline ONCE and fan the results out into the per-page cache,
  // so every downstream page renders instantly instead of starting its own agents.
  const prewarm = async () => {
    if (running.current) return;
    running.current = true;
    const r = ref();
    setBoard({ ...EMPTY_BOARD });
    setAnalysis({ status: "running", done: 0, total: 0, current: "Initializing" });
    try {
      await streamBoard(r, (ev) => {
        switch (ev.type) {
          case "start":
            setBoard((b) => ({ ...b, steps: ev.steps.map((s: any) => ({ ...s, status: "pending" })) }));
            setAnalysis((a) => ({ ...a, total: ev.total ?? ev.steps?.length ?? 0, current: "Convening your board" }));
            break;
          case "agent_start":
            setBoard((b) => ({ ...b, steps: b.steps.map((s) => (s.key === ev.key ? { ...s, status: "running" } : s)) }));
            setAnalysis((a) => ({ ...a, current: ev.label }));
            break;
          case "agent_done":
            setBoard((b) => ({
              ...b,
              steps: b.steps.map((s) => (s.key === ev.key ? { ...s, status: "done", ms: ev.ms } : s)),
              decision: ev.key === "board" ? ev.result : b.decision,
            }));
            setAnalysis((a) => ({ ...a, done: a.done + 1 }));
            break;
          case "agent_error":
            setBoard((b) => ({ ...b, steps: b.steps.map((s) => (s.key === ev.key ? { ...s, status: "error", ms: ev.ms } : s)) }));
            setAnalysis((a) => ({ ...a, done: a.done + 1 }));
            break;
          case "debate_message":
            setBoard((b) => ({ ...b, messages: [...b.messages, ev] }));
            break;
          case "complete": {
            const report = ev.report || {};
            const decision = ev.decision ?? null;
            const wrap = (data: any) => ({ ok: true, data });
            const derived: Record<string, any> = {};
            const map: [string, any][] = [
              ["health", report.health],
              ["failure", report.failure],
              ["funding", report.funding],
              ["forecast", report.forecast],
              ["competitor", report.competitor],
              ["market", report.market],
              ["strategy", report.founder_strategy],
              ["pivots", report.pivots],
              ["understand", report.understanding],
              ["agi", report.agi],
              ["causal", report.causal],
            ];
            for (const [k, v] of map) if (v && !v.error) derived[k] = wrap(v);
            setCacheState((prev) => {
              const next = { ...prev, ...derived };
              try { localStorage.setItem("vg_cache", JSON.stringify(next)); } catch {}
              return next;
            });
            setBoard((b) => {
              const finished = { ...b, report, decision: decision ?? b.decision, ran: true };
              try { localStorage.setItem("vg_board", JSON.stringify(finished)); } catch {}
              return finished;
            });
            break;
          }
        }
      });
      setAnalysis((a) => ({ ...a, status: "done", current: "Complete" }));
    } catch (e: any) {
      setAnalysis((a) => ({ ...a, status: "error", error: String(e?.message || e) }));
    } finally {
      running.current = false;
    }
  };

  return (
    <Ctx.Provider value={{ metrics, ready, setProfile, clearProfile, startupId, ref, hydrated, cache, setCache, board, analysis, prewarm }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
