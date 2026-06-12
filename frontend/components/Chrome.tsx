"use client";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import ProfileGuard from "@/components/ProfileGuard";

// The landing page at "/" is a public, full-bleed cinematic — no nav chrome, no
// profile gate. Every other route keeps the standard app shell.
export default function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return (
    <>
      <TopNav />
      <main className="max-w-[1500px] mx-auto w-full px-5 py-8 md:py-10">
        <ProfileGuard>{children}</ProfileGuard>
      </main>
    </>
  );
}
