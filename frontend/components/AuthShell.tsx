"use client";
import React from "react";
import { TraceGlyph, RegCross } from "@/components/instrument";

// Shared full-bleed shell for /sign-in and /sign-up. Left = one large brand
// name; right = a roomy glass card holding the form.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 gap-12 max-w-6xl w-full mx-auto px-6 py-10 items-center">
      {/* Brand — a single oversized wordmark, no supporting copy */}
      <div className="hidden lg:flex flex-col justify-center">
        <TraceGlyph size={44} />
        <h1 className="display-hero text-[clamp(56px,8vw,108px)] leading-[0.84] mt-7">
          VENTURE
          <br />
          <span style={{ WebkitTextFillColor: "#34E1D2", color: "#34E1D2" }}>GENESIS</span>
        </h1>
      </div>

      {/* Form card */}
      <div className="w-full max-w-[480px] mx-auto lg:mx-0 lg:justify-self-end">
        {/* Compact brand for small screens (the big one is hidden there) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-6">
          <TraceGlyph size={26} />
          <div className="title-display text-[19px]">
            VENTURE<span className="text-aqua">GENESIS</span>
          </div>
        </div>

        <div className="card relative p-8 sm:p-10">
          <RegCross className="absolute top-3.5 right-3.5 opacity-60" />
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
    <label className="block text-[13px] text-text-dim">
      <span>{label}</span>
      <input
        className="input-field mt-1.5 !py-3 !text-[15px]"
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
    <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 px-3 py-2.5 text-[13px] text-coral">
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
    <button type="button" className="btn-ghost w-full !py-3 !text-xs" onClick={onClick} disabled={disabled}>
      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {label}
    </button>
  );
}
