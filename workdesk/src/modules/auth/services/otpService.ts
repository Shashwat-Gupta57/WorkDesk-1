import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import {
  sendEmailVerificationOtp,
  sendPasswordChangeOtp,
} from "@/lib/email";

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class OtpInvalidError extends Error {
  readonly code = "OTP_INVALID";
  constructor() { super("The code is invalid or has expired."); this.name = "OtpInvalidError"; }
}

export class OtpRateLimitError extends Error {
  readonly code = "OTP_RATE_LIMIT";
  constructor() { super("Please wait before requesting a new code."); this.name = "OtpRateLimitError"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999)); // 6 digits
}

const BCRYPT_ROUNDS = 10; // lighter than password hashing — OTPs expire quickly

// ─────────────────────────────────────────────────────────────────────────────
// Email-verification OTP (pre-signup, no user row yet)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailVerification(email: string): Promise<void> {
  // Rate-limit: only 1 pending OTP per email per minute
  const recent = await queryOne<{ created_at: Date }>(
    `SELECT created_at FROM email_verifications
     WHERE email = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (recent) {
    const age = Date.now() - new Date(recent.created_at).getTime();
    if (age < 60_000) throw new OtpRateLimitError();
  }

  const otp     = generateOtp();
  const hash    = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate old pending codes for this email
  await query(
    `UPDATE email_verifications SET used_at = now()
     WHERE email = $1 AND used_at IS NULL`,
    [email]
  );

  await query(
    `INSERT INTO email_verifications (email, otp_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [email, hash, expires]
  );

  await sendEmailVerificationOtp(email, otp);
}

export async function verifyEmailOtp(email: string, otp: string): Promise<void> {
  const row = await queryOne<{ id: string; otp_hash: string }>(
    `SELECT id, otp_hash FROM email_verifications
     WHERE email = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (!row) throw new OtpInvalidError();

  const ok = await bcrypt.compare(otp, row.otp_hash);
  if (!ok) throw new OtpInvalidError();

  await query(
    `UPDATE email_verifications SET used_at = now() WHERE id = $1`,
    [row.id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Password-change OTP (for authenticated users in settings)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordChangeCode(userId: string, email: string): Promise<void> {
  const recent = await queryOne<{ created_at: Date }>(
    `SELECT created_at FROM otp_codes
     WHERE user_id = $1 AND purpose = 'password_change'
       AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (recent) {
    const age = Date.now() - new Date(recent.created_at).getTime();
    if (age < 60_000) throw new OtpRateLimitError();
  }

  const otp     = generateOtp();
  const hash    = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await query(
    `UPDATE otp_codes SET used_at = now()
     WHERE user_id = $1 AND purpose = 'password_change' AND used_at IS NULL`,
    [userId]
  );

  await query(
    `INSERT INTO otp_codes (user_id, purpose, otp_hash, expires_at)
     VALUES ($1, 'password_change', $2, $3)`,
    [userId, hash, expires]
  );

  await sendPasswordChangeOtp(email, otp);
}

export async function verifyPasswordChangeCode(userId: string, otp: string): Promise<void> {
  const row = await queryOne<{ id: string; otp_hash: string }>(
    `SELECT id, otp_hash FROM otp_codes
     WHERE user_id = $1 AND purpose = 'password_change'
       AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (!row) throw new OtpInvalidError();

  const ok = await bcrypt.compare(otp, row.otp_hash);
  if (!ok) throw new OtpInvalidError();

  await query(`UPDATE otp_codes SET used_at = now() WHERE id = $1`, [row.id]);
}
