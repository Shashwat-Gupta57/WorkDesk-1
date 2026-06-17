"use client";

import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useAuditLogs } from "@/modules/auth/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: audit log viewer — most recent 100 entries.
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ACTION_COLORS: Record<string, string> = {
  USER_SUSPENDED: "text-danger",
  USER_ACTIVATED: "text-success",
  USER_ROLE_CHANGED: "text-warning",
  PASSWORD_CHANGED: "text-warning",
  EMAIL_CHANGED: "text-warning",
  PROFILE_UPDATED: "text-text-secondary",
  OWNERSHIP_TRANSFERRED: "text-primary",
  ARTIFACT_DELETED: "text-danger",
  SET_DELETED: "text-danger",
  ARTIFACT_VERSION_COMMITTED: "text-success",
  ARTIFACT_VERSION_RESTORED: "text-primary",
};

export function AdminAuditLogPanel() {
  const logsQuery = useAuditLogs(100);
  const logs = logsQuery.data ?? [];

  if (logsQuery.isLoading) return <LoadingState />;
  if (logsQuery.error) return <ErrorState message="Failed to load audit log." onRetry={() => logsQuery.refetch()} />;
  if (logs.length === 0) return <EmptyState title="No audit entries yet" />;

  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-high text-xs text-text-secondary">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Action</th>
            <th className="px-4 py-2 text-left font-medium">Actor</th>
            <th className="px-4 py-2 text-left font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {logs.map((entry) => {
            const color = ACTION_COLORS[entry.action] ?? "text-text-primary";
            return (
              <tr key={entry.id} className="hover:bg-surface-container/50">
                <td className="px-4 py-2.5">
                  <span className={`font-mono text-xs ${color}`}>{entry.action}</span>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-text-primary">{entry.actorName}</p>
                  <p className="text-xs text-text-secondary">{entry.actorEmail}</p>
                </td>
                <td className="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
