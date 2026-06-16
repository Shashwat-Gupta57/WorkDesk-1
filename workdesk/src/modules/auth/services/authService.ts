import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { SafeUser, UpdateUserPayload, UserSummary } from "@/modules/auth/types";
import { AuditAction, Role, UserStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** bcrypt work factor. 12 is secure and keeps hashing under ~300ms on modern hardware. */
const BCRYPT_ROUNDS = 12;

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

/** Strips passwordHash from a raw User row. */
function toSafeUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  themePreference: string;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    themePreference: user.themePreference,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Writes an immutable audit record. Non-throwing — audit failures must not block ops. */
async function writeAuditLog(
  action: AuditAction,
  actorId: string,
  targetId: string | null,
  details: Record<string, any>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        actorId,
        targetId: targetId ?? undefined,
        details: details as any,
      },
    });
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
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Always run bcrypt even if user not found (dummy hash prevents timing attack).
  const dummyHash =
    "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hashToCompare = user?.passwordHash ?? dummyHash;
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
  const user = await db.user.findUnique({
    where: { id: userId },
  });

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
 * - Runs in a Prisma transaction to ensure atomicity.
 *
 * @throws UserNotFoundError — user no longer exists
 * @throws InvalidCurrentPasswordError — current password is wrong
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new UserNotFoundError();
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new InvalidCurrentPasswordError();
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await tx.auditLog.create({
      data: {
        action: "PASSWORD_CHANGED",
        actorId: userId,
        targetId: userId,
        details: {},
      },
    });
  });
}

/**
 * listAllUsers
 *
 * Returns all users as UserSummary (Admin only — enforced at route handler level).
 * Ordered by creation date descending.
 */
export async function listAllUsers(): Promise<UserSummary[]> {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
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

  const existing = await db.user.findUnique({ where: { id: targetUserId } });
  if (!existing) {
    throw new UserNotFoundError();
  }

  const updated = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: targetUserId },
      data: {
        ...(payload.status !== undefined && { status: payload.status }),
        ...(payload.role !== undefined && { role: payload.role }),
      },
    });

    // Determine which audit action to record.
    let action: AuditAction;
    if (payload.status === "SUSPENDED") {
      action = "USER_SUSPENDED";
    } else if (payload.status === "ACTIVE") {
      action = "USER_ACTIVATED";
    } else {
      action = "USER_ROLE_CHANGED";
    }

    await tx.auditLog.create({
      data: {
        action,
        actorId,
        targetId: targetUserId,
        details: {
          previousState: {
            status: existing.status,
            role: existing.role,
          },
          newState: {
            status: updatedUser.status,
            role: updatedUser.role,
          },
        },
      },
    });

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
