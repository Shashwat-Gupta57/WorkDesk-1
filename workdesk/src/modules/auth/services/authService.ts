import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query, queryOne, transaction } from "@/lib/db";
import { SafeUser, UpdateUserPayload, UpdateProfilePayload, UserSummary } from "@/modules/auth/types";
import { AuditAction, Role, UserStatus } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** bcrypt work factor. 12 is secure and keeps hashing under ~300ms on modern hardware. */
const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Raw row shape returned by the `users` table (snake_case columns).
// ─────────────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  status: UserStatus;
  theme_preference: string;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Service Errors
// ─────────────────────────────────────────────────────────────────────────────

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";
  constructor() {
    // Deliberately vague — do not distinguish "email not found" from "wrong password"
    // to prevent user enumeration attacks.
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class UserSuspendedError extends Error {
  readonly code = "USER_SUSPENDED";
  constructor() {
    super("Your account has been suspended. Please contact an administrator.");
    this.name = "UserSuspendedError";
  }
}

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  readonly code = "INVALID_CURRENT_PASSWORD";
  constructor() {
    super("Current password is incorrect.");
    this.name = "InvalidCurrentPasswordError";
  }
}

export class SelfRoleChangeError extends Error {
  readonly code = "SELF_ROLE_CHANGE";
  constructor() {
    super("Administrators cannot change their own role.");
    this.name = "SelfRoleChangeError";
  }
}

export class EmailAlreadyInUseError extends Error {
  readonly code = "EMAIL_ALREADY_IN_USE";
  constructor() {
    super("That email address is already in use.");
    this.name = "EmailAlreadyInUseError";
  }
}

export class InvalidResetTokenError extends Error {
  readonly code = "INVALID_RESET_TOKEN";
  constructor() {
    super("Password reset link is invalid or has expired.");
    this.name = "InvalidResetTokenError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a raw users row to the safe projection (drops password_hash). */
function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    themePreference: row.theme_preference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Writes an immutable audit record. Non-throwing — audit failures must not block ops. */
async function writeAuditLog(
  action: AuditAction,
  actorId: string,
  targetId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details)
       VALUES ($1, $2, $3, $4)`,
      [action, actorId, targetId, JSON.stringify(details)]
    );
  } catch (err) {
    // Log to server console but never surface to caller.
    console.error("[AuditLog] Failed to write audit record:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * verifyCredentials
 *
 * Validates email/password against the database.
 * - Uses constant-time bcrypt comparison to prevent timing attacks.
 * - Never reveals whether the email exists in the database.
 * - Checks account status after credential verification to prevent
 *   leaking suspended-account existence via error ordering.
 *
 * @throws InvalidCredentialsError — bad email or password
 * @throws UserSuspendedError — account suspended
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<SafeUser> {
  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  // Always run bcrypt even if user not found (dummy hash prevents timing attack).
  const dummyHash =
    "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hashToCompare = user?.password_hash ?? dummyHash;
  const isMatch = await bcrypt.compare(password, hashToCompare);

  if (!user || !isMatch) {
    throw new InvalidCredentialsError();
  }

  if (user.status === "SUSPENDED") {
    throw new UserSuspendedError();
  }

  return toSafeUser(user);
}

/**
 * getUserById
 *
 * Fetches a safe user projection by ID.
 *
 * @throws UserNotFoundError — user does not exist
 */
export async function getUserById(userId: string): Promise<SafeUser> {
  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  if (!user) {
    throw new UserNotFoundError();
  }

  return toSafeUser(user);
}

/**
 * changePassword
 *
 * Updates the authenticated user's password.
 * - Verifies the current password before allowing the change.
 * - Hashes the new password with bcrypt at BCRYPT_ROUNDS work factor.
 * - Writes an audit record (no sensitive data stored).
 * - Runs in a transaction to ensure atomicity.
 *
 * @throws UserNotFoundError — user no longer exists
 * @throws InvalidCurrentPasswordError — current password is wrong
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  if (!user) {
    throw new UserNotFoundError();
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new InvalidCurrentPasswordError();
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [newHash, userId]
    );

    await tx.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details)
       VALUES ($1, $2, $3, $4)`,
      ["PASSWORD_CHANGED", userId, userId, JSON.stringify({})]
    );
  });
}

/**
 * listAllUsers
 *
 * Returns all users as UserSummary (Admin only — enforced at route handler level).
 * Ordered by creation date descending.
 */
export async function listAllUsers(): Promise<UserSummary[]> {
  const rows = await query<{
    id: string;
    email: string;
    name: string;
    role: Role;
    status: UserStatus;
    created_at: Date;
  }>(
    `SELECT id, email, name, role, status, created_at
     FROM users
     ORDER BY created_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * updateUser
 *
 * Allows an administrator to change a user's status or role.
 * - Prevents an admin from changing their own role (safety guard).
 * - Runs update + audit log in a single transaction.
 * - Uses before/after snapshots in audit details for full traceability.
 *
 * @throws UserNotFoundError — target user does not exist
 * @throws SelfRoleChangeError — actor tried to change their own role
 */
export async function updateUser(
  actorId: string,
  targetUserId: string,
  payload: UpdateUserPayload
): Promise<SafeUser> {
  if (payload.role !== undefined && actorId === targetUserId) {
    throw new SelfRoleChangeError();
  }

  const existing = await queryOne<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [targetUserId]
  );
  if (!existing) {
    throw new UserNotFoundError();
  }

  const updated = await transaction(async (tx) => {
    // Build a partial UPDATE from whichever fields were provided.
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (payload.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(payload.status);
    }
    if (payload.role !== undefined) {
      sets.push(`role = $${i++}`);
      params.push(payload.role);
    }
    sets.push(`updated_at = now()`);
    params.push(targetUserId);

    const { rows } = await tx.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    const updatedUser = rows[0];

    // Determine which audit action to record.
    let action: AuditAction;
    if (payload.status === "SUSPENDED") {
      action = "USER_SUSPENDED";
    } else if (payload.status === "ACTIVE") {
      action = "USER_ACTIVATED";
    } else {
      action = "USER_ROLE_CHANGED";
    }

    await tx.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details)
       VALUES ($1, $2, $3, $4)`,
      [
        action,
        actorId,
        targetUserId,
        JSON.stringify({
          previousState: { status: existing.status, role: existing.role },
          newState: { status: updatedUser.status, role: updatedUser.role },
        }),
      ]
    );

    return updatedUser;
  });

  return toSafeUser(updated);
}

/**
 * hashPassword
 *
 * Utility for seeding/creating users. Not exposed through the API directly.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * listAuditLogs
 *
 * Returns recent audit log entries joined with actor name/email.
 * Admin-only — caller must enforce at the route level.
 */
export async function listAuditLogs(limit = 100): Promise<import("@/modules/auth/types").AuditLogEntry[]> {
  const rows = await query<{
    id: string;
    action: string;
    actor_id: string;
    actor_name: string;
    actor_email: string;
    target_id: string | null;
    details: string;
    created_at: Date;
  }>(
    `SELECT al.id, al.action, al.actor_id,
            u.name AS actor_name, u.email AS actor_email,
            al.target_id, al.details, al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorId: r.actor_id,
    actorName: r.actor_name ?? "—",
    actorEmail: r.actor_email ?? "—",
    targetId: r.target_id,
    details: typeof r.details === "string" ? JSON.parse(r.details) : (r.details as Record<string, unknown>),
    createdAt: r.created_at,
  }));
}

/**
 * updateProfile
 *
 * Allows a user to update their own name, email, and/or theme preference.
 * - Email uniqueness is enforced; emits EMAIL_CHANGED or PROFILE_UPDATED audit action.
 * - Runs in a transaction so the audit write is atomic with the update.
 *
 * @throws UserNotFoundError — user no longer exists
 * @throws EmailAlreadyInUseError — new email belongs to another account
 */
export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload
): Promise<SafeUser> {
  const existing = await queryOne<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  if (!existing) throw new UserNotFoundError();

  const newEmail = payload.email?.toLowerCase().trim();
  if (newEmail && newEmail !== existing.email) {
    const conflict = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND id <> $2`,
      [newEmail, userId]
    );
    if (conflict) throw new EmailAlreadyInUseError();
  }

  const updated = await transaction(async (tx) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (payload.name !== undefined) { sets.push(`name = $${i++}`); params.push(payload.name.trim()); }
    if (newEmail !== undefined)      { sets.push(`email = $${i++}`); params.push(newEmail); }
    if (payload.themePreference !== undefined) { sets.push(`theme_preference = $${i++}`); params.push(payload.themePreference); }
    sets.push(`updated_at = now()`);
    params.push(userId);

    const { rows } = await tx.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );

    const action: AuditAction = newEmail && newEmail !== existing.email
      ? "EMAIL_CHANGED"
      : "PROFILE_UPDATED";

    await tx.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details) VALUES ($1, $2, $3, $4)`,
      [action, userId, userId, JSON.stringify({
        changed: Object.keys(payload),
        ...(newEmail && newEmail !== existing.email ? { previousEmail: existing.email } : {}),
      })]
    );

    return rows[0];
  });

  return toSafeUser(updated);
}

const RESET_TOKEN_TTL_HOURS = 1;

/**
 * requestPasswordReset
 *
 * Generates a signed, time-limited reset token for the given email.
 * Returns the plain token (caller must deliver it out-of-band — email, dev log, etc.).
 * If the email is not found we return silently — never reveal whether an account exists.
 *
 * In V1 dev mode the token is returned directly to the route handler which logs it.
 * A real mailer integration is V2+.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND status = 'ACTIVE'`,
    [email.toLowerCase().trim()]
  );
  if (!user) return null;

  // Invalidate all existing unused tokens for this user.
  await query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
    [user.id]
  );

  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return plainToken;
}

/**
 * resetPassword
 *
 * Validates a plain reset token and sets a new password for the owning user.
 * Marks the token as used immediately (single-use); also purges other unused tokens.
 *
 * @throws InvalidResetTokenError — token not found, expired, or already used
 */
export async function resetPassword(plainToken: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

  const tokenRow = await queryOne<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!tokenRow || tokenRow.used_at || tokenRow.expires_at < new Date()) {
    throw new InvalidResetTokenError();
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [newHash, tokenRow.user_id]
    );

    await tx.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [tokenRow.id]
    );

    await tx.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details) VALUES ($1, $2, $3, $4)`,
      ["PASSWORD_CHANGED", tokenRow.user_id, tokenRow.user_id, JSON.stringify({ via: "reset" })]
    );
  });

  // Purge remaining unused tokens for this user (cleanup, non-fatal).
  query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
    [tokenRow.user_id]
  ).catch(() => {});
}
