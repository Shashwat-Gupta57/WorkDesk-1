import { query, queryOne } from "@/lib/db";
import type { Notification, NotificationCounts, NotificationType } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
//
// Fire-and-forget pattern (mirrors activityService): callers call
// emitNotification(...).catch(() => {}) so a DB hiccup never blocks an op.
// ─────────────────────────────────────────────────────────────────────────────

interface NotifRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  meta: Record<string, string>;
  is_read: boolean;
  created_at: Date;
}

function rowToNotification(r: NotifRow): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    meta: r.meta ?? {},
    isRead: r.is_read,
    createdAt: r.created_at,
  };
}

// ── emit (non-throwing, fire-and-forget) ──────────────────────────────────────

export async function emitNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  meta: Record<string, string> = {}
): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body, JSON.stringify(meta)]
  );
}

// ── list ──────────────────────────────────────────────────────────────────────

export async function listNotifications(
  userId: string,
  limit = 30
): Promise<Notification[]> {
  const rows = await query<NotifRow>(
    `SELECT id, user_id, type, title, body, meta, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(rowToNotification);
}

// ── counts ────────────────────────────────────────────────────────────────────

export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  const row = await queryOne<{ total: string; unread: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE is_read = false) AS unread
     FROM notifications
     WHERE user_id = $1`,
    [userId]
  );
  return {
    total: Number(row?.total ?? 0),
    unread: Number(row?.unread ?? 0),
  };
}

// ── markRead ──────────────────────────────────────────────────────────────────

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
}

// ── delete ────────────────────────────────────────────────────────────────────

export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}
