# V2 Slice 6 — Notifications

## What Was Built

An in-app notification system that automatically alerts users of actions directed at them: artifact shares, new messages, bulletin posts, and library publications. Notifications surface in a persistent bell in the sidebar with an unread badge, a drop-down panel with dismiss controls, and a dashboard widget.

**Migration:** `0014_notifications.sql`  
**Commit:** `feat(v2-slice-6): in-app notifications`

---

## Schema

```sql
CREATE TYPE notification_type AS ENUM (
  'ARTIFACT_SHARED',
  'MESSAGE_RECEIVED',
  'BULLETIN_POSTED',
  'ARTIFACT_PUBLISHED'
);

CREATE TABLE notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT              NOT NULL,
  body       TEXT              NOT NULL DEFAULT '',
  meta       JSONB             NOT NULL DEFAULT '{}',
  is_read    BOOLEAN           NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);
```

`meta` carries context for deep-linking: `{ artifactId, conversationId, bulletinId, ... }`.

---

## Backend

### `notificationService.ts` (`src/modules/notifications/services/`)

| Function | Behaviour |
|---|---|
| `emitNotification(userId, type, title, body, meta)` | Inserts one notification row. Non-throwing — callers fire-and-forget with `.catch(() => {})`. |
| `listNotifications(userId, limit=30)` | Last 30 notifications for user, newest-first. |
| `getNotificationCounts(userId)` | `{ total, unread }` — used by the bell badge. |
| `markRead(userId, id)` | Sets `is_read = true` for one notification owned by this user. |
| `markAllRead(userId)` | Sets all unread → read for this user. |
| `deleteNotification(userId, id)` | Hard-deletes one notification owned by this user. |

### Where notifications are emitted

| Trigger | Recipient | Type |
|---|---|---|
| Artifact shared | Grantee | `ARTIFACT_SHARED` |
| Message sent | Other conversation member | `MESSAGE_RECEIVED` |
| Bulletin posted | All other active members | `BULLETIN_POSTED` |
| Countdown assigned | Each assignee | `BULLETIN_POSTED` |
| Artifact published to Library | Artifact owner (self-confirm) | `ARTIFACT_PUBLISHED` |

All emissions are best-effort: a notification failure never blocks the triggering operation.

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/notifications` | GET | List (last 30) + counts |
| `/api/notifications` | PATCH | Mark all read |
| `/api/notifications/[id]` | PATCH | Mark one read |
| `/api/notifications/[id]` | DELETE | Delete one |

### `api-client.ts` extension

Added `api.patch(path, body)` to the shared api client (was missing; only GET/POST/PUT/DELETE existed).

---

## Frontend

### Notification Bell (`src/components/notifications/notification-bell.tsx`)

Lives at the bottom of the sidebar above the user card.

- Bell icon with blue unread badge (hides when 0, shows "99+" when overflow).
- Clicking opens a drop-down panel (slides up from the sidebar button).
- Panel lists the last 30 notifications with icon, title, relative timestamp.
- Unread notifications have a blue left dot + slightly elevated background.
- Each row is clickable → marks read + navigates to the relevant screen.
- Dismiss (✕) button on hover → hard-deletes the notification.
- "Mark all read" button in the panel header (only shown when unread > 0).
- Closes on click-outside.
- Polls every 30s for new notifications (`refetchInterval`).

### Notifications Widget (`src/components/dashboard/notifications-widget.tsx`)

Dashboard card showing the 5 most recent notifications. Clicking a row marks it read and navigates to the deep-link. Unread badge shown in the card header.

---

## Manual Test Plan

**Prerequisites:** Run `npm run migrate` (applies 0014).

### Notification bell

1. Log in. Bell in sidebar shows no badge (no notifications yet).
2. From a second account, share an artifact with the first user.
3. In the first account: bell badge shows 1. Click it → panel opens showing "Artifact shared with you."
4. Click the notification → navigates to the artifact workspace. Badge clears.
5. Back in sidebar → bell shows 0 badge.

### Bulletin notification

6. Post a bulletin as any user.
7. Log in as another user → bell should show 1 unread for the new bulletin.
8. Click "Mark all read" in the panel → all dots disappear, badge clears.

### Message notification

9. Send a message from User A to User B.
10. Log in as User B → bell shows 1 unread for the new message.
11. Click the row → navigates to `/messaging`.

### Dismiss

12. Open the bell panel. Hover a notification row → ✕ appears.
13. Click ✕ → notification disappears immediately (optimistic removal via cache invalidation).

### Dashboard widget

14. Navigate to Dashboard → "Notifications" widget shows recent 5.
15. Unread items have a blue dot on the right. Clicking marks read.

### Edge cases

| Scenario | Expected |
|---|---|
| No notifications at all | Widget shows "No notifications yet." / bell has no badge |
| > 99 unread | Badge shows "99+" |
| Notification for deleted artifact | Deep-link goes to `/archive/[id]` — 404 handled by that page |

---

## Rollback

1. Drop the table: `DROP TABLE notifications; DROP TYPE notification_type;`
2. Remove `emitNotification` calls from `shareService`, `bulletinService`, `messagingService`, `libraryService`.
3. Remove `src/modules/notifications/` directory.
4. Remove `src/app/api/notifications/` directory.
5. Remove `NotificationBell` from sidebar, `NotificationsWidget` from dashboard.
6. Remove `api.patch` from `api-client.ts` if no other callers.
