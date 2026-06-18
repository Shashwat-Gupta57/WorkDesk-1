"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/components/brand";
import type { SafeUser } from "@/modules/auth/types";

function AuthForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Brand />
        </div>
        {mode === "signin" ? (
          <SignInForm onSwitch={() => setMode("signup")} />
        ) : (
          <SignUpForm onSwitch={() => setMode("signin")} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────────────────────────────────────

function SignInForm({ onSwitch }: { onSwitch: () => void }) {
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
      const user = await api.post<SafeUser>("/api/auth/login", { email, password, rememberMe: remember });
      setUser(user);
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-text-secondary">
        Sign in to your Flex Studios workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className="mb-1.5 block text-sm text-text-secondary">
            Email
          </label>
          <input
            id="signin-email"
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
          <label htmlFor="signin-password" className="mb-1.5 block text-sm text-text-secondary">
            Password
          </label>
          <input
            id="signin-password"
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
          <a href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </a>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
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

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-primary hover:underline focus:outline-none"
        >
          Create one
        </button>
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────────────────────────────────────

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const { setUser } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      const user = await api.post<SafeUser>("/api/auth/signup", { name, phone, email, password, confirmPassword });
      setUser(user);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.details) {
          const flat = err.details as { fieldErrors?: Record<string, string[]> };
          if (flat.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [k, msgs] of Object.entries(flat.fieldErrors)) {
              mapped[k] = (msgs as string[])[0] ?? "";
            }
            setFieldErrors(mapped);
            setSubmitting(false);
            return;
          }
        }
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Create an account</h1>
      <p className="mt-1 mb-6 text-sm text-text-secondary">
        Join your Flex Studios workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="mb-1.5 block text-sm text-text-secondary">
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Jane Smith"
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-danger">{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor="signup-phone" className="mb-1.5 block text-sm text-text-secondary">
            Phone number
          </label>
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="+1 555 000 0000"
          />
          {fieldErrors.phone && <p className="mt-1 text-xs text-danger">{fieldErrors.phone}</p>}
        </div>

        <div>
          <label htmlFor="signup-email" className="mb-1.5 block text-sm text-text-secondary">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="you@flexstudios.com"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-danger">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-1.5 block text-sm text-text-secondary">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-text-secondary">
            Min 8 chars · one uppercase · one lowercase · one number.
          </p>
          {fieldErrors.password && <p className="mt-1 text-xs text-danger">{fieldErrors.password}</p>}
        </div>

        <div>
          <label htmlFor="signup-confirm" className="mb-1.5 block text-sm text-text-secondary">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-danger">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-primary hover:underline focus:outline-none"
        >
          Sign in
        </button>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForms />
    </Suspense>
  );
}
