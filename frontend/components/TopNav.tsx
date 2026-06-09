"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { TraceGlyph } from "./instrument";

type Item = { href: string; label: string; tag?: string };
type Cat = { label: string; blurb: string; items: Item[] };

const CATS: Cat[] = [
  {
    label: "Workspace",
    blurb: "Overview, simulation & reporting",
    items: [
      { href: "/dashboard", label: "Dashboard", tag: "overview" },
      { href: "/simulation", label: "Digital Twin", tag: "scenarios" },
      { href: "/report", label: "Executive Report", tag: "document" },
    ],
  },
  {
    label: "Models",
    blurb: "Trained ML & statistical models",
    items: [
      { href: "/health", label: "Health Score", tag: "weighted" },
      { href: "/failure", label: "Failure Prediction", tag: "GradientBoosting" },
      { href: "/forecast", label: "Revenue Forecast", tag: "Prophet" },
      { href: "/funding", label: "Funding Readiness", tag: "GradientBoosting" },
      { href: "/customer", label: "Customer Sentiment", tag: "FinBERT" },
    ],
  },
  {
    label: "Agents",
    blurb: "Live LLM reasoning agents",
    items: [
      { href: "/competitor", label: "Competitor Intelligence", tag: "LLM" },
      { href: "/market", label: "Market Opportunity", tag: "LLM" },
      { href: "/pivots", label: "Pivot Engine", tag: "LLM" },
      { href: "/board", label: "Board of Directors", tag: "multi-agent" },
    ],
  },
];

export default function TopNav() {
  const path = usePathname();
  const { metrics, ready } = useStore();
  const [open, setOpen] = useState<number | null>(null);

  if (path === "/onboarding") return null;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-900/85 backdrop-blur-md">
      <div className="max-w-[1500px] mx-auto px-5 h-16 flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <TraceGlyph size={22} />
          <div className="leading-none">
            <div className="title-display text-[17px]">VENTURE<span className="text-aqua">GENESIS</span></div>
            <div className="label-mono text-[8px] mt-0.5">STARTUP OS</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1" onMouseLeave={() => setOpen(null)}>
          {CATS.map((cat, i) => {
            const active = cat.items.some((it) => it.href === path);
            return (
              <div key={cat.label} className="relative" onMouseEnter={() => setOpen(i)}>
                <button className={`nav-cat ${active || open === i ? "nav-cat-active" : ""}`}>
                  {cat.label}
                  <span className="ml-1.5 text-[8px] opacity-60">▾</span>
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-[calc(100%+8px)] w-72 bg-surface border border-line rounded-xl p-2 shadow-2xl"
                    >
                      <div className="label-mono px-2 pt-1 pb-2 text-text-mute">{cat.blurb}</div>
                      {cat.items.map((it) => (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={() => setOpen(null)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg transition ${
                            path === it.href ? "bg-surface2 text-text" : "text-text-dim hover:bg-surface2 hover:text-text"
                          }`}
                        >
                          <span className="text-sm">{it.label}</span>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/board" className="hidden lg:inline-block btn !py-2">Convene Board</Link>
          <Link href="/onboarding" className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line hover:border-aqua transition">
            <span className="w-7 h-7 rounded-lg bg-surface2 grid place-items-center title-display text-[13px] text-aqua">
              {(metrics.startup_name || "—").slice(0, 1).toUpperCase()}
            </span>
            <div className="hidden sm:block leading-none text-left">
              <div className="text-[13px] font-medium truncate max-w-[140px]">{ready ? metrics.startup_name || "—" : "Not set"}</div>
              <div className="label-mono text-[8px] mt-0.5 text-text-mute">{ready ? "EDIT PROFILE" : "ONBOARD"}</div>
            </div>
          </Link>
        </div>
      </div>

      {/* mobile category strip */}
      <div className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2">
        {CATS.flatMap((c) => c.items).map((it) => (
          <Link key={it.href} href={it.href} className={`nav-cat whitespace-nowrap ${path === it.href ? "nav-cat-active" : ""}`}>
            {it.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
