-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_email_otp
--
-- Two new tables:
--   email_verifications — short-lived OTP for verifying a new account's email
--                         before the user record is created.
--   otp_codes           — general-purpose OTP table (currently: password-change
--                         via OTP from the settings page).
-- ─────────────────────────────────────────────────────────────────────────────

-- Pending email verifications (pre-signup, no user row yet)
CREATE TABLE IF NOT EXISTS email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  otp_hash   TEXT        NOT NULL,          -- bcrypt hash of the 6-digit OTP
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verifications_email_idx
  ON email_verifications (email);

-- General OTP codes keyed to an existing user + purpose
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT        NOT NULL,          -- e.g. 'password_change'
  otp_hash   TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_user_purpose_idx
  ON otp_codes (user_id, purpose);
