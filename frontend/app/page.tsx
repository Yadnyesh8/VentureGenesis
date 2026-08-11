import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
// Imported rather than referenced by path: Next then knows each plate's real
// dimensions and generates a blur placeholder, so the frame is never an empty
// box while a full-resolution capture is still on the wire.
import shotDashboard from "@/public/shots/dashboard.png";
import shotFailure from "@/public/shots/failure.png";
import shotTwin from "@/public/shots/twin.png";
import LandingNav from "@/components/landing/LandingNav";
import HeroField from "@/components/landing/HeroField";
import TypeCycle from "@/components/landing/TypeCycle";
import CountUp from "@/components/landing/CountUp";

export const metadata: Metadata = {
  title: "VentureGenesis — pressure-test the whole thesis",
  description:
    "Enter your startup's numbers once. Four trained models and nine reasoning agents run in a single pass and return one board verdict.",
};

// Module-level so the identity is stable — a fresh array would restart the cycle
// on every render of the hero.
const HERO_WORDS = [
  "the runway.",
  "the raise.",
  "the burn.",
  "the churn.",
  "the pivot.",
  "the hiring plan.",
  "the whole thesis.",
];

/** The six seats, each with the quantitative lens it actually argues from. */
const SEATS = [
  { role: "Founder", lens: "Hiring velocity, growth momentum, stagnation gap" },
  { role: "Investor", lens: "Dilution, capital efficiency, valuation multiple" },
  { role: "Financial", lens: "Burn multiple, net burn, default-alive math" },
  { role: "Customer", lens: "ARPU, churn-implied lifetime, net revenue retention" },
  { role: "Market", lens: "TAM, SAM, SOM and your current share" },
  { role: "Competitor", lens: "Funding against stage peers, moat proxy, density" },
];

const SURFACES = [
  {
    group: "Models",
    note: "Trained, not prompted",
    items: [
      ["Health Score", "Weighted composite"],
      ["Failure Prediction", "Gradient boosting + SHAP"],
      ["Revenue Forecast", "Prophet time series"],
      ["Funding Readiness", "Calibrated classifier"],
    ],
  },
  {
    group: "Agents",
    note: "Reasoning over your numbers",
    items: [
      ["Board of Directors", "Multi-agent debate"],
      ["Idea Diligence", "Analyse / review loop"],
      ["Competitor Intelligence", "Positioning and density"],
      ["Market Opportunity", "Share and headroom"],
    ],
  },
  {
    group: "Frontier",
    note: "The questions nobody asks",
    items: [
      ["Epistemic Uncertainty", "Value of information"],
      ["AGI Pre-Conditioner", "Disruption stress test"],
      ["Spin-out Viability", "Expected value"],
    ],
  },
  {
    group: "Workspace",
    note: "What you take away",
    items: [
      ["Digital Twin", "Monte Carlo scenarios"],
      ["Executive Report", "One board memo"],
    ],
  },
];

const KICKER = "font-mono text-[11px] uppercase tracking-[0.3em] text-text-mute sm:text-xs";

// The recessed half of a two-tone heading: a 60% wash of the muted ink, which
// measures 3.44:1 on this ground — clear of the 3:1 floor for display type.
const RECESSED = "text-text-mute/60";
// text-balance keeps a two-line heading in two even lines instead of stranding a
// single word on the last row.
const H2 =
  "text-balance text-[clamp(2rem,4.4vw,3.5rem)] font-black leading-[0.95] tracking-[-0.03em] text-text";

export default function Landing() {
  return (
    // The marketing page is composed on the dark ground and carries no tone
    // control; the scope keeps that local, so the app's own theme is untouched.
    <div className="theme-dark-scope min-h-screen bg-ink-900">
      <LandingNav />

      {/* ── Hero ──────────────────────────────────────────────────────────────
          Sized to own the first screen exactly: the copy sits in the upper
          field and the real product crests the bottom edge, cut on purpose. */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        <HeroField />

        {/* Centred in whatever room the fold leaves, so a tall window opens the
            block out evenly instead of stranding it under the bar. */}
        <div className="relative z-10 flex flex-1 items-center px-5 pb-6 pt-[104px] sm:px-8">
          <div className="mx-auto w-full max-w-[1180px]">
            <p className={KICKER}>Startup intelligence platform</p>

            <h1 className="mt-7 text-[clamp(2.9rem,8.4vw,7rem)] font-black leading-[0.9] tracking-[-0.035em] text-text">
              <span className="block">Pressure-test</span>
              <TypeCycle words={HERO_WORDS} className={`block ${RECESSED}`} />
            </h1>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-text-mute sm:text-lg">
              Enter your numbers once. Four trained models and nine reasoning agents run in a
              single pass and hand back one board verdict.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2.5 rounded-full bg-[var(--inverse-bg)] px-7 py-4 text-sm font-semibold tracking-[0.01em] text-[var(--inverse-fg)] transition-opacity hover:opacity-[0.86]"
              >
                Try now
                {/* Outward diagonal, drawn to this system's stroke and cap. */}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path
                    d="M3 10 L10 3 M4.6 3 H10 V8.4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#product"
                className="inline-flex items-center rounded-full border border-line px-7 py-4 text-sm font-semibold tracking-[0.01em] text-text transition-colors hover:border-line-strong hover:bg-surface"
              >
                See what it returns
              </a>
            </div>
          </div>
        </div>

        {/* The product itself, cropped by the fold. The fade is long and finely
            eased so the plate dissolves into the page with no seam. */}
        <div className="relative z-10 mt-10 h-[clamp(180px,32svh,400px)] w-full sm:mt-14">
          <div className="mx-auto h-full max-w-[1180px] px-5 sm:px-8">
            <div
              className="h-full overflow-hidden rounded-t-2xl border border-b-0 border-line bg-surface"
              style={{
                maskImage:
                  "linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.94) 58%, rgba(0,0,0,0.82) 68%, rgba(0,0,0,0.62) 77%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0.2) 92%, rgba(0,0,0,0.07) 97%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.94) 58%, rgba(0,0,0,0.82) 68%, rgba(0,0,0,0.62) 77%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0.2) 92%, rgba(0,0,0,0.07) 97%, transparent 100%)",
              }}
            >
              <Image
                src={shotDashboard}
                alt="The VentureGenesis overview: health score, twelve-month failure risk, funding probability and runway across the top, with the module board below."
                placeholder="blur"
                priority
                sizes="(max-width: 1180px) 100vw, 1180px"
                // The capture includes the app's own top bar. Riding the plate up by
                // its exact share of the frame (68 of 950 captured pixels) drops that
                // duplicate nav off the top, so the shallow band shows the readings
                // rather than a second row of chrome.
                style={{ transform: "translateY(-7.16%)" }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── What one pass returns ───────────────────────────────────────────── */}
      <section id="product" className="scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <h2 className={`${H2} max-w-3xl`}>
            Every figure traces back to a number you entered.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-text-mute sm:text-lg">
            The failure model is calibrated gradient boosting trained on 6,089 real YC and
            Failory outcomes. It reports its own confidence, and it shows the features that
            moved the prediction.
          </p>

          <div className="mt-14 overflow-hidden rounded-2xl border border-line bg-surface">
            <Image
              src={shotFailure}
              alt="The Failure Prediction page: 9.2 percent at six months, 15.3 percent at twelve, 23.0 percent at twenty-four, above a model-confidence panel breaking out discrimination, calibration, cross-validation stability and input completeness."
              placeholder="blur"
              sizes="(max-width: 1180px) 100vw, 1180px"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────────────
          Three passes, laid on one grid so every row shares a baseline. */}
      <section id="pipeline" className="scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <p className={KICKER}>One run, thirteen steps</p>
          <h2 className={`${H2} mt-6 max-w-3xl`}>Three passes. One verdict.</h2>

          <div className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-3">
            {[
              {
                n: "01",
                head: "The models go first",
                body:
                  "Failure probability, revenue forecast, funding readiness and health score are computed from your metrics before a single agent speaks.",
              },
              {
                n: "02",
                head: "Six seats argue",
                body:
                  "Each agent receives its own quantitative lens, so it reasons over numbers no other seat is looking at. Specialisation, not prompt variation.",
              },
              {
                n: "03",
                head: "The chair rules",
                body:
                  "The chairperson reads the models and the debate together and returns a structured decision, plus a board memo you can hand over.",
              },
            ].map((s) => (
              <div key={s.n} className="grid grid-rows-[auto_auto_1fr] gap-4">
                <span className="font-mono text-sm tracking-[0.2em] text-text-mute">{s.n}</span>
                <h3 className="text-xl font-bold tracking-[-0.02em] text-text">{s.head}</h3>
                <p className="text-[15px] leading-relaxed text-text-mute">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 overflow-hidden rounded-2xl border border-line bg-surface">
            <Image
              src={shotTwin}
              alt="The Digital Twin scenario simulator with the cost-cutting scenario applied: failure risk holding at 15.3 percent, health score rising from 67.1 to 69, funding probability from 31.4 to 31.9 percent."
              placeholder="blur"
              sizes="(max-width: 1180px) 100vw, 1180px"
              className="w-full"
            />
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-text-mute">
            The Digital Twin applies a scenario to a copy of your company and re-runs the same
            trained models, so a decision is scored before you make it.
          </p>
        </div>
      </section>

      {/* ── The board ────────────────────────────────────────────────────────
          Opens on the roster itself rather than another label-over-heading. */}
      <section id="board" className="scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <h2 className={`${H2} max-w-3xl`}>
            Six seats.{" "}
            <span className={RECESSED}>Six different sets of arithmetic.</span>
          </h2>

          <ul className="mt-16 grid gap-x-10 gap-y-0 sm:grid-cols-2">
            {SEATS.map((s, i) => (
              <li
                key={s.role}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-t border-line py-6"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-mute">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-bold tracking-[-0.015em] text-text">{s.role}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-text-mute">{s.lens}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Surfaces ─────────────────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <h2 className={`${H2} max-w-3xl`}>Thirteen readings on one set of numbers.</h2>

          <div className="mt-16 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {SURFACES.map((col) => (
              <div key={col.group}>
                <h3 className="text-sm font-semibold tracking-[-0.01em] text-text">{col.group}</h3>
                <p className="mt-1 text-xs text-text-mute">{col.note}</p>
                <ul className="mt-6 space-y-5">
                  {col.items.map(([name, note]) => (
                    <li key={name}>
                      <p className="text-[15px] font-medium leading-snug text-text-dim">{name}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-text-mute">{note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Figures ──────────────────────────────────────────────────────────
          Four counts, each one checkable in the repository. */}
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-8 gap-y-14 lg:grid-cols-4">
          {[
            { to: 6089, suffix: "", label: "Outcomes trained on" },
            { to: 13, suffix: "", label: "Steps in one run" },
            { to: 6, suffix: "", label: "Seats at the table" },
            { to: 23, suffix: "", label: "Industries encoded" },
          ].map((f) => (
            <div key={f.label}>
              <CountUp
                to={f.to}
                className="block text-[clamp(2.75rem,6vw,4.5rem)] font-black leading-none tracking-[-0.035em] text-text"
              />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-text-mute sm:text-xs">
                {f.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────────── */}
      <section className="px-5 pb-28 pt-16 sm:px-8 sm:pb-36">
        <div className="mx-auto max-w-[1180px]">
          <h2 className={`${H2} max-w-2xl`}>
            Your numbers already know.{" "}
            <span className={RECESSED}>Ask them properly.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-text-mute sm:text-lg">
            Three required fields. Everything else is optional, and nothing is invented to
            fill a gap.
          </p>
          <Link
            href="/sign-up"
            className="mt-10 inline-flex items-center gap-2.5 rounded-full bg-[var(--inverse-bg)] px-7 py-4 text-sm font-semibold tracking-[0.01em] text-[var(--inverse-fg)] transition-opacity hover:opacity-[0.86]"
          >
            Try now
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path
                d="M3 10 L10 3 M4.6 3 H10 V8.4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/**
 * The colophon sits above; the wordmark is anchored flush to the bottom edge and
 * cropped there on purpose — caps fully clear at the top, no gap beneath it, and
 * it paints above the surface rather than under anything.
 */
function LandingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div className="mx-auto max-w-[1180px] px-5 pt-14 sm:px-8">
        {/* Both clusters run from the same left margin as every section above,
            rather than being thrown to opposite rims with a gulf between them. */}
        <div className="flex flex-wrap items-end gap-x-16 gap-y-8">
          <p className="text-lg font-bold leading-snug tracking-[-0.02em] text-text">
            Thirteen readings.
            <span className="block text-text-mute">One set of numbers.</span>
          </p>
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-3" aria-label="Footer">
            <a href="#product" className="text-sm text-text-mute transition-colors hover:text-text">
              Product
            </a>
            <a href="#pipeline" className="text-sm text-text-mute transition-colors hover:text-text">
              Pipeline
            </a>
            <a href="#board" className="text-sm text-text-mute transition-colors hover:text-text">
              The board
            </a>
            <Link href="/sign-in" className="text-sm text-text-mute transition-colors hover:text-text">
              Sign in
            </Link>
          </nav>
        </div>

        <p className="mt-12 text-xs text-text-mute">
          © {new Date().getFullYear()} VentureGenesis · Built on your numbers
        </p>
      </div>

      {/* The signature, set as artwork rather than as text hoping to fit.
          textLength pins the word to exactly the box width, so it spans the
          measure at every viewport and can never spill past an edge or lose a
          letter; lengthAdjust="spacing" opens the tracking instead of stretching
          the glyphs. The viewBox ends on the baseline, so the mark sits flush to
          the page's bottom edge with no gap beneath it and nothing sliced above. */}
      <div className="mx-auto mt-16 max-w-[1180px] px-5 sm:px-8">
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="xMidYMax meet"
          className="block w-full text-text/[0.16]"
          role="img"
          aria-label="VentureGenesis"
        >
          <text
            x="0"
            y="100"
            textLength="1000"
            lengthAdjust="spacing"
            fontSize="100"
            fontWeight="900"
            fill="currentColor"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            VENTUREGENESIS
          </text>
        </svg>
      </div>
    </footer>
  );
}
