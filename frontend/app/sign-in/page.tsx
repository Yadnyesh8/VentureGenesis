"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import AuthShell, { AuthField, AuthError, OrDivider, GoogleButton } from "@/components/AuthShell";

const AFTER_AUTH = "/dashboard";

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const router = useRouter();

  const [mode, setMode] = useState<"signIn" | "reset">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function fail(err: unknown, fallback: string) {
    setError(isClerkAPIResponseError(err) ? err.errors[0]?.longMessage || err.errors[0]?.message || fallback : fallback);
  }

  async function finalize(sessionId: string | null) {
    await setActive({ session: sessionId });
    router.push(AFTER_AUTH);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === "complete") {
        await finalize(res.createdSessionId);
      } else {
        setError("Additional verification is required. Continue in the Clerk dashboard configuration.");
      }
    } catch (err) {
      fail(err, "Could not sign you in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!isLoaded || busy) return;
    setError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: AFTER_AUTH,
      });
    } catch (err) {
      fail(err, "Could not start Google sign-in.");
    }
  }

  async function sendResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      setCodeSent(true);
    } catch (err) {
      fail(err, "Could not send a reset code to that email.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code });
      if (res.status === "needs_new_password") {
        const done = await signIn.resetPassword({ password: newPassword });
        if (done.status === "complete") await finalize(done.createdSessionId);
      } else if (res.status === "complete") {
        await finalize(res.createdSessionId);
      }
    } catch (err) {
      fail(err, "That code or password was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  // ── Reset-password mode ───────────────────────────────────────────────────
  if (mode === "reset") {
    return (
      <AuthShell>
        <div className="label-mono">ACCOUNT RECOVERY</div>
        <h1 className="title-display text-3xl mt-1.5">Reset password</h1>
        <p className="text-sm text-text-dim mt-1 mb-6">
          {codeSent ? "Enter the code we emailed you and choose a new password." : "We'll email you a verification code."}
        </p>

        {!codeSent ? (
          <form onSubmit={sendResetCode} className="space-y-4">
            <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@startup.com" autoComplete="email" autoFocus inputMode="email" />
            <AuthError>{error}</AuthError>
            <button className="btn w-full !py-3" disabled={busy || !email}>{busy ? "Sending…" : "Send reset code →"}</button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <AuthField label="Verification code" value={code} onChange={setCode} placeholder="123456" autoComplete="one-time-code" autoFocus inputMode="numeric" />
            <AuthField label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="••••••••" autoComplete="new-password" />
            <AuthError>{error}</AuthError>
            <button className="btn w-full !py-3" disabled={busy || !code || !newPassword}>{busy ? "Updating…" : "Update password →"}</button>
          </form>
        )}

        <button
          className="mt-5 label-mono text-text-mute hover:text-aqua transition-colors"
          onClick={() => { setMode("signIn"); setError(""); setCodeSent(false); }}
        >
          ← BACK TO SIGN IN
        </button>
      </AuthShell>
    );
  }

  // ── Sign-in mode ──────────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div className="label-mono">BOARD ACCESS</div>
      <h1 className="title-display text-3xl mt-1.5">Welcome back</h1>
      <p className="text-sm text-text-dim mt-1 mb-6">Sign in to reconvene your virtual board.</p>

      <GoogleButton onClick={handleGoogle} disabled={busy} label="Continue with Google" />
      <div className="my-4"><OrDivider /></div>

      <form onSubmit={handleSignIn} className="space-y-4">
        <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@startup.com" autoComplete="email" inputMode="email" />
        <div>
          <AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          <button
            type="button"
            className="mt-1.5 label-mono text-[9px] text-text-mute hover:text-aqua transition-colors"
            onClick={() => { setMode("reset"); setError(""); }}
          >
            FORGOT PASSWORD?
          </button>
        </div>
        <AuthError>{error}</AuthError>
        <button className="btn w-full !py-3" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in →"}</button>
      </form>

      <p className="text-xs text-text-mute mt-6">
        No account?{" "}
        <Link href="/sign-up" className="text-aqua hover:underline">Create one</Link>
      </p>
    </AuthShell>
  );
}
