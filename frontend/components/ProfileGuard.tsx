"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

// Until the founder completes the questionnaire, every page redirects to /onboarding.
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { ready, hydrated } = useStore();
  const path = usePathname();
  const router = useRouter();
  const onboarding = path === "/onboarding";

  useEffect(() => {
    if (hydrated && !ready && !onboarding) router.replace("/onboarding");
  }, [hydrated, ready, onboarding, router]);

  if (!hydrated || (!ready && !onboarding)) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <svg width="28" height="28" viewBox="0 0 18 18" className="[animation:sweep_0.9s_linear_infinite]" aria-hidden>
            <circle cx="9" cy="9" r="7" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
            <path d="M9 2 a7 7 0 0 1 7 7" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-text-mute">{!hydrated ? "Loading your workspace" : "Redirecting to onboarding"}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
