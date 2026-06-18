"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { Confirm } from "@/components/ui/confirm";
import { CreateBulletinDialog } from "@/components/bulletin/create-bulletin-dialog";
import {
  useBulletins,
  useDeleteBulletin,
  usePinBulletin,
  useMarkComplete,
} from "@/modules/bulletin/hooks";
import { useAuth } from "@/lib/auth-context";
import type { BulletinSummary } from "@/modules/bulletin/types";

// ─────────────────────────────────────────────────────────────────────────────
// Bulletin board
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusColor(status: string | null): string {
  if (status === "COMPLETED") return "text-success bg-success/10 border-success/30";
  if (status === "OVERDUE") return "text-danger bg-danger/10 border-danger/30";
  if (status === "PENDING") return "text-warning bg-warning/10 border-warning/30";
  return "text-text-secondary bg-surface-container border-border-default";
}

function ProgressBar({ total, done }: { total: number; done: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-text-secondary mb-1">
        <span>{done}/{total} completed</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BulletinCard({
  item,
  isAdmin,
  isAuthor,
  onDelete,
  onPin,
  onComplete,
  completing,
}: {
  item: BulletinSummary;
  isAdmin: boolean;
  isAuthor: boolean;
  onDelete: () => void;
  onPin: () => void;
  onComplete: () => void;
  completing: boolean;
}) {
  const isCountdown = item.type === "COUNTDOWN";
  const canComplete =
    isCountdown && item.myStatus !== null && item.myStatus !== "COMPLETED";
  const isOverdue = item.dueAt && new Date(item.dueAt) < new Date();

  return (
    <div
      className={
        "rounded-lg border bg-surface-container px-5 py-4 " +
        (item.pinned ? "border-primary/40" : "border-border-default")
      }
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.pinned && (
              <span className="text-xs font-medium text-primary">📌 Pinned</span>
            )}
            <span
              className={
                "rounded border px-1.5 py-0.5 text-xs font-medium " +
                (isCountdown
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-primary/40 bg-primary/10 text-primary")
              }
            >
              {isCountdown ? "Countdown" : "Announcement"}
            </span>
            {isCountdown && item.dueAt && (
              <span
                className={
                  "text-xs " + (isOverdue ? "text-danger font-medium" : "text-text-secondary")
                }
              >
                Due {fmtDate(item.dueAt)}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-text-primary">{item.title}</h3>
          {item.body && (
            <p className="mt-1 text-sm text-text-secondary whitespace-pre-line">{item.body}</p>
          )}
          <p className="mt-2 text-xs text-text-secondary">
            Posted by {item.authorName} · {fmtDate(item.createdAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isCountdown && item.myStatus && (
            <span
              className={
                "rounded border px-2 py-0.5 text-xs font-medium " + statusColor(item.myStatus)
              }
            >
              {item.myStatus}
            </span>
          )}
          {canComplete && (
            <Button
              variant="secondary"
              className="h-7 text-xs"
              onClick={onComplete}
              disabled={completing}
            >
              {completing ? "…" : "Mark complete"}
            </Button>
          )}
          {(isAdmin || isAuthor) && (
            <Button
              variant="ghost"
              className="h-7 text-xs text-danger hover:text-danger"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" className="h-7 text-xs" onClick={onPin}>
              {item.pinned ? "Unpin" : "Pin"}
            </Button>
          )}
        </div>
      </div>

      {/* Countdown progress */}
      {isCountdown && item.totalAssignees > 0 && (
        <ProgressBar total={item.totalAssignees} done={item.completedCount} />
      )}
    </div>
  );
}

export default function BulletinPage() {
  const { user } = useAuth();
  const { data: bulletins, isLoading, error } = useBulletins();
  const deleteBulletin = useDeleteBulletin();
  const pinBulletin = usePinBulletin();
  const markComplete = useMarkComplete();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Bulletin</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Org-wide announcements and countdown tasks
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New bulletin</Button>
      </div>

      {isLoading && <LoadingState label="Loading bulletins…" />}
      {error && <ErrorState message="Failed to load bulletins." />}
      {!isLoading && !error && bulletins?.length === 0 && (
        <EmptyState
          title="No bulletins yet"
          hint="Post an announcement or create a countdown for your team."
          action={
            <Button onClick={() => setCreateOpen(true)}>New bulletin</Button>
          }
        />
      )}

      {!isLoading && !error && bulletins && bulletins.length > 0 && (
        <div className="space-y-3">
          {bulletins.map((item) => (
            <BulletinCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isAuthor={user?.id === item.authorId}
              onDelete={() => { setDeleteError(null); setDeleteTarget({ id: item.id, title: item.title }); }}
              onPin={() =>
                pinBulletin.mutate({ bulletinId: item.id, pinned: !item.pinned })
              }
              onComplete={() => markComplete.mutate(item.id)}
              completing={markComplete.isPending && markComplete.variables === item.id}
            />
          ))}
        </div>
      )}

      <CreateBulletinDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <Confirm
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete bulletin"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteBulletin.isPending}
        error={deleteError}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBulletin.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: () => setDeleteError("Failed to delete bulletin."),
          });
        }}
      />
    </div>
  );
}
