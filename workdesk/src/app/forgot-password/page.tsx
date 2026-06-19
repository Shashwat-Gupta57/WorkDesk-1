"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { useForgotPassword } from "@/modules/auth/hooks";
import { ApiError } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await forgotPassword.mutateAsync(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Brand />
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Reset your password</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Enter your email and we&apos;ll send a password reset link.
        </p>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-success/40 bg-success/10 px-3 py-3 text-sm text-success">
              If that email is registered, a reset link has been sent. Check your inbox.
            </div>
            <p className="text-sm text-text-secondary">
              Didn&apos;t receive it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-primary hover:underline"
              >
                try again
              </button>.
            </p>
            <p className="text-sm text-text-secondary">
              <Link href="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@flexstudios.com"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={forgotPassword.isPending}
              className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotPassword.isPending ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-text-secondary">
              <Link href="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
