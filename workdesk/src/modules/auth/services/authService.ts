import bcrypt from "bcryptjs";
import { query, queryOne, transaction } from "@/lib/db";
import { SafeUser, UpdateUserPayload, UserSummary } from "@/modules/auth/types";
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
