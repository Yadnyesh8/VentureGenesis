"use client";
import Link from "next/link";

const COLUMNS: { head: string; items: { href: string; label: string }[] }[] = [
  {
    head: "Models",
    items: [
      { href: "/health", label: "Health Score" },
      { href: "/failure", label: "Failure Prediction" },
      { href: "/forecast", label: "Revenue Forecast" },
      { href: "/funding", label: "Funding Readiness" },
    ],
  },
  {
    head: "Agents",
    items: [
      { href: "/board", label: "Board of Directors" },
      { href: "/competitor", label: "Competitor Intelligence" },
      { href: "/market", label: "Market Opportunity" },
      { href: "/pivots", label: "Pivot Engine" },
    ],
  },
  {
    head: "Frontier",
    items: [
      { href: "/uncertainty", label: "Epistemic Uncertainty" },
      { href: "/agi", label: "AGI Pre-Conditioner" },
      { href: "/spinout", label: "Spin-out Viability" },
      { href: "/trajectory", label: "Causal Trajectory" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-shell px-5 py-14 sm:px-6 sm:py-16">
        {/* One grid: the statement and the columns share the page's margins, and
            each nav column gets an equal, self-balancing share of the width. */}
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] md:gap-8">
          <div>
            <p className="max-w-xs text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-text sm:text-[30px]">
              Fourteen readings.
              <span className="block text-text-mute">One set of numbers.</span>
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.head}>
              <h2 className="label-mono mb-4">{col.head}</h2>
              <ul className="space-y-2.5">
                {col.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="text-sm text-text-mute transition-colors hover:text-text">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav>
            <h2 className="label-mono mb-4">More</h2>
            <ul className="space-y-2.5">
              <li>
                <Link href="/simulation" className="text-sm text-text-mute transition-colors hover:text-text">
                  Digital Twin
                </Link>
              </li>
              <li>
                <Link href="/report" className="text-sm text-text-mute transition-colors hover:text-text">
                  Executive Report
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="text-sm text-text-mute transition-colors hover:text-text">
                  Your profile
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <p className="text-xs text-text-faint">© {new Date().getFullYear()} VentureGenesis</p>
          <p className="text-xs text-text-faint">Built on your numbers</p>
        </div>
      </div>
    </footer>
  );
}
