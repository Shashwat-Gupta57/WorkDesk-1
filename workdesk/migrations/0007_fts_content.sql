-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0007: FTS content column for TEXT artifacts
--
-- Adds fts_content (plain text extracted from the Tiptap JSON document) so that
-- text artifact bodies are included in the full-text search index.
--
-- Strategy:
--   1. Add fts_content text column (nullable, app-maintained).
--   2. Drop and re-create search_vector GENERATED column to include it at
--      weight D (lower than title/description/tags).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. App-maintained plain-text column for TEXT artifact body content.
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS fts_content text;

-- 2. Drop old generated column (can't ALTER a GENERATED column in-place).
ALTER TABLE artifacts
  DROP COLUMN IF EXISTS search_vector;

-- 3. Re-create with fts_content at weight D.
ALTER TABLE artifacts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tags::text, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(fts_content, '')), 'D')
  ) STORED;

-- 4. Re-create GIN index.
CREATE INDEX IF NOT EXISTS artifacts_search_vector_idx
  ON artifacts USING GIN (search_vector);
