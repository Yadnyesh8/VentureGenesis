"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
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
  {
    label: "Frontier",
    blurb: "Advanced strategic engines",
    items: [
      { href: "/uncertainty", label: "Epistemic Uncertainty", tag: "VOI" },
      { href: "/agi", label: "AGI Pre-Conditioner", tag: "stress-test" },
      { href: "/spinout", label: "Spin-out Viability", tag: "EV" },
      { href: "/trajectory", label: "Causal Trajectory", tag: "causal" },
    ],
  },
];

export default function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { metrics, ready } = useStore();
  const [open, setOpen] = useState<number | null>(null);

  if (path === "/onboarding") return null;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-ink-900/55">
      {/* hairline accent glow under the bar */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-aqua/30 to-transparent" />
      <div className="max-w-[1500px] mx-auto px-5 h-16 flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <span className="grid place-items-center w-9 h-9 rounded-xl border border-line bg-surface2 group-hover:border-aqua/50 transition-colors">
            <TraceGlyph size={20} />
          </span>
          <div className="leading-none">
            <div className="title-display text-[17px]">VENTURE<span className="text-aqua">GENESIS</span></div>
            <div className="label-mono text-[8px] mt-1 text-text-faint">STARTUP&nbsp;OS</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1" onMouseLeave={() => setOpen(null)}>
          {CATS.map((cat, i) => {
            const active = cat.items.some((it) => it.href === path);
            return (
              <div key={cat.label} className="relative" onMouseEnter={() => setOpen(i)}>
                <button className={`nav-cat ${active || open === i ? "nav-cat-active" : ""}`}>
                  {cat.label}
                  <span className={`ml-1.5 text-[8px] transition-transform duration-200 ${open === i ? "rotate-180" : ""} opacity-60`}>▾</span>
                </button>
                {active && (
                  <motion.span layoutId="nav-underline" className="absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full bg-aqua" style={{ boxShadow: "0 0 8px #34E1D2" }} />
                )}
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-0 top-[calc(100%+10px)] w-80 bg-surface/95 backdrop-blur-xl border border-line rounded-2xl p-2 shadow-lift"
                    >
                      <div className="label-mono px-3 pt-1.5 pb-2.5 text-text-faint border-b border-line-soft mb-1.5">{cat.blurb}</div>
                      {cat.items.map((it) => {
                        const isActive = path === it.href;
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            onClick={() => setOpen(null)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                              isActive ? "bg-surface3 text-text" : "text-text-dim hover:bg-surface2 hover:text-text"
                            }`}
                          >
                            <span className="text-sm">{it.label}</span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/board" className="hidden lg:inline-flex btn !py-2.5">Convene Board</Link>
          <Link href="/onboarding" className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl border border-line hover:border-aqua/50 bg-surface2/60 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-surface3 grid place-items-center title-display text-[14px] text-aqua">
              {(metrics.startup_name || "—").slice(0, 1).toUpperCase()}
            </span>
            <div className="hidden sm:block leading-none text-left">
              <div className="text-[13px] font-medium truncate max-w-[140px]">{ready ? metrics.startup_name || "—" : "Not set"}</div>
              <div className="label-mono text-[8px] mt-1 text-text-faint">{ready ? "EDIT PROFILE" : "ONBOARD"}</div>
            </div>
          </Link>
          <SignedIn>
            <button
              onClick={() => signOut(() => router.push("/"))}
              title="Sign out"
              aria-label="Sign out"
              className="w-9 h-9 grid place-items-center rounded-xl border border-line bg-surface2/60 text-text-mute hover:text-coral hover:border-coral/50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="btn-ghost">Sign in</Link>
          </SignedOut>
        </div>
      </div>

      {/* mobile category strip */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto px-4 pb-2.5 -mt-0.5">
        {CATS.flatMap((c) => c.items).map((it) => (
          <Link key={it.href} href={it.href} className={`nav-cat whitespace-nowrap ${path === it.href ? "nav-cat-active" : ""}`}>
            {it.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
