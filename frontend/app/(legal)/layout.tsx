import Link from "next/link";
import Image from "next/image";
import { LEGAL_DOCS } from "@/lib/legal";

/**
 * The policy documents carry their own chrome.
 *
 * They have to be readable by someone who is signed out and has never filled in
 * the questionnaire — a terms page you can only reach past an auth wall and an
 * onboarding gate is not a terms page — so they sit outside both the app nav
 * and the profile guard, on the same surface and the same palette as everything
 * else.
 */

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-ink-900">
        <div className="mx-auto flex h-[72px] max-w-shell items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
            <span className="text-[17px] font-bold tracking-[-0.02em] text-text">VentureGenesis</span>
          </Link>
          <Link href="/dashboard" className="btn-ghost h-10">
            Open the board
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell flex-1 px-5 py-12 sm:px-6 sm:py-16">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-shell px-5 py-12 sm:px-6">
          {/* The sibling documents, on the same margin as the body above. */}
          <nav aria-label="Policies" className="flex flex-wrap gap-x-8 gap-y-3">
            {LEGAL_DOCS.map((d) => (
              <Link key={d.href} href={d.href} className="text-sm text-text-mute transition-colors hover:text-text">
                {d.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 text-xs text-text-faint">
            © {new Date().getFullYear()} VentureGenesis · Built on your numbers
          </p>
        </div>
      </footer>
    </div>
  );
}
