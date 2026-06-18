-- V2 Slice 4: Library & Publishing

CREATE TABLE IF NOT EXISTS library_sections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(name) <= 100),
  description TEXT        CHECK (char_length(description) <= 500),
  created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_artifacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  UUID        NOT NULL REFERENCES library_sections(id) ON DELETE CASCADE,
  artifact_id UUID        NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  added_by    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_artifacts_unique UNIQUE (section_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS lib_artifacts_section_idx  ON library_artifacts (section_id);
CREATE INDEX IF NOT EXISTS lib_artifacts_artifact_idx ON library_artifacts (artifact_id);

CREATE TABLE IF NOT EXISTS library_subscriptions (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id UUID        NOT NULL REFERENCES library_sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id)
);

CREATE INDEX IF NOT EXISTS lib_subs_user_idx ON library_subscriptions (user_id);
