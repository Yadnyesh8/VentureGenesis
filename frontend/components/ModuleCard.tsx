"use client";
import Link from "next/link";
import CardVisual, { type Visual } from "@/components/CardVisual";

export type Verdict = { label: string; tone: "good" | "warn" | "bad" | "info" | "idle" };

export type Module = {
  href: string;
  title: string;
  blurb: string;
  engine: string;      // what computes it — the card's "source"
  family: string;      // grouping used by the filter chips
  verdict: Verdict;
  reading: string;     // the live figure, or an em dash when not yet computed
  visual: Visual;
};

const VERDICT_BG: Record<Verdict["tone"], string> = {
  good: "var(--fill-good)",
  warn: "var(--fill-warn)",
  bad: "var(--fill-bad)",
  info: "var(--fill-info)",
  idle: "var(--fill-neutral)",
};

export default function ModuleCard({
  module: m,
  pinned,
  onTogglePin,
}: {
  module: Module;
  pinned: boolean;
  onTogglePin: (href: string) => void;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface card-hover">
      {/* Pin — sits in the same slot as the reference's bookmark, and works. */}
      <button
        type="button"
        onClick={() => onTogglePin(m.href)}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${m.title}` : `Pin ${m.title}`}
        title={pinned ? "Unpin" : "Pin to top"}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full transition-colors"
        style={{
          background: "rgba(0,0,0,0.55)",
          color: pinned ? "#ffffff" : "rgba(255,255,255,0.75)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden>
          <path
            d="M12.5 2.5 L17.5 7.5 L14.6 8.4 L11.8 12.6 L7.4 8.2 L11.6 5.4 Z"
            fill={pinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7.4 8.2 L2.8 17.2 L11.8 12.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Media — the module's real reading, or its pictogram when not yet run */}
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface2">
        <Link href={m.href} className="absolute inset-0 block" aria-label={m.title}>
          <span className="media-zoom block h-full w-full">
            <CardVisual visual={m.visual} />
          </span>
        </Link>

        {/* Badges — engine on the left, verdict on the right */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span
            className="pointer-events-auto rounded-[10px] px-2 py-1 text-xs font-medium text-white"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          >
            {m.engine}
          </span>
          <span
            className="pointer-events-auto rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ background: VERDICT_BG[m.verdict.tone] }}
          >
            {m.verdict.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <Link href={m.href} className="mb-2 block">
          <h3 className="clamp-2 text-lg font-semibold leading-snug text-text transition-colors group-hover:text-text-dim">
            {m.title}
          </h3>
        </Link>

        <p className="clamp-2 mb-4 min-h-[2.625rem] text-sm leading-relaxed text-text-mute">{m.blurb}</p>

        {/* Spacer keeps every card's bottom row on one baseline */}
        <div className="flex-1" />

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-xs text-text-faint">{m.family}</span>
          <span className="text-sm font-semibold tabular-nums text-text">{m.reading}</span>
        </div>
      </div>
    </article>
  );
}
