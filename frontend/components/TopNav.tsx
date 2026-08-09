"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { useStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";

type Item = { href: string; label: string; note: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Models",
    items: [
      { href: "/health", label: "Health Score", note: "Weighted composite" },
      { href: "/failure", label: "Failure Prediction", note: "Gradient boosting + SHAP" },
      { href: "/forecast", label: "Revenue Forecast", note: "Prophet time series" },
      { href: "/funding", label: "Funding Readiness", note: "Calibrated classifier" },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/board", label: "Board of Directors", note: "Multi-agent debate" },
      { href: "/idea", label: "Idea Diligence", note: "Analyse / review loop" },
      { href: "/competitor", label: "Competitor Intelligence", note: "Reasoning agent" },
      { href: "/market", label: "Market Opportunity", note: "Reasoning agent" },
    ],
  },
  {
    label: "Frontier",
    items: [
      { href: "/uncertainty", label: "Epistemic Uncertainty", note: "Value of information" },
      { href: "/agi", label: "AGI Pre-Conditioner", note: "Disruption stress test" },
      { href: "/spinout", label: "Spin-out Viability", note: "Expected value" },
    ],
  },
];

const FLAT: Item[] = [
  { href: "/dashboard", label: "Overview", note: "" },
  { href: "/simulation", label: "Digital Twin", note: "" },
  { href: "/report", label: "Report", note: "" },
];

export default function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { metrics, ready } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus on route change and on Escape.
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  if (path === "/onboarding") return null;

  const initial = (metrics.startup_name || "?").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-900">
      <div className="mx-auto flex h-[72px] max-w-shell items-center justify-between gap-4 px-5 sm:px-6">
        {/* Mark — bare, no tile behind it */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <Image src="/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" priority />
          <span className="text-[17px] font-bold tracking-[-0.02em] text-text">VentureGenesis</span>
        </Link>

        {/* Primary navigation */}
        <div ref={navRef} className="hidden items-center gap-0.5 md:flex">
          {FLAT.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`nav-cat ${path === it.href ? "nav-cat-active" : ""}`}
            >
              {it.label}
            </Link>
          ))}

          {GROUPS.map((g) => {
            const active = g.items.some((it) => it.href === path);
            const isOpen = open === g.label;
            return (
              <div key={g.label} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpen(isOpen ? null : g.label)}
                  className={`nav-cat gap-1.5 ${active || isOpen ? "nav-cat-active" : ""}`}
                >
                  {g.label}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    aria-hidden
                    className="opacity-60"
                    style={{
                      transform: `rotate(${isOpen ? 180 : 0}deg)`,
                      transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
                    {g.items.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`block rounded-xl px-3 py-2.5 transition-colors ${
                          path === it.href ? "bg-surface3 text-text" : "text-text-dim hover:bg-surface2 hover:text-text"
                        }`}
                      >
                        <span className="block text-sm font-medium">{it.label}</span>
                        <span className="mt-0.5 block text-xs text-text-mute">{it.note}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <Link
            href="/onboarding"
            title={ready ? `${metrics.startup_name} — edit profile` : "Complete your profile"}
            className="hidden h-10 items-center gap-2.5 rounded-xl border border-line bg-surface3 pl-1.5 pr-3 transition-colors hover:border-line-strong sm:flex"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 text-[13px] font-semibold leading-none text-text">
              {initial}
            </span>
            <span className="max-w-[130px] truncate text-sm text-text-dim">
              {ready ? metrics.startup_name || "Untitled" : "Set up"}
            </span>
          </Link>

          <SignedIn>
            <button
              onClick={() => signOut(() => router.push("/"))}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface3 text-text-mute transition-colors hover:border-line-strong hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="btn h-10">
              Sign in
            </Link>
          </SignedOut>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobile((v) => !v)}
            aria-label={mobile ? "Close menu" : "Open menu"}
            aria-expanded={mobile}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface3 text-text-mute transition-colors hover:text-text md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              {mobile ? (
                <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5 H13.5 M2.5 11 H13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobile && (
        <div className="max-h-[70vh] overflow-y-auto border-t border-line bg-ink-900 px-5 py-4 md:hidden">
          <div className="flex flex-wrap gap-2">
            {FLAT.map((it) => (
              <Link key={it.href} href={it.href} className={`chip ${path === it.href ? "!bg-text !text-ink-900 !border-text" : ""}`}>
                {it.label}
              </Link>
            ))}
          </div>
          {GROUPS.map((g) => (
            <div key={g.label} className="mt-5">
              <div className="label-mono mb-2.5">{g.label}</div>
              <div className="grid gap-0.5">
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      path === it.href ? "bg-surface3 text-text" : "text-text-dim hover:bg-surface2"
                    }`}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
