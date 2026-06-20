"use client";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import ProfileGuard from "@/components/ProfileGuard";

// The landing page at "/" and the auth pages are public, full-bleed surfaces —
// no nav chrome, no profile gate. Every other route keeps the app shell.
const FULL_BLEED = ["/sign-in", "/sign-up", "/sso-callback"];

export default function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/" || FULL_BLEED.some((p) => path.startsWith(p))) return <>{children}</>;
  return (
    <>
      <TopNav />
      <main className="max-w-[1500px] mx-auto w-full px-5 py-8 md:py-10">
        <ProfileGuard>{children}</ProfileGuard>
      </main>
    </>
  );
}
