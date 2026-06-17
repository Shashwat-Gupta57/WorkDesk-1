"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { useResetPassword } from "@/modules/auth/hooks";
import { ApiError } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Reset-password page. Reads ?token= from the URL (set by the reset link).
// ─────────────────────────────────────────────────────────────────────────────

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const resetPassword = useResetPassword();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    try {
      await resetPassword.mutateAsync({ token, newPassword: newPw, confirmPassword: confirmPw });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (!token) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-danger">
        Invalid reset link. <Link href="/forgot-password" className="underline">Request a new one.</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 px-3 py-3 text-sm text-success">
        Password updated! Redirecting to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="new-pw" className="mb-1.5 block text-sm text-text-secondary">New password</label>
        <input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="confirm-pw" className="mb-1.5 block text-sm text-text-secondary">Confirm password</label>
        <input
          id="confirm-pw"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={resetPassword.isPending}
        className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resetPassword.isPending ? "Updating…" : "Set new password"}
      </button>

      <p className="text-center text-sm text-text-secondary">
        <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Brand /></div>
        <h1 className="text-xl font-semibold text-text-primary">Set new password</h1>
        <p className="mt-1 text-sm text-text-secondary">Choose a strong password for your account.</p>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
