"use client";

import { useRouter } from "next/navigation";
import { useNotifications, useMarkRead } from "@/modules/notifications/hooks";
import { LoadingState } from "@/components/ui/states";
import type { Notification } from "@/modules/notifications/types";

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsWidget — dashboard card showing recent unread notifications.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  ARTIFACT_SHARED:    "🤝",
  MESSAGE_RECEIVED:   "💬",
  BULLETIN_POSTED:    "📢",
  ARTIFACT_PUBLISHED: "📖",
};

function relativeTime(date: Date | string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function deepLink(notif: Notification): string {
  const { meta } = notif;
  if ((notif.type === "ARTIFACT_SHARED" || notif.type === "ARTIFACT_PUBLISHED") && meta.artifactId) {
    return `/archive/${meta.artifactId}`;
  }
  if (notif.type === "MESSAGE_RECEIVED") return "/messaging";
  if (notif.type === "BULLETIN_POSTED") return "/bulletin";
  return "/dashboard";
}

export function NotificationsWidget() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();

  const recent = (data?.notifications ?? []).slice(0, 5);
  const unread = data?.counts.unread ?? 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
        {unread > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {unread} unread
          </span>
        )}
      </div>

      {isLoading && <LoadingState label="Loading…" />}

      {!isLoading && recent.length === 0 && (
        <p className="py-4 text-center text-xs text-text-secondary/60">No notifications yet.</p>
      )}

      <ul className="space-y-1">
        {recent.map(n => (
          <li
            key={n.id}
            onClick={() => {
              if (!n.isRead) markRead.mutate(n.id);
              router.push(deepLink(n));
            }}
            className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container ${
              n.isRead ? "opacity-50" : ""
            }`}
          >
            <span className="mt-0.5 shrink-0 text-sm">{TYPE_ICON[n.type] ?? "🔔"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">{n.title}</p>
              <p className="text-[10px] text-text-secondary/70">{relativeTime(n.createdAt)}</p>
            </div>
            {!n.isRead && (
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
