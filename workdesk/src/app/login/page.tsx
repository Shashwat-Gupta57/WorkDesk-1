"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/components/brand";
import type { SafeUser } from "@/modules/auth/types";

// ─────────────────────────────────────────────────────────────────────────────
// Login page.
//
// POSTs to /api/auth/login (which seals the session cookie), then refreshes the
// auth context and redirects to ?from= (preserved by the proxy) or /dashboard.
// The proxy already bounces authenticated users away from /login.
// ─────────────────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The login route seals the session cookie and returns the safe user.
      const user = await api.post<SafeUser>("/api/auth/login", { email, password });
      // Prime the auth cache synchronously so guarded pages see us as logged in
      // immediately (no await-on-refetch race before navigating).
      setUser(user);
      const from = searchParams.get("from");
      const target = from && from.startsWith("/") ? from : "/dashboard";
      router.replace(target);
      router.refresh(); // re-run the server proxy with the new cookie
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8">
          <Brand />
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Access the organizational knowledge archive.
        </p>

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

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-text-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-surface-container accent-primary"
              />
              Remember me
            </label>
            {/* Forgot-password flow arrives in Slice 5. */}
            <span className="cursor-not-allowed text-text-secondary/60">Forgot password?</span>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
