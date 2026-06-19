"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from "@/modules/notifications/hooks";
import type { Notification } from "@/modules/notifications/types";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Bell + Drop-down Panel
// Lives in the sidebar bottom section.
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

function deepLink(notif: Notification): string | null {
  const { meta } = notif;
  if (notif.type === "ARTIFACT_SHARED" || notif.type === "ARTIFACT_PUBLISHED") {
    return meta.artifactId ? `/archive/${meta.artifactId}` : null;
  }
  if (notif.type === "MESSAGE_RECEIVED") {
    return meta.conversationId ? `/messaging` : null;
  }
  if (notif.type === "BULLETIN_POSTED") {
    return "/bulletin";
  }
  return null;
}

function NotifRow({ notif, onClose }: { notif: Notification; onClose: () => void }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const del = useDeleteNotification();
  const icon = TYPE_ICON[notif.type] ?? "🔔";
  const link = deepLink(notif);

  function handleClick() {
    if (!notif.isRead) markRead.mutate(notif.id);
    if (link) { router.push(link); onClose(); }
  }

  return (
    <div
      className={`group relative flex gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        notif.isRead ? "opacity-60" : "bg-surface-container"
      } hover:bg-surface-container-high cursor-pointer`}
      onClick={handleClick}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <div className="absolute left-1.5 top-3.5 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-text-primary leading-snug">{notif.title}</p>
        {notif.body && (
          <p className="mt-0.5 text-[11px] text-text-secondary leading-snug line-clamp-2">{notif.body}</p>
        )}
        <p className="mt-1 text-[10px] text-text-secondary/60">{relativeTime(notif.createdAt)}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); del.mutate(notif.id); }}
        className="absolute right-2 top-2 hidden rounded p-0.5 text-text-secondary/40 hover:text-danger group-hover:block"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications();
  const markAllRead = useMarkAllRead();

  const unread = data?.counts.unread ?? 0;
  const notifications = data?.notifications ?? [];

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
        title="Notifications"
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="flex-1 text-left">Notifications</span>
        {unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-border-default bg-surface-secondary shadow-2xl"
          style={{ animation: "panelSlideIn 0.18s ease", zIndex: 100 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[11px] text-primary hover:underline"
                  disabled={markAllRead.isPending}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-text-secondary/60 hover:text-text-primary text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto p-2">
            {isLoading && (
              <p className="py-8 text-center text-xs text-text-secondary">Loading…</p>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-xs text-text-secondary">You&apos;re all caught up.</p>
              </div>
            )}
            {notifications.map(n => (
              <NotifRow key={n.id} notif={n} onClose={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
