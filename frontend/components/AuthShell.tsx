"use client";
import React from "react";
import { TraceGlyph, RegCross } from "@/components/instrument";

// Shared full-bleed shell for /sign-in and /sign-up — mirrors the onboarding
// aesthetic (brand wordmark, display hero on the left, a glass .card on the
// right) so auth feels like part of the same instrument.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <TraceGlyph size={22} />
        <div className="title-display text-[17px]">
          VENTURE<span className="text-aqua">GENESIS</span>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_minmax(360px,420px)] gap-10 max-w-5xl w-full mx-auto px-6 pb-16 items-center">
        {/* Brand / value panel — identical on both auth pages */}
        <div className="hidden lg:block">
          <div className="display-hero text-[clamp(34px,4.4vw,54px)] leading-[0.92]">
            THE BOARD<br />IS IN<br />SESSION
          </div>
          <p className="label-mono mt-4 leading-relaxed text-text-mute">
            16 AI ADVISORS · TRAINED ON 6,089 REAL STARTUPS
          </p>
          <div className="mt-8 space-y-2.5 max-w-sm">
            {[
              ["Failure & funding models", "calibrated ML"],
              ["Six-agent boardroom debate", "live LLM"],
              ["Scenario twin & pivot engine", "simulation"],
            ].map(([label, tag]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-line bg-surface2/40">
                <span className="flex items-center gap-2.5 text-sm text-text-dim">
                  <span className="w-1.5 h-1.5 rounded-full bg-aqua" />
                  {label}
                </span>
                <span className="label-mono text-[8px] text-text-faint">{tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="card relative">
          <RegCross className="absolute top-3 right-3 opacity-60" />
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Shared form primitives, styled with the existing design tokens ──────────

export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  inputMode,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "email" | "numeric";
}) {
  return (
    <label className="block text-xs text-text-dim">
      <span>{label}</span>
      <input
        className="input-field mt-1"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function AuthError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
      <span aria-hidden className="mt-px">!</span>
      <span>{children}</span>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-line" />
      <span className="label-mono text-[9px] text-text-faint">OR</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function GoogleButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button type="button" className="btn-ghost w-full" onClick={onClick} disabled={disabled}>
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {label}
    </button>
  );
}
