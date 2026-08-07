"use client";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import ProfileGuard from "@/components/ProfileGuard";

// The landing page and the auth pages are public, full-bleed surfaces —
// no nav chrome, no profile gate. Every other route keeps the app shell.
const FULL_BLEED = ["/sign-in", "/sign-up", "/sso-callback"];

export default function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/" || FULL_BLEED.some((p) => path.startsWith(p))) return <>{children}</>;

  const onboarding = path === "/onboarding";

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-shell flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <ProfileGuard>{children}</ProfileGuard>
      </main>
      {!onboarding && <Footer />}
    </div>
  );
}
