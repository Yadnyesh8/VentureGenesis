"use client";
import React from "react";
import { CHART } from "@/lib/chartTheme";

// Tiny registration cross (+) for card/page corners.
export function RegCross({ className = "", size = 8 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" className={className} aria-hidden>
      <path d="M4 0V8M0 4H8" stroke="var(--line-strong)" strokeWidth="1" />
    </svg>
  );
}

// Mono coordinate index tag e.g. [ 04 · FORECAST ]
export function CoordTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-mono inline-flex items-center gap-1.5">
      <span className="text-text-mute">[</span>
      {children}
      <span className="text-text-mute">]</span>
    </span>
  );
}

// Accelerating-trace brand glyph (also used for loading / empty states).
export function TraceGlyph({ size = 22, className = "", animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="vg-trace" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={CHART.violet} />
          <stop offset="100%" stopColor={CHART.aqua} />
        </linearGradient>
      </defs>
      <path
        d="M2 20 L7 17 L11 18 L15 11 L19 12 L22 4"
        stroke="url(#vg-trace)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="4" r="2" fill={CHART.aqua}>
        {animated && <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

// Concentric tick marks around a radial gauge (instrument feel).
export function GaugeTicks({ count = 36 }: { count?: number }) {
  const ticks = Array.from({ length: count });
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      {ticks.map((_, i) => {
        const a = (i / count) * 270 - 225; // span ~270deg
        const rad = (a * Math.PI) / 180;
        const r1 = 96, r2 = i % 3 === 0 ? 88 : 92;
        const cx = 100, cy = 100;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(rad)} y1={cy + r1 * Math.sin(rad)}
            x2={cx + r2 * Math.cos(rad)} y2={cy + r2 * Math.sin(rad)}
            stroke="var(--line-strong)" strokeWidth="1" opacity={0.6}
          />
        );
      })}
    </svg>
  );
}

// Custom dark tooltip — value in display, label in mono.
export function InstrumentTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: CHART.tooltipBg,
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 12px 32px rgba(0,0,0,.45)",
      }}
    >
      {label != null && (
        <div className="label-mono" style={{ marginBottom: 6 }}>{label}</div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginTop: i ? 4 : 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span className="label-mono" style={{ color: "var(--text-dim)" }}>{p.name}</span>
          <span
            style={{
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18,
              color: p.color || p.fill, marginLeft: "auto", paddingLeft: 14,
            }}
          >
            {fmt ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
