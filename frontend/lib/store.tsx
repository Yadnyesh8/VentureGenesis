"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Metrics, Ref } from "./api";

// NO demo defaults — the profile is built entirely from the founder's questionnaire.
const EMPTY: Metrics = {};

type Store = {
  metrics: Metrics;
  ready: boolean; // true once the questionnaire has been completed
  setProfile: (m: Metrics, startupId?: number | null) => void;
  clearProfile: () => void;
  startupId: number | null;
  reviews: string[];
  setReviews: (r: string[]) => void;
  ref: () => Ref;
  hydrated: boolean;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetricsState] = useState<Metrics>(EMPTY);
  const [ready, setReady] = useState(false);
  const [startupId, setStartupId] = useState<number | null>(null);
  const [reviews, setReviewsState] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const m = localStorage.getItem("vg_metrics");
      const r = localStorage.getItem("vg_ready");
      const id = localStorage.getItem("vg_startup_id");
      const rev = localStorage.getItem("vg_reviews");
      if (m) setMetricsState(JSON.parse(m));
      if (r) setReady(JSON.parse(r));
      if (id) setStartupId(JSON.parse(id));
      if (rev) setReviewsState(JSON.parse(rev));
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
  };

  const clearProfile = () => {
    setMetricsState(EMPTY);
    setReady(false);
    setStartupId(null);
    setReviewsState([]);
    localStorage.removeItem("vg_metrics");
    localStorage.removeItem("vg_ready");
    localStorage.removeItem("vg_startup_id");
    localStorage.removeItem("vg_reviews");
  };

  const setReviews = (r: string[]) => {
    setReviewsState(r);
    localStorage.setItem("vg_reviews", JSON.stringify(r));
  };

  const ref = (): Ref => ({
    startup_id: startupId,
    metrics,
    customer_reviews: reviews.length ? reviews : undefined,
  });

  return (
    <Ctx.Provider value={{ metrics, ready, setProfile, clearProfile, startupId, reviews, setReviews, ref, hydrated }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
