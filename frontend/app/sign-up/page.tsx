"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import AuthShell, { AuthField, AuthError, OrDivider, GoogleButton } from "@/components/AuthShell";

const AFTER_AUTH = "/dashboard";

export default function SignUpPage() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<"register" | "verify">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function fail(err: unknown, fallback: string) {
    setError(isClerkAPIResponseError(err) ? err.errors[0]?.longMessage || err.errors[0]?.message || fallback : fallback);
  }

  async function finalize(sessionId: string | null) {
    await setActive({ session: sessionId });
    router.push(AFTER_AUTH);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      await signUp.create({
        emailAddress: email,
        password,
        firstName: firstName || undefined,
        lastName: rest.join(" ") || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      fail(err, "Could not create your account. Try a different email or a stronger password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === "complete") await finalize(res.createdSessionId);
      else setError("That code was not accepted. Request a new one and try again.");
    } catch (err) {
      fail(err, "Verification failed. Check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!isLoaded || busy) return;
    setError("");
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: AFTER_AUTH,
      });
    } catch (err) {
      fail(err, "Could not start Google sign-up.");
    }
  }

  // ── Email-code verification step ──────────────────────────────────────────
  if (step === "verify") {
    return (
      <AuthShell>
        <div className="label-mono">VERIFY EMAIL</div>
        <h1 className="title-display text-3xl mt-1.5">Check your inbox</h1>
        <p className="text-sm text-text-dim mt-1 mb-6">
          We sent a code to <span className="text-text">{email}</span>.
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <AuthField label="Verification code" value={code} onChange={setCode} placeholder="123456" autoComplete="one-time-code" autoFocus inputMode="numeric" />
          <AuthError>{error}</AuthError>
          <button className="btn w-full !py-3" disabled={busy || !code}>{busy ? "Verifying…" : "Verify & continue →"}</button>
        </form>

        <button
          className="mt-5 label-mono text-text-mute hover:text-aqua transition-colors"
          onClick={() => signUp?.prepareEmailAddressVerification({ strategy: "email_code" })}
        >
          RESEND CODE
        </button>
      </AuthShell>
    );
  }

  // ── Registration step ─────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div className="label-mono">GET STARTED</div>
      <h1 className="title-display text-3xl mt-1.5">Create your board</h1>
      <p className="text-sm text-text-dim mt-1 mb-6">One account to convene every advisor.</p>

      <GoogleButton onClick={handleGoogle} disabled={busy} label="Sign up with Google" />
      <div className="my-4"><OrDivider /></div>

      <form onSubmit={handleRegister} className="space-y-4">
        <AuthField label="Name" value={name} onChange={setName} placeholder="Jane Founder" autoComplete="name" />
        <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@startup.com" autoComplete="email" inputMode="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" />
        <AuthError>{error}</AuthError>
        {/* Clerk bot-protection mounts here (enabled by default for sign-ups). */}
        <div id="clerk-captcha" />
        <button className="btn w-full !py-3" disabled={busy || !email || !password}>{busy ? "Creating…" : "Create account →"}</button>
      </form>

      <p className="text-xs text-text-mute mt-6">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-aqua hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
