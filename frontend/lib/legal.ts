/** The policy documents, in one place so every footer lists the same set. */
export const LEGAL_DOCS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/accessibility", label: "Accessibility" },
] as const;

/**
 * Every document is dated and versioned together. Bump both when the wording
 * changes materially — the date is what a reader relies on, so it must never
 * drift to "today" on its own.
 */
export const LEGAL_EFFECTIVE = "16 August 2026";
export const LEGAL_VERSION = "1.0";
