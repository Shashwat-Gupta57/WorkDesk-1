-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0008: Artifact Sharing (V2 Slice 1)
--
-- artifact_shares — per-user share grants that unlock the SHARED read path.
--   Each row = owner grants grantee read access to one artifact.
--   The artifact's visibility must be SHARED (or PUBLIC) for grants to be
--   honoured; PRIVATE visibility disables all grants at query time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS artifact_shares (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID        NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  grantee_id  UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one grant per (artifact, grantee) pair
  CONSTRAINT artifact_shares_unique UNIQUE (artifact_id, grantee_id),
  -- owner cannot share with themselves
  CONSTRAINT artifact_shares_no_self CHECK (owner_id <> grantee_id)
);

CREATE INDEX IF NOT EXISTS artifact_shares_artifact_idx ON artifact_shares (artifact_id);
CREATE INDEX IF NOT EXISTS artifact_shares_grantee_idx  ON artifact_shares (grantee_id);
CREATE INDEX IF NOT EXISTS artifact_shares_owner_idx    ON artifact_shares (owner_id);
