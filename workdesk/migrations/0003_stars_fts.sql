-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003: Stars + Full-Text Search
--
-- 1. stars table — user ↔ artifact/set many-to-many (one column is always NULL,
--    enforced by CHECK). Unique per (user, artifact) and (user, set).
-- 2. search_vector generated column on artifacts — tsvector over title +
--    description + tags (cast to text). GIN index for fast @@ queries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Stars ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES artifacts (id) ON DELETE CASCADE,
  set_id      UUID REFERENCES sets (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- exactly one target must be set
  CONSTRAINT stars_single_target CHECK (
    (artifact_id IS NOT NULL)::int + (set_id IS NOT NULL)::int = 1
  ),
  -- no duplicate stars per user+artifact or user+set
  CONSTRAINT stars_unique_artifact UNIQUE (user_id, artifact_id),
  CONSTRAINT stars_unique_set      UNIQUE (user_id, set_id)
);

CREATE INDEX IF NOT EXISTS stars_user_id_idx      ON stars (user_id);
CREATE INDEX IF NOT EXISTS stars_artifact_id_idx  ON stars (artifact_id);
CREATE INDEX IF NOT EXISTS stars_set_id_idx       ON stars (set_id);

-- ── Full-Text Search on artifacts ────────────────────────────────────────────

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tags::text, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS artifacts_search_vector_idx
  ON artifacts USING GIN (search_vector);
