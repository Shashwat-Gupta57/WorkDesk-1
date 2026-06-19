"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { Confirm } from "@/components/ui/confirm";
import { ApiError } from "@/lib/api-client";
import { useTrash, useRestoreTrashItem, usePermanentDelete } from "@/modules/archive/hooks";
import type { TrashItem } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// Trash page — lists soft-deleted artifacts and sets, allows restore or
// permanent delete. Items auto-purge after 30 days (handled server-side on
// GET). Each row shows days remaining before permanent expiry.
// ─────────────────────────────────────────────────────────────────────────────

function daysRemaining(expiresAt: Date | string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TrashIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function SetIcon() {
  return (
    <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-5 w-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export default function TrashPage() {
  const trashQuery = useTrash();
  const restore = useRestoreTrashItem();
  const permDelete = usePermanentDelete();

  const [confirmItem, setConfirmItem] = useState<TrashItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const items = trashQuery.data ?? [];

  async function handleRestore(item: TrashItem) {
    await restore.mutateAsync({ kind: item.kind, id: item.id });
  }

  function handlePermanentDelete(item: TrashItem) {
    setDeleteError(null);
    permDelete.mutate(
      { kind: item.kind, id: item.id },
      {
        onSuccess: () => setConfirmItem(null),
        onError: (err) =>
          setDeleteError(err instanceof Error ? err.message : "Delete failed."),
      }
    );
  }

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-text-secondary">
          <TrashIcon />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Trash</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Items are permanently deleted after 30 days.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {trashQuery.isLoading && <LoadingState />}
        {trashQuery.error && (
          <ErrorState
            message={trashQuery.error instanceof ApiError ? trashQuery.error.message : "Failed to load trash."}
            onRetry={() => trashQuery.refetch()}
          />
        )}
        {!trashQuery.isLoading && !trashQuery.error && items.length === 0 && (
          <EmptyState title="Trash is empty" hint="Deleted items will appear here for 30 days before being permanently removed." />
        )}

        {items.length > 0 && (
          <div className="divide-y divide-border-default rounded-lg border border-border-default">
            {items.map((item) => {
              const days = daysRemaining(item.expiresAt);
              const urgent = days <= 3;
              return (
                <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0">
                    {item.kind === "set" ? <SetIcon /> : <FileIcon />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                    <p className="text-xs text-text-secondary">
                      {item.kind === "set" ? "Set" : item.type ?? "Artifact"}
                      {" · "}Deleted {formatDate(item.deletedAt)}
                    </p>
                  </div>

                  {/* Expiry badge */}
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      (days === 0
                        ? "bg-danger/15 text-danger"
                        : urgent
                        ? "bg-warning/15 text-warning"
                        : "bg-surface-container text-text-secondary")
                    }
                  >
                    {days === 0 ? "Expires today" : `${days}d left`}
                  </span>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleRestore(item)}
                      disabled={restore.isPending}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmItem(item)}
                      disabled={permDelete.isPending}
                    >
                      Delete forever
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm permanent delete */}
      <Confirm
        open={Boolean(confirmItem)}
        onClose={() => { setConfirmItem(null); setDeleteError(null); }}
        title="Delete forever"
        message={`Permanently delete "${confirmItem?.title}"? This cannot be undone — all versions and files will be removed.`}
        confirmLabel="Delete forever"
        busy={permDelete.isPending}
        error={deleteError}
        onConfirm={() => { if (confirmItem) handlePermanentDelete(confirmItem); }}
      />
    </div>
  );
}
