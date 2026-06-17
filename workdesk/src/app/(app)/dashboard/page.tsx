"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {isLoading ? "Loading…" : `Welcome back, ${user?.name ?? "there"}.`}
      </p>

      {/* Widgets (Recent, Recently Opened, Starred, Activity, Storage) land in Slice 6. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {["Recent Artifacts", "Recently Opened", "Starred", "Activity Summary", "Storage Usage"].map(
          (title) => (
            <div
              key={title}
              className="rounded-lg border border-border-default bg-surface-container p-5"
            >
              <h2 className="text-sm font-medium text-text-primary">{title}</h2>
              <p className="mt-2 text-xs text-text-secondary">Coming in a later slice.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
