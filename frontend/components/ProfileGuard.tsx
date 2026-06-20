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
          <svg width="34" height="34" viewBox="0 0 22 22" className="[animation:sweep_1s_linear_infinite]">
            <defs>
              <linearGradient id="pg-load" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C6CFF" />
                <stop offset="100%" stopColor="#34E1D2" />
              </linearGradient>
            </defs>
            <circle cx="11" cy="11" r="9" fill="none" stroke="#1B1F2B" strokeWidth="2" />
            <path d="M11 2 a9 9 0 0 1 9 9" fill="none" stroke="url(#pg-load)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="label-mono text-text-mute">{!hydrated ? "CALIBRATING" : "REDIRECTING TO ONBOARDING"}</div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
