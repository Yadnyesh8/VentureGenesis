"use client";

import { api, type Ref } from "@/lib/api";
import { ErrorBox, useAgent } from "@/components/ui";

// Mirrors the JSON contract in prompts.yaml → startup_understanding.
const FIELDS: [keyof Understanding, string][] = [
  ["industry", "Industry"],
  ["business_model", "Business model"],
  ["stage", "Stage"],
  ["profile", "Growth profile"],
];

type Understanding = {
  industry?: string;
  business_model?: string;
  stage?: string;
  profile?: string;
};

/**
 * On-demand classifier. This used to run on every board pipeline pass; it now
 * costs a model call only when asked for, which matters on a metered key.
 *
 * `enabled: false` keeps useAgent from firing on mount, but its cache lookup
 * still runs — so a result from an earlier run renders immediately instead of
 * making the founder press the button again.
 */
export default function UnderstandingPanel({ r, cacheKey }: { r: Ref; cacheKey: string }) {
  const { data, loading, error, refetch } = useAgent<{ ok: boolean; data: Understanding }>(
    () => api.understand(r),
    [cacheKey],
    "understand",
    { enabled: false }
  );
  const u = data?.data ?? null;

  return (
    <section className="card mt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="card-h !mb-0">Startup understanding</h2>
          <p className="mt-1.5 text-sm text-text-mute">
            Classifies the business from your questionnaire. Costs one model call.
          </p>
        </div>
        <button type="button" onClick={refetch} disabled={loading} className="btn-ghost">
          {loading ? "Reading…" : u ? "Run again" : "Run"}
        </button>
      </div>

      {/* Every field keeps its slot whether or not the model filled it, so the
          columns stay on one baseline instead of collapsing raggedly. The labels
          are held to a single line for the same reason: a wrapped "Business
          model" at the narrow breakpoint would push its value below "Stage". */}
      {u && (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate whitespace-nowrap text-xs text-text-faint">{label}</dt>
              <dd className="mt-1.5 break-words text-[15px] font-medium text-text">{u[key] || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* First run only: on a re-run the previous answer stays on screen rather
          than being replaced by placeholders it is about to replace again. The
          real labels are kept — they are known before the model replies — so
          only the values are stood in for. */}
      {loading && !u && (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4" role="status" aria-label="Classifying your business">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate whitespace-nowrap text-xs text-text-faint">{label}</dt>
              <dd className="mt-1.5 text-[15px] font-medium leading-normal">
                <span className="skeleton inline-block h-[0.9em] w-[5.5em] max-w-full align-middle" />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* ErrorBox carries its own bottom margin for stacked page-level use;
          as the last child here that would leave dead space, so it is cancelled. */}
      {error && (
        <div className="mt-6 [&>div]:mb-0">
          <ErrorBox error={error} />
        </div>
      )}
    </section>
  );
}
