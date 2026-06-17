-- ─────────────────────────────────────────────────────────────────────────────
-- WorkDesk baseline schema (migration 0001)
--
-- Plain SQL, applied by scripts/migrate.ts. PostgreSQL.
-- Mirrors the original domain model 1:1 (User, Set, Artifact, Version, AuditLog).
-- uuid PKs via gen_random_uuid() (pgcrypto). snake_case tables/columns.
--
-- FK delete semantics:
--   * RESTRICT everywhere (knowledge must never be lost by a cascade)
--   * EXCEPT version.artifact_id → ON DELETE CASCADE (versions belong to their artifact)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('MEMBER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM ('TEXT', 'PDF', 'DOCX', 'PPTX', 'IMAGE', 'ZIP', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE visibility AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'USER_CREATED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'USER_ROLE_CHANGED',
    'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'PROFILE_UPDATED', 'OWNERSHIP_TRANSFERRED',
    'ARTIFACT_VISIBILITY_CHANGED', 'LIBRARY_SECTION_DELETED', 'SET_DELETED',
    'SET_CREATED', 'SET_UPDATED', 'ARTIFACT_CREATED', 'ARTIFACT_UPDATED',
    'ARTIFACT_DELETED', 'ARTIFACT_VERSION_COMMITTED', 'ARTIFACT_VERSION_RESTORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  name             TEXT NOT NULL,
  role             role NOT NULL DEFAULT 'MEMBER',
  status           user_status NOT NULL DEFAULT 'ACTIVE',
  theme_preference TEXT NOT NULL DEFAULT 'dark',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users (role, status);

-- ── sets (folders, self-nesting) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES sets (id) ON DELETE RESTRICT,
  owner_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sets_parent_id_idx ON sets (parent_id);
CREATE INDEX IF NOT EXISTS sets_owner_id_idx ON sets (owner_id);

-- ── artifacts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  type        artifact_type NOT NULL,
  visibility  visibility NOT NULL DEFAULT 'PRIVATE',
  owner_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  set_id      UUID REFERENCES sets (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS artifacts_set_id_idx ON artifacts (set_id);
CREATE INDEX IF NOT EXISTS artifacts_owner_id_idx ON artifacts (owner_id);
CREATE INDEX IF NOT EXISTS artifacts_visibility_idx ON artifacts (visibility);

-- ── versions (immutable, append-only ledger) ────────────────────────────────
CREATE TABLE IF NOT EXISTS versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id    UUID NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_key    TEXT NOT NULL,
  change_summary TEXT,
  author_id      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, version_number)
);
CREATE INDEX IF NOT EXISTS versions_artifact_id_idx ON versions (artifact_id);
CREATE INDEX IF NOT EXISTS versions_author_id_idx ON versions (author_id);
CREATE INDEX IF NOT EXISTS versions_content_key_idx ON versions (content_key);

-- ── audit_logs (append-only) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action     audit_action NOT NULL,
  actor_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  -- target_id is POLYMORPHIC (user | set | artifact) → intentionally NOT a FK.
  target_id  UUID,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_created_at_idx ON audit_logs (actor_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_target_id_idx ON audit_logs (target_id);
