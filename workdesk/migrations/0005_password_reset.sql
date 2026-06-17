-- Migration 0005: password reset tokens
--
-- Adds a time-limited, single-use token table for forgot-password flow.
-- Tokens are hashed before storage (SHA-256). Plain token is emailed to the user.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prt_user_id_idx   ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS prt_token_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS prt_expires_at_idx ON password_reset_tokens (expires_at);
