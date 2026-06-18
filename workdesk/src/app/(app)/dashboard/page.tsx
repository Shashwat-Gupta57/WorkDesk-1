"use client";

import { useAuth } from "@/lib/auth-context";
import { RecentArtifactsWidget } from "@/components/dashboard/recent-artifacts-widget";
import { RecentlyOpenedWidget } from "@/components/dashboard/recently-opened-widget";
import { StarredWidget } from "@/components/dashboard/starred-widget";
import { ActivityWidget } from "@/components/dashboard/activity-widget";
import { StorageWidget } from "@/components/dashboard/storage-widget";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — five widgets in a responsive grid.
//
// Widgets: Recent Artifacts (by updatedAt), Recently Opened (access log),
// Starred, Activity Summary (ActivityEvent feed), Storage Usage.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          {isLoading ? "Dashboard" : `Welcome back, ${user?.name?.split(" ")[0] ?? "there"}.`}
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">Here&apos;s what&apos;s happening in your archive.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RecentArtifactsWidget />
        <RecentlyOpenedWidget />
        <StarredWidget />
        <ActivityWidget />
        <StorageWidget />
      </div>
    </div>
  );
}
