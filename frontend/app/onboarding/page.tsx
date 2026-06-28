"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, Metrics } from "@/lib/api";
import { useStore } from "@/lib/store";
import { TraceGlyph, RegCross } from "@/components/instrument";
import { fmtMoney, fmtPct, RUNWAY_INFINITE } from "@/components/ui";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  hint?: string;
  placeholder?: string;
  step?: number;
  unit?: string;
  required?: boolean;
};

// One screen, four labeled sections. Only the three starred fields are required —
// everything else has a safe default so the founder can reach the board in one click.
const SECTIONS: { title: string; blurb: string; fields: Field[] }[] = [
  {
    title: "Company",
    blurb: "The basics — these feed models trained on 6,089 real YC companies.",
    fields: [
      { key: "startup_name", label: "Startup name", type: "text", placeholder: "Acme AI", required: true },
      { key: "industry", label: "Industry", type: "select", options: [], required: true },
      { key: "business_model", label: "Business model", type: "select", options: ["B2B", "B2C", "B2B2C", "Marketplace", "SaaS", "Subscription", "Transactional", "Freemium"] },
      { key: "stage", label: "Stage", type: "select", options: ["Idea", "Pre-Seed", "Seed", "Early", "Series A", "Series B", "Growth", "Late"], required: true },
      { key: "founding_year", label: "Founding year", type: "number", placeholder: "2023", hint: "Used to compute company age." },
      { key: "employee_count", label: "Team size", type: "number", placeholder: "12", unit: "ppl" },
    ],
  },
  {
    title: "Finance",
    blurb: "Your real financials. Runway is computed from cash ÷ monthly burn.",
    fields: [
      { key: "revenue", label: "Annual revenue", type: "number", placeholder: "1200000", unit: "$/yr" },
      { key: "expenses", label: "Annual expenses", type: "number", placeholder: "1800000", unit: "$/yr" },
      { key: "burn_rate", label: "Monthly burn", type: "number", placeholder: "120000", unit: "$/mo" },
      { key: "cash_reserves", label: "Cash in bank", type: "number", placeholder: "720000", unit: "$", hint: "Used to compute runway." },
    ],
  },
  {
    title: "Traction",
    blurb: "Customer signals used by funding and health scoring.",
    fields: [
      { key: "customer_count", label: "Customers", type: "number", placeholder: "340" },
      { key: "customer_growth", label: "Monthly growth rate", type: "number", step: 0.01, placeholder: "0.14", unit: "0–1", hint: "0.14 = 14% MoM" },
      { key: "churn_rate", label: "Monthly churn rate", type: "number", step: 0.01, placeholder: "0.03", unit: "0–1", hint: "0.03 = 3% monthly · drives customer health" },
    ],
  },
  {
    title: "Capital",
    blurb: "Capital position — used by funding and valuation scoring.",
    fields: [
      { key: "funding_amount", label: "Total funding raised", type: "number", placeholder: "3000000", unit: "$" },
      { key: "valuation", label: "Current valuation", type: "number", placeholder: "20000000", unit: "$" },
    ],
  },
];

const REQUIRED: Field[] = SECTIONS.flatMap((s) => s.fields).filter((f) => f.required);

export default function Onboarding() {
  const router = useRouter();
  const { setProfile, ready, hydrated, metrics } = useStore();
  const [form, setForm] = useState<Record<string, any>>({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api.config().then((c) => setIndustries(c.config?.industries || [])).catch(() => {});
  }, []);

  // Prefill when an existing profile is present (returning user updating their numbers).
  useEffect(() => {
    if (hydrated && ready && metrics?.startup_name) setForm((f) => ({ ...metrics, ...f }));
  }, [hydrated, ready]); // eslint-disable-line

  function set(key: string, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const missing = REQUIRED.filter((f) => !String(form[f.key] ?? "").trim());
  const isInvalid = (f: Field) => touched && !!f.required && !String(form[f.key] ?? "").trim();

  const cash = Number(form.cash_reserves) || 0;
  const burn = Number(form.burn_rate) || 0;
  // Zero monthly burn ⇒ no cash-out ⇒ effectively unbounded runway (a profitable company).
  const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : RUNWAY_INFINITE;

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (missing.length > 0) {
      setTouched(true);
      // Bring the first unfilled required field into view and focus it.
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
      });
      return;
    }
    setSaving(true);
    try {
      const m: Metrics = {
        startup_name: form.startup_name || "My Startup",
        industry: form.industry,
        business_model: form.business_model,
        stage: form.stage,
        founding_year: form.founding_year ? Number(form.founding_year) : undefined,
        revenue: Number(form.revenue) || 0,
        expenses: Number(form.expenses) || 0,
        burn_rate: burn,
        runway,
        customer_count: Number(form.customer_count) || 0,
        customer_growth: Number(form.customer_growth) || 0,
        churn_rate: Number(form.churn_rate) || 0,
        funding_amount: Number(form.funding_amount) || 0,
        employee_count: Number(form.employee_count) || 0,
        valuation: Number(form.valuation) || 0,
        status: "Active",
      };
      let id: number | null = null;
      try { id = (await api.createStartup(m))?.id ?? null; } catch {}
      setProfile(m, id); // also resets any prior analysis cache
      router.push("/launching");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-4 sm:px-6 py-5 flex items-center gap-2.5">
        <TraceGlyph size={22} />
        <div className="title-display text-[17px]">VENTURE<span className="text-aqua">GENESIS</span></div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-10 max-w-5xl w-full mx-auto px-4 sm:px-6 pb-16">
        {/* Intro rail — compact on mobile, sticky beside the form on desktop */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="display-hero text-[clamp(26px,4vw,46px)] leading-[0.95]">
            {ready ? "UPDATE" : "PROFILE"}<br />{ready ? "PROFILE" : "YOUR STARTUP"}
          </div>
          <p className="label-mono mt-3 leading-relaxed">NO DEMO DATA · EVERY ANSWER FEEDS A REAL MODEL OR AGENT</p>

          {/* Feature bullets — hidden on mobile to surface the form faster */}
          <div className="hidden lg:block mt-6 space-y-2.5">
            {[
              ["One screen", "no multi-step wizard"],
              ["3 required fields", "the rest are optional"],
              ["One click to launch", "straight to your live board"],
            ].map(([h, d]) => (
              <div key={h} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-4 h-4 rounded-md grid place-items-center shrink-0 bg-violet/20 border border-violet/40">
                  <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="var(--violet)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="text-sm leading-tight">
                  <span className="text-text font-medium">{h}</span>
                  <span className="text-text-mute"> — {d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Single-screen form */}
        <motion.form
          ref={formRef}
          onSubmit={finish}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card relative flex flex-col"
        >
          <RegCross className="absolute top-3 right-3 opacity-60" />

          {touched && missing.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 px-3 py-2.5 text-[13px] text-coral mb-6">
              <span aria-hidden className="mt-px">!</span>
              <span>Add your {missing.map((f) => f.label.toLowerCase()).join(", ")} to build your board.</span>
            </div>
          )}

          <div className="space-y-8">
            {SECTIONS.map((sec, i) => (
              <section key={sec.title}>
                <div className="flex items-baseline gap-2">
                  <span className="label-mono text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="title-display text-xl">{sec.title}</h2>
                </div>
                <p className="text-sm text-text-dim mt-1 mb-4">{sec.blurb}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sec.fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      f={f}
                      value={form[f.key]}
                      industries={industries}
                      invalid={isInvalid(f)}
                      onChange={(v: any) => set(f.key, v)}
                    />
                  ))}
                </div>
                {sec.title === "Finance" && (
                  <div className="mt-4 text-sm text-text-dim">
                    Computed runway:{" "}
                    <span className="text-aqua font-semibold">
                      {runway >= RUNWAY_INFINITE ? "∞ (profitable — no monthly burn)" : `${runway} months`}
                    </span>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Single action — full-width on mobile, inline on desktop */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-5 border-t border-line">
            <span className="label-mono text-text-mute">
              <span className="text-coral">*</span> required · everything else optional
            </span>
            <button className="btn w-full sm:w-auto !py-3" disabled={saving} aria-busy={saving}>
              {saving ? "Building…" : "Build my board →"}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}

function FieldInput({ f, value, onChange, industries, invalid }: any) {
  const opts = f.key === "industry" ? industries : f.options || [];
  const full = f.type === "textarea";
  return (
    <label className={`text-xs text-text-dim ${full ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center gap-1">{f.label}{f.required && <span className="text-coral">*</span>}</span>
      {f.type === "select" ? (
        <select
          className={`input-field mt-1 ${invalid ? "!border-coral" : ""}`}
          value={value || ""}
          aria-invalid={invalid || undefined}
          aria-required={f.required || undefined}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === "textarea" ? (
        <textarea className="input-field mt-1 h-24" placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="relative mt-1">
          <input
            type={f.type}
            step={f.step}
            inputMode={f.type === "number" ? "decimal" : undefined}
            onWheel={f.type === "number" ? (e) => (e.currentTarget as HTMLInputElement).blur() : undefined}
            className={`input-field ${f.unit ? "pr-12" : ""} ${invalid ? "!border-coral" : ""}`}
            placeholder={f.placeholder}
            value={value ?? ""}
            aria-invalid={invalid || undefined}
            aria-required={f.required || undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {f.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 label-mono text-[9px] pointer-events-none">{f.unit}</span>}
        </div>
      )}
      {invalid ? (
        <span className="block text-[10px] text-coral mt-1">{f.label} is required.</span>
      ) : f.hint ? (
        <span className="block text-[10px] text-text-mute mt-1">{f.hint}</span>
      ) : null}
    </label>
  );
}
