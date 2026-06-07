"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Metrics } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  hint?: string;
  placeholder?: string;
  step?: number;
};

const STEPS: { title: string; desc: string; fields: Field[] }[] = [
  {
    title: "About your startup",
    desc: "The basics — these feed the models trained on 6,000+ real YC companies.",
    fields: [
      { key: "startup_name", label: "Startup name", type: "text", placeholder: "Acme AI" },
      { key: "industry", label: "Industry", type: "select", options: [] },
      { key: "business_model", label: "Business model", type: "select", options: ["B2B", "B2C", "B2B2C", "Marketplace", "SaaS", "Subscription", "Transactional", "Freemium"] },
      { key: "stage", label: "Stage", type: "select", options: ["Idea", "Pre-Seed", "Seed", "Early", "Series A", "Series B", "Growth", "Late"] },
      { key: "founding_year", label: "Founding year", type: "number", placeholder: "2023", hint: "Used to compute company age." },
      { key: "employee_count", label: "Team size", type: "number", placeholder: "12" },
    ],
  },
  {
    title: "Revenue & costs",
    desc: "Your real financials. Runway is computed from cash ÷ monthly burn.",
    fields: [
      { key: "revenue", label: "Annual revenue ($)", type: "number", placeholder: "1200000" },
      { key: "expenses", label: "Annual expenses ($)", type: "number", placeholder: "1800000" },
      { key: "burn_rate", label: "Monthly burn ($/mo)", type: "number", placeholder: "120000" },
      { key: "cash_reserves", label: "Cash in bank ($)", type: "number", placeholder: "720000", hint: "Used to compute runway." },
    ],
  },
  {
    title: "Customers & growth",
    desc: "Traction signals used by funding readiness, churn and health scoring.",
    fields: [
      { key: "customer_count", label: "Customers", type: "number", placeholder: "340" },
      { key: "customer_growth", label: "Monthly growth rate (0–1)", type: "number", step: 0.01, placeholder: "0.14", hint: "0.14 = 14% MoM" },
      { key: "churn_rate", label: "Monthly churn rate (0–1)", type: "number", step: 0.01, placeholder: "0.07" },
    ],
  },
  {
    title: "Funding & voice of customer",
    desc: "Capital position and (optionally) real customer reviews for sentiment.",
    fields: [
      { key: "funding_amount", label: "Total funding raised ($)", type: "number", placeholder: "3000000" },
      { key: "valuation", label: "Current valuation ($)", type: "number", placeholder: "20000000" },
      { key: "reviews", label: "Customer reviews (optional, one per line)", type: "textarea", placeholder: "Great onboarding!\nSupport was slow." },
    ],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { setProfile, setReviews, ready, hydrated } = useStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, any>>({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.config().then((c) => setIndustries(c.config?.industries || [])).catch(() => {});
  }, []);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  function set(key: string, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function finish() {
    setSaving(true);
    try {
      const reviews: string[] = (form.reviews || "").split("\n").map((s: string) => s.trim()).filter(Boolean);
      const cash = Number(form.cash_reserves) || 0;
      const burn = Number(form.burn_rate) || 0;
      const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : 0;

      const metrics: Metrics = {
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

      let startupId: number | null = null;
      try {
        const created = await api.createStartup(metrics);
        startupId = created?.id ?? null;
      } catch {
        /* persistence optional — still proceed with inline metrics */
      }
      setProfile(metrics, startupId);
      if (reviews.length) setReviews(reviews);
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) return null;
  const s = STEPS[step];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="display-hero text-[clamp(28px,4vw,48px)]">
          {ready ? "UPDATE PROFILE" : "PROFILE YOUR STARTUP"}
        </div>
        <p className="label-mono mt-2">NO DEMO DATA · ANALYSIS BUILT ENTIRELY FROM YOUR ANSWERS</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((st, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className="w-6 h-6 rounded-full grid place-items-center label-mono text-[10px] shrink-0 border"
              style={{
                borderColor: i <= step ? "var(--violet)" : "var(--line)",
                color: i <= step ? "var(--text)" : "var(--text-mute)",
                background: i < step ? "var(--violet)" : "transparent",
              }}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-[2px] flex-1 rounded-full" style={{ background: i < step ? "linear-gradient(90deg,#7C6CFF,#34E1D2)" : "var(--line)" }} />
            )}
          </div>
        ))}
      </div>

      <Card title={`Step ${step + 1}/${STEPS.length} · ${s.title}`}>
        <p className="text-sm text-muted mb-4">{s.desc}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {s.fields.map((f) => {
            const opts = f.key === "industry" ? industries : f.options || [];
            const full = f.type === "textarea";
            return (
              <label key={f.key} className={`text-xs text-muted ${full ? "sm:col-span-2" : ""}`}>
                {f.label}
                {f.type === "select" ? (
                  <select
                    className="input-field mt-1"
                    value={form[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    className="input-field mt-1 h-24"
                    placeholder={f.placeholder}
                    value={form[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={f.type}
                    step={f.step}
                    className="input-field mt-1"
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.hint && <span className="block text-[10px] text-muted mt-1">{f.hint}</span>}
              </label>
            );
          })}
        </div>

        <div className="flex justify-between mt-6">
          <button className="btn-ghost" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={isFirst}>
            ← Back
          </button>
          {isLast ? (
            <button className="btn" onClick={finish} disabled={saving}>
              {saving ? "Analyzing…" : "Build my board →"}
            </button>
          ) : (
            <button className="btn" onClick={() => setStep((x) => x + 1)}>Next →</button>
          )}
        </div>
      </Card>
    </div>
  );
}
