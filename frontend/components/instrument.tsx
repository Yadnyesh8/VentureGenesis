"use client";
import React from "react";

// Small shared marks. Exports are unchanged so existing pages keep working;
// the treatments now follow the single palette (no gradients, no glow).

// Registration cross used as a quiet corner tick.
export function RegCross({ className = "", size = 8 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" className={className} aria-hidden>
      <path d="M4 0V8M0 4H8" stroke="var(--line-strong)" strokeWidth="1" />
    </svg>
  );
}

// Small muted index label.
export function CoordTag({ children }: { children: React.ReactNode }) {
  return <span className="label-mono">{children}</span>;
}

// Accelerating-trace mark — the product's signature glyph, drawn in one stroke.
export function TraceGlyph({ size = 22, className = "", animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M2 20 L7 17 L11 18 L15 11 L19 12 L22 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="4" r="2" fill="currentColor">
        {animated && <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

// Concentric ticks around a radial gauge.
export function GaugeTicks({ count = 36 }: { count?: number }) {
  const ticks = Array.from({ length: count });
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {ticks.map((_, i) => {
        const a = (i / count) * 270 - 225;
        const rad = (a * Math.PI) / 180;
        const r1 = 96;
        const r2 = i % 3 === 0 ? 88 : 92;
        const cx = 100;
        const cy = 100;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(rad)}
            y1={cy + r1 * Math.sin(rad)}
            x2={cx + r2 * Math.cos(rad)}
            y2={cy + r2 * Math.sin(rad)}
            stroke="var(--line-strong)"
            strokeWidth="1"
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}

// Chart tooltip on the app's own card surface.
export function InstrumentTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {label != null && (
        <div style={{ marginBottom: 6, fontSize: 12, color: "var(--text-mute)" }}>{label}</div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginTop: i ? 4 : 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ fontSize: 13, color: "var(--text-mute)" }}>{p.name}</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              fontVariantNumeric: "tabular-nums",
              color: "var(--text)",
              marginLeft: "auto",
              paddingLeft: 16,
            }}
          >
            {fmt ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
