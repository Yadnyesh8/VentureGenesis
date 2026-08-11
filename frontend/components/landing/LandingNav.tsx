"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#board", label: "The board" },
];

export default function LandingNav() {
  const [lifted, setLifted] = useState(false);
  const [open, setOpen] = useState(false);

  // The bar earns its surface only once the hero has moved under it — at rest it
  // sits directly on the scene with nothing drawn around it.
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      style={{
        background: lifted ? "rgb(var(--ink-900-rgb) / 0.78)" : "transparent",
        backdropFilter: lifted ? "blur(14px)" : "none",
        WebkitBackdropFilter: lifted ? "blur(14px)" : "none",
        borderBottom: `1px solid ${lifted ? "rgb(var(--line-rgb) / 1)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="VentureGenesis home">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text">VentureGenesis</span>
        </Link>

        {/* The inline set only appears once there is genuinely room for it — at
            768 the labels were wrapping mid-phrase. Below lg the sheet carries them. */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-xl px-3.5 py-2 text-sm text-text-mute transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-3 py-2 text-sm text-text-mute transition-colors hover:text-text sm:inline-flex"
          >
            Sign in
          </Link>
          {/* Below sm the bar carries only the mark and the menu — the action
              moves inside the sheet rather than being squeezed out. */}
          <Link
            href="/sign-up"
            className="hidden items-center rounded-full bg-[var(--inverse-bg)] px-5 py-2.5 text-sm font-semibold tracking-[0.01em] text-[var(--inverse-fg)] transition-opacity hover:opacity-[0.86] sm:inline-flex"
          >
            Try now
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface3 text-text-mute transition-colors hover:text-text lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              {open ? (
                <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5 H13.5 M2.5 11 H13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-ink-900/95 px-5 py-3 backdrop-blur-xl lg:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-2 py-3 text-sm text-text-mute transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-2 py-3 text-sm text-text-mute transition-colors hover:text-text sm:hidden"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="mb-1 mt-3 flex items-center justify-center rounded-full bg-[var(--inverse-bg)] px-5 py-3.5 text-sm font-semibold text-[var(--inverse-fg)] sm:hidden"
          >
            Try now
          </Link>
        </div>
      )}
    </header>
  );
}
