-- Migration 0006: access log + activity feed
--
-- artifact_accesses: per-user, per-artifact open tracking (last opened + count).
--   Used for "Recently Opened" dashboard widget.
-- activity_events: user-facing event feed (distinct from the security audit_log).
--   Emitted on significant archive operations. Read by "Activity Summary" widget.

CREATE TABLE IF NOT EXISTS artifact_accesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  artifact_id  UUID NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  open_count   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS aa_user_id_opened_at_idx ON artifact_accesses (user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS aa_artifact_id_idx       ON artifact_accesses (artifact_id);

-- ── activity_event_type ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE activity_event_type AS ENUM (
    'ARTIFACT_CREATED',
    'ARTIFACT_UPDATED',
    'ARTIFACT_DELETED',
    'ARTIFACT_RESTORED',
    'VERSION_COMMITTED',
    'VERSION_RESTORED',
    'SET_CREATED',
    'SET_UPDATED',
    'SET_DELETED',
    'SET_RESTORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS activity_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_type   activity_event_type NOT NULL,
  artifact_id  UUID REFERENCES artifacts (id) ON DELETE CASCADE,
  set_id       UUID REFERENCES sets (id) ON DELETE CASCADE,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ae_user_id_created_at_idx ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ae_artifact_id_idx        ON activity_events (artifact_id);
CREATE INDEX IF NOT EXISTS ae_set_id_idx             ON activity_events (set_id);
