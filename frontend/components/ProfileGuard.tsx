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

  if (!hydrated) {
    return <div className="label-mono p-8">CALIBRATING…</div>;
  }
  if (!ready && !onboarding) {
    return <div className="label-mono p-8">REDIRECTING TO ONBOARDING…</div>;
  }
  return <>{children}</>;
}
