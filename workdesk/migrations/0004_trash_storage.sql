-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0004: Trash retention + Storage management (Slice 4)
--
-- Changes:
--   1. versions.byte_size       — file size in bytes captured at commit time
--   2. users.quota_bytes        — per-user storage quota (default 5 GB)
--   3. users.storage_used_bytes — running total, updated on commit/permanent-delete
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. byte_size on versions (nullable — old versions predate this column)
ALTER TABLE versions
  ADD COLUMN IF NOT EXISTS byte_size BIGINT;

-- 2. quota + storage counter on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quota_bytes        BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- 3. Guard: storage_used_bytes must never go negative
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_storage_used_bytes_non_negative;
ALTER TABLE users
  ADD CONSTRAINT users_storage_used_bytes_non_negative
  CHECK (storage_used_bytes >= 0);
