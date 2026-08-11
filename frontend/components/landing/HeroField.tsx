/**
 * The hero's ground.
 *
 * A fine measuring grid, a slow orbit ring and a few registration marks — the
 * surface of an instrument rather than a sheet of graph paper. It is scoped to
 * the hero (never laid under the whole page), radially masked so it dissolves
 * well before any section edge, and it sits behind every piece of content.
 *
 * Purely decorative, so the whole layer is hidden from assistive tech.
 */
export default function HeroField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Measuring grid — masked to fade out long before it reaches an edge. */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(var(--line-rgb)/0.5) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgb(var(--line-rgb)/0.5) 1px, transparent 1px)",
          backgroundSize: "68px 68px",
          maskImage: "radial-gradient(120% 85% at 50% 34%, #000 0%, #000 38%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(120% 85% at 50% 34%, #000 0%, #000 38%, transparent 78%)",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="vg-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--line-strong-rgb))" stopOpacity="0.9" />
            <stop offset="55%" stopColor="rgb(var(--line-strong-rgb))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(var(--line-strong-rgb))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Orbit ring — the one element that turns, slowly, about its own centre. */}
        <g style={{ transformOrigin: "1145px 250px", animation: "vg-orbit 90s linear infinite" }}>
          <ellipse cx="1145" cy="250" rx="300" ry="96" stroke="url(#vg-ring)" strokeWidth="1" />
          <ellipse cx="1145" cy="250" rx="212" ry="66" stroke="url(#vg-ring)" strokeWidth="1" opacity="0.6" />
        </g>

        {/* Registration marks — drawn where a plate would actually be cropped. */}
        <g stroke="rgb(var(--line-strong-rgb))" strokeWidth="1" opacity="0.5" strokeLinecap="round">
          <path d="M96 128 H140 M96 128 V172" />
          <path d="M1344 772 H1300 M1344 772 V728" />
        </g>

        {/* Two rotated plates, drifting on opposite phases. */}
        <g
          stroke="rgb(var(--line-strong-rgb))"
          strokeWidth="1"
          opacity="0.42"
          style={{ transformOrigin: "196px 640px", animation: "vg-drift 19s ease-in-out infinite" }}
        >
          <rect x="140" y="584" width="112" height="112" rx="10" transform="rotate(45 196 640)" />
        </g>
        <g
          stroke="rgb(var(--line-strong-rgb))"
          strokeWidth="1"
          opacity="0.34"
          style={{ transformOrigin: "312px 232px", animation: "vg-drift 24s ease-in-out infinite reverse" }}
        >
          <rect x="284" y="204" width="56" height="56" rx="6" transform="rotate(28 312 232)" />
        </g>

        <g fill="rgb(var(--text-faint-rgb))" opacity="0.4">
          <circle cx="1060" cy="150" r="2" />
          <circle cx="900" cy="560" r="1.6" />
          <circle cx="1256" cy="470" r="1.6" />
        </g>
      </svg>

      {/* Fine grain, on the substrate only — content paints crisply above it. */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
