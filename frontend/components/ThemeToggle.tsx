"use client";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function current(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * Tone disc — a bespoke mark rather than the stock sun/moon.
 * The disc is split: one half carries the page's ink, the other its ground, so the
 * glyph literally is the inversion it performs. It rotates a half-turn on toggle,
 * which reads as the surface turning over.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Sync from the DOM after mount so the button matches whatever the boot script set.
  useEffect(() => setTheme(current()), []);

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("vg-theme", next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface3 text-text-mute transition-colors hover:border-line-strong hover:text-text ${className}`}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 20 20"
        aria-hidden
        style={{
          transform: `rotate(${isDark ? 0 : 180}deg)`,
          transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* Filled half — the ink side of the disc. */}
        <path d="M10 3 A7 7 0 0 1 10 17 Z" fill="currentColor" />
      </svg>
    </button>
  );
}
