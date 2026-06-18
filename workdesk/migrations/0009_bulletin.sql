-- V2 Slice 2: Bulletin + Countdown

CREATE TYPE bulletin_type AS ENUM ('ANNOUNCEMENT', 'COUNTDOWN');
CREATE TYPE countdown_status AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'INCOMPLETE');

CREATE TABLE IF NOT EXISTS bulletins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type        bulletin_type NOT NULL,
  title       TEXT        NOT NULL CHECK (char_length(title) <= 255),
  body        TEXT        CHECK (char_length(body) <= 2000),
  due_at      TIMESTAMPTZ,
  pinned      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulletins_created_at_idx ON bulletins (pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS countdown_assignments (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id  UUID             NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  user_id      UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       countdown_status NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  CONSTRAINT countdown_assignments_unique UNIQUE (bulletin_id, user_id)
);

CREATE INDEX IF NOT EXISTS countdown_assignments_user_idx ON countdown_assignments (user_id, status);
