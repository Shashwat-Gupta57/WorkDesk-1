"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api-client";
import { useAdminUsers, useUpdateAdminUser } from "@/modules/auth/hooks";
import { useAuth } from "@/lib/auth-context";
import type { UserSummary } from "@/modules/auth/types";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: user management — list, suspend/activate, promote/demote.
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={
      "rounded-full px-2 py-0.5 text-xs font-medium " +
      (role === "ADMIN"
        ? "bg-primary/15 text-primary"
        : "bg-surface-container text-text-secondary")
    }>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={
      "rounded-full px-2 py-0.5 text-xs font-medium " +
      (status === "ACTIVE"
        ? "bg-success/15 text-success"
        : "bg-danger/15 text-danger")
    }>
      {status}
    </span>
  );
}

function UserRow({ user, currentUserId }: { user: UserSummary; currentUserId: string }) {
  const update = useUpdateAdminUser();
  const [msg, setMsg] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  async function toggle(field: "status" | "role") {
    setMsg(null);
    const payload =
      field === "status"
        ? { status: user.status === "ACTIVE" ? ("SUSPENDED" as const) : ("ACTIVE" as const) }
        : { role: user.role === "ADMIN" ? ("MEMBER" as const) : ("ADMIN" as const) };
    try {
      await update.mutateAsync({ id: user.id, payload });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed to update user.");
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border-default px-4 py-3 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-text-primary">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {user.name} {isSelf && <span className="text-xs text-text-secondary">(you)</span>}
        </p>
        <p className="truncate text-xs text-text-secondary">{user.email}</p>
        {msg && <p className="text-xs text-danger mt-0.5">{msg}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RoleBadge role={user.role} />
        <StatusBadge status={user.status} />
        <Button
          variant="secondary"
          className="text-xs h-7 px-2"
          onClick={() => toggle("status")}
          disabled={update.isPending || isSelf}
          title={isSelf ? "Cannot modify your own account" : undefined}
        >
          {user.status === "ACTIVE" ? "Suspend" : "Activate"}
        </Button>
        <Button
          variant="ghost"
          className="text-xs h-7 px-2"
          onClick={() => toggle("role")}
          disabled={update.isPending || isSelf}
          title={isSelf ? "Cannot change your own role" : undefined}
        >
          {user.role === "ADMIN" ? "Demote" : "Promote"}
        </Button>
      </div>
    </div>
  );
}

export function AdminUsersPanel() {
  const usersQuery = useAdminUsers();
  const { user: currentUser } = useAuth();
  const users = usersQuery.data ?? [];

  if (usersQuery.isLoading) return <LoadingState />;
  if (usersQuery.error) return <ErrorState message="Failed to load users." onRetry={() => usersQuery.refetch()} />;
  if (users.length === 0) return <EmptyState title="No users found" />;

  return (
    <div className="rounded-lg border border-border-default">
      {users.map((u) => (
        <UserRow key={u.id} user={u} currentUserId={currentUser?.id ?? ""} />
      ))}
    </div>
  );
}
