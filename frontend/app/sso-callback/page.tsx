"use client";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { TraceGlyph } from "@/components/instrument";

// Intermediate landing for Google/OAuth redirects. Clerk completes the handshake
// and forwards to the dashboard (or back to sign-in on failure).
export default function SSOCallback() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <TraceGlyph size={34} animated />
        <div className="label-mono text-text-mute">COMPLETING SIGN-IN</div>
      </div>
      <AuthenticateWithRedirectCallback signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" />
    </div>
  );
}
