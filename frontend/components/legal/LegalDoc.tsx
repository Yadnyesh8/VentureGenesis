"use client";
import React from "react";

/**
 * The shell every policy document is set in.
 *
 * These pages are the record behind a product whose whole claim is that nothing
 * is invented, so they are composed as a filed document rather than a marketing
 * page: a masthead carrying the document's real identifiers, a running index
 * that tracks where you actually are, and numbered clauses you can cite back at
 * us. The clause numbers and the effective date are the only monospace on the
 * page — they are reference data, which is the one job that face is here to do.
 */

export type Clause = {
  id: string;
  heading: string;
  body: React.ReactNode;
};

export default function LegalDoc({
  title,
  summary,
  effective,
  version,
  clauses,
  lead,
  leadNote,
}: {
  title: string;
  summary: string;
  effective: string;
  version: string;
  clauses: Clause[];
  /** One short statement at real scale, for the document where the warning IS
      the point. Deliberately rare, and deliberately terse — it has to land in a
      line or two, not stack into a staircase. Type carries the weight, so no
      tinted alert box, no warning icon, no bordered callout. */
  lead?: React.ReactNode;
  /** The specifics, set quietly beneath the statement rather than crammed into
      it. Only meaningful alongside `lead`. */
  leadNote?: React.ReactNode;
}) {
  const [active, setActive] = React.useState(clauses[0]?.id ?? "");

  // The index follows the reading position.
  //
  // Measured directly rather than through an IntersectionObserver: the observer
  // version was silently delivering no callbacks in an embedded browser, which
  // left the index frozen on clause one for the whole document — a control that
  // looks live and is not. Reading the geometry on scroll always answers, and
  // the first measurement runs on mount, so the marker is correct before any
  // scroll event arrives.
  //
  // Nothing on the page is gated on this. Every clause renders and reads
  // whether or not this ever runs; all it decides is which index entry is
  // emphasised.
  React.useEffect(() => {
    const ids = clauses.map((c) => c.id);
    if (!ids.length) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      // SCROLL_LINE clears the sticky header. The last clause to have crossed
      // above it is the one being read; before any has, the first one holds.
      const SCROLL_LINE = 96;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - SCROLL_LINE > 1) break;
        current = id;
      }
      // A short final clause may never reach the line, so the foot of the
      // document always marks the last entry rather than stranding the marker.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atEnd ? ids[ids.length - 1] : current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // A hidden tab delivers neither scroll events nor animation frames, so a
    // document restored from the background can come back with a stale marker.
    // Re-measuring the moment it becomes visible closes that gap.
    const onVisible = () => {
      if (!document.hidden) measure();
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisible);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [clauses]);

  return (
    <article>
      {/* Masthead */}
      <header className="border-b border-line pb-10">
        <h1 className="display-hero max-w-3xl text-[clamp(32px,5vw,52px)]">{title}</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-text-mute">{summary}</p>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="text-xs text-text-faint">In effect from</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-text-dim">{effective}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-faint">Version</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-text-dim">{version}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-faint">Clauses</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-text-dim">
              {String(clauses.length).padStart(2, "0")}
            </dd>
          </div>
        </dl>

        {lead && (
          <div className="mt-10">
            <p className="max-w-[22ch] text-[clamp(26px,4vw,44px)] font-bold leading-[1.15] tracking-[-0.03em] text-text">
              {lead}
            </p>
            {leadNote && (
              <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-text-dim">{leadNote}</p>
            )}
          </div>
        )}
      </header>

      <div className="gap-16 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Index — a real control, not an ornament. The current clause is marked
            by the type itself: it takes the full ink and a heavier weight. */}
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-24 py-12">
            <h2 className="label-mono mb-5">Contents</h2>
            <ol className="space-y-1">
              {clauses.map((c, i) => {
                const on = active === c.id;
                return (
                  <li key={c.id}>
                    <a
                      href={`#${c.id}`}
                      aria-current={on ? "true" : undefined}
                      className={`flex gap-3 rounded-lg px-2 py-1.5 text-sm leading-snug transition-colors ${
                        on ? "font-medium text-text" : "text-text-mute hover:text-text-dim"
                      }`}
                    >
                      <span className="font-mono text-xs tabular-nums text-text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{c.heading}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        {/* Body — held to a reading measure rather than the shell's full width. */}
        <div className="max-w-[68ch] py-12">
          {clauses.map((c, i) => (
            <section key={c.id} id={c.id} className="scroll-mt-24 pb-12 last:pb-0">
              <h2 className="flex gap-4 text-[22px] font-bold leading-snug tracking-[-0.02em] text-text">
                <span className="mt-1.5 shrink-0 font-mono text-xs tabular-nums text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{c.heading}</span>
              </h2>
              <div className="mt-4 space-y-4 pl-0 text-[15px] leading-[1.75] text-text-dim lg:pl-[calc(0.75rem+1rem)]">
                {c.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A bulleted run inside a clause, set on the body's own rhythm. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          {/* A short round-capped tick, drawn to the same stroke language as the
              card glyphs, rather than a bullet dot or a square hairline. */}
          <svg width="14" height="14" viewBox="0 0 14 14" className="mt-[0.45em] shrink-0" aria-hidden>
            <path
              d="M3 7 H10"
              fill="none"
              stroke="var(--text-faint)"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Marks a detail that the operator has to supply before this document is
 * binding — a registered entity, an address, a jurisdiction. Rendered visibly
 * rather than quietly guessed, because inventing those is how a policy becomes
 * a lie.
 */
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded-[4px] bg-amber/15 px-1 py-0.5 font-mono text-[0.85em] text-amber">
      {children}
    </mark>
  );
}
