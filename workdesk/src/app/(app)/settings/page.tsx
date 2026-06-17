"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AdminUsersPanel } from "@/components/admin/users-panel";
import { AdminAuditLogPanel } from "@/components/admin/audit-log-panel";
import { AdminOwnershipPanel } from "@/components/admin/ownership-panel";

// ─────────────────────────────────────────────────────────────────────────────
// Settings page. Regular members see a placeholder; admins see a tabbed panel.
// ─────────────────────────────────────────────────────────────────────────────

type AdminTab = "users" | "audit" | "ownership";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "users", label: "User management" },
  { id: "audit", label: "Audit log" },
  { id: "ownership", label: "Ownership transfer" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");

  if (user?.role !== "ADMIN") {
    return (
      <div className="px-8 py-6">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          No settings are available for your account yet. Admin tools are restricted to administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Admin settings</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Manage workspace users, review audit history, and transfer ownership.</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-border-default">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px " +
              (tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsersPanel />}
      {tab === "audit" && <AdminAuditLogPanel />}
      {tab === "ownership" && <AdminOwnershipPanel />}
    </div>
  );
}
