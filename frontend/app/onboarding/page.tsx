"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { api, Metrics } from "@/lib/api";
import { useStore } from "@/lib/store";
import { TraceGlyph, RegCross } from "@/components/instrument";
import { fmtMoney, fmtPct } from "@/components/ui";

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

const STEPS: { title: string; blurb: string; fields: Field[] }[] = [
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
      { key: "churn_rate", label: "Monthly churn rate", type: "number", step: 0.01, placeholder: "0.07", unit: "0–1" },
    ],
  },
  {
    title: "Capital & Voice",
    blurb: "Capital position and (optionally) real customer reviews for sentiment.",
    fields: [
      { key: "funding_amount", label: "Total funding raised", type: "number", placeholder: "3000000", unit: "$" },
      { key: "valuation", label: "Current valuation", type: "number", placeholder: "20000000", unit: "$" },
      { key: "reviews", label: "Customer reviews (optional, one per line)", type: "textarea", placeholder: "Great onboarding!\nSupport was slow." },
    ],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { setProfile, setReviews, ready, hydrated, metrics } = useStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, any>>({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    api.config().then((c) => setIndustries(c.config?.industries || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (hydrated && ready && metrics?.startup_name) setForm((f) => ({ ...metrics, ...f }));
  }, [hydrated, ready]); // eslint-disable-line

  const reviewStep = step === STEPS.length;
  const s = STEPS[step];

  function set(key: string, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const missing = (s?.fields || []).filter((f) => f.required && !String(form[f.key] ?? "").trim());
  const canNext = missing.length === 0;

  function next() {
    if (!canNext) { setTouched(true); return; }
    setTouched(false);
    setStep((x) => x + 1);
  }

  const cash = Number(form.cash_reserves) || 0;
  const burn = Number(form.burn_rate) || 0;
  const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : 0;

  async function finish() {
    setSaving(true);
    try {
      const reviews: string[] = (form.reviews || "").split("\n").map((x: string) => x.trim()).filter(Boolean);
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
      if (reviews.length) setReviews(reviews);
      setProfile(m, id); // also resets any prior analysis cache
      router.push("/launching");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <TraceGlyph size={22} />
        <div className="title-display text-[17px]">VENTURE<span className="text-aqua">GENESIS</span></div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[300px_1fr] gap-8 max-w-5xl w-full mx-auto px-6 pb-16">
        <div>
          <div className="display-hero text-[clamp(30px,4vw,46px)] leading-[0.95]">
            {ready ? "UPDATE" : "PROFILE"}<br />{ready ? "PROFILE" : "YOUR STARTUP"}
          </div>
          <p className="label-mono mt-3 leading-relaxed">NO DEMO DATA · EVERY ANSWER FEEDS A REAL MODEL OR AGENT</p>

          {(() => {
            const total = STEPS.length + 1;
            const pct = Math.round((step / (total - 1)) * 100);
            return (
              <div className="mt-7 mb-4">
                <div className="flex items-center justify-between label-mono text-text-faint mb-2">
                  <span>PROGRESS</span><span>{pct}%</span>
                </div>
                <div className="h-[3px] bg-surface3 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#7C6CFF,#34E1D2)" }}
                    animate={{ width: `${pct}%` }} transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }} />
                </div>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            {[...STEPS.map((x) => x.title), "Review"].map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={label}
                  onClick={() => i <= step && setStep(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    active ? "border-violet/60 bg-violet/10" : done ? "border-line hover:bg-surface2 cursor-pointer" : "border-transparent opacity-45 cursor-default"
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg grid place-items-center label-mono text-[10px] shrink-0 border"
                    style={{ borderColor: i <= step ? "var(--violet)" : "var(--line)", background: done ? "var(--violet)" : "transparent", color: done ? "#07080c" : i <= step ? "var(--text)" : "var(--text-mute)" }}>
                    {done ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#07080c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : i + 1}
                  </span>
                  <span className={`text-sm ${active ? "text-text font-medium" : "text-text-dim"}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card relative min-h-[460px] flex flex-col">
          <RegCross className="absolute top-3 right-3 opacity-60" />
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1"
            >
              {!reviewStep ? (
                <>
                  <div className="label-mono">STEP {step + 1} / {STEPS.length}</div>
                  <h2 className="title-display text-2xl mt-1">{s.title}</h2>
                  <p className="text-sm text-text-dim mt-1 mb-6">{s.blurb}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {s.fields.map((f) => (
                      <FieldInput
                        key={f.key}
                        f={f}
                        value={form[f.key]}
                        industries={industries}
                        invalid={touched && f.required && !String(form[f.key] ?? "").trim()}
                        onChange={(v: any) => set(f.key, v)}
                      />
                    ))}
                  </div>
                  {step === 1 && (
                    <div className="mt-4 text-sm text-text-dim">
                      Computed runway: <span className="text-aqua font-semibold">{runway} months</span>
                    </div>
                  )}
                </>
              ) : (
                <ReviewPane form={form} runway={runway} />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-line">
            <button className="btn-ghost" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}>← Back</button>
            {touched && !canNext && <span className="label-mono text-coral">FILL REQUIRED FIELDS</span>}
            {reviewStep ? (
              <button className="btn" onClick={finish} disabled={saving}>{saving ? "Building…" : "Build my board →"}</button>
            ) : step === STEPS.length - 1 ? (
              <button className="btn" onClick={next}>Review →</button>
            ) : (
              <button className="btn" onClick={next}>Next →</button>
            )}
          </div>
        </div>
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
        <select className={`input-field mt-1 ${invalid ? "!border-coral" : ""}`} value={value || ""} onChange={(e) => onChange(e.target.value)}>
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
            onChange={(e) => onChange(e.target.value)}
          />
          {f.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 label-mono text-[9px] pointer-events-none">{f.unit}</span>}
        </div>
      )}
      {f.hint && <span className="block text-[10px] text-text-mute mt-1">{f.hint}</span>}
    </label>
  );
}

function ReviewPane({ form, runway }: any) {
  const row = (k: string, v: any) => (
    <div className="flex justify-between py-1.5 border-b border-line/60 text-sm">
      <span className="text-text-mute">{k}</span>
      <span className="text-text font-medium">{v || "—"}</span>
    </div>
  );
  return (
    <div>
      <div className="label-mono">FINAL STEP</div>
      <h2 className="title-display text-2xl mt-1">Review &amp; launch</h2>
      <p className="text-sm text-text-dim mt-1 mb-5">Confirm your profile. You can edit anything later.</p>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0">
        <div>
          {row("Name", form.startup_name)}
          {row("Industry", form.industry)}
          {row("Model", form.business_model)}
          {row("Stage", form.stage)}
          {row("Founded", form.founding_year)}
          {row("Team", form.employee_count)}
        </div>
        <div>
          {row("Revenue", form.revenue ? fmtMoney(Number(form.revenue)) : "—")}
          {row("Expenses", form.expenses ? fmtMoney(Number(form.expenses)) : "—")}
          {row("Monthly burn", form.burn_rate ? fmtMoney(Number(form.burn_rate)) : "—")}
          {row("Runway", `${runway} mo`)}
          {row("Growth", form.customer_growth ? fmtPct(Number(form.customer_growth)) : "—")}
          {row("Churn", form.churn_rate ? fmtPct(Number(form.churn_rate)) : "—")}
        </div>
      </div>
    </div>
  );
}
