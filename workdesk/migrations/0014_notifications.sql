-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_notifications.sql
--
-- In-app notification inbox. Every significant action directed at a user
-- (share received, message received, bulletin posted, artifact published to
-- a library section you subscribe to) drops a row here.
--
-- Notifications are:
--   - Scoped to one recipient (user_id).
--   - Categorised by a short type string.
--   - Linked to an optional source entity (artifact_id, bulletin_id, etc.)
--     stored in a JSONB `meta` bag so the frontend can build deep links.
--   - Soft-dismissed via is_read (never hard-deleted by the user).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE notification_type AS ENUM (
  'ARTIFACT_SHARED',
  'MESSAGE_RECEIVED',
  'BULLETIN_POSTED',
  'ARTIFACT_PUBLISHED'
);

CREATE TABLE notifications (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT             NOT NULL,
  body        TEXT             NOT NULL DEFAULT '',
  meta        JSONB            NOT NULL DEFAULT '{}',
  is_read     BOOLEAN          NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);
