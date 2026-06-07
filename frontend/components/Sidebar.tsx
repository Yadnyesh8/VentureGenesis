"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { TraceGlyph } from "./instrument";

const NAV = [
  ["/dashboard", "Dashboard", "01"],
  ["/health", "Health", "02"],
  ["/failure", "Failure", "03"],
  ["/forecast", "Forecast", "04"],
  ["/funding", "Funding", "05"],
  ["/customer", "Customer", "06"],
  ["/competitor", "Competitor", "07"],
  ["/market", "Market", "08"],
  ["/pivots", "Pivots", "09"],
  ["/simulation", "Simulation", "10"],
  ["/board", "Board", "11"],
  ["/report", "Report", "12"],
];

export default function Sidebar() {
  const path = usePathname();
  const { metrics, ready } = useStore();
  return (
    <aside className="w-60 shrink-0 border-r border-line bg-ink-850 p-4 hidden md:flex flex-col h-screen sticky top-0">
      <div className="px-2 mb-8 flex items-center gap-2">
        <TraceGlyph size={22} />
        <div>
          <div className="title-display text-[18px] leading-none">
            VENTURE<span className="text-aqua">GENESIS</span>
          </div>
          <div className="label-mono mt-1 text-[9px]">STARTUP OS · v1.0</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto flex-1">
        {NAV.map(([href, label, n]) => {
          const active = path === href;
          return (
            <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
              {active && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                  style={{ background: "linear-gradient(180deg,#7C6CFF,#34E1D2)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="text-[9px] text-text-mute w-4">{n}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 px-3 py-3 rounded-xl bg-surface2 border border-line">
        <div className="label-mono text-[9px]">ACTIVE SUBJECT</div>
        <div className="title-display text-[15px] truncate mt-1">{ready ? metrics.startup_name || "—" : "NOT SET"}</div>
        <div className="label-mono text-[9px] mt-1 text-text-dim truncate">
          {ready ? `${metrics.industry || "—"} · ${metrics.stage || "—"}` : "AWAITING PROFILE"}
        </div>
      </div>
    </aside>
  );
}
