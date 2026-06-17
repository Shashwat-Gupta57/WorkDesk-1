import { query, queryOne } from "@/lib/db";
import { StorageUsage } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Storage Service (Slice 4)
//
// Tracks per-user byte usage against an admin-configurable quota.
// storage_used_bytes is maintained as a running counter updated at:
//   • version commit  (+ byteSize)
//   • permanent delete (- byteSize)
// The quota check at upload-ticket time is SOFT — the server issues the ticket
// based on a client-declared size. True usage is reconciled at commit time.
// ─────────────────────────────────────────────────────────────────────────────

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  constructor(message = "Upload would exceed your storage quota.") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

interface UserStorageRow {
  storage_used_bytes: string; // pg returns bigint as string
  quota_bytes: string;
}

/** Get storage usage for the calling user. */
export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  const row = await queryOne<UserStorageRow>(
    `SELECT storage_used_bytes, quota_bytes FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) throw new UserNotFoundError();

  const used = Number(row.storage_used_bytes);
  const quota = Number(row.quota_bytes);
  return {
    usedBytes: used,
    quotaBytes: quota,
    usedPercent: quota > 0 ? Math.min(100, (used / quota) * 100) : 0,
  };
}

/**
 * Soft quota check — called at upload-ticket issuance.
 * Rejects if used + declaredSize > quota. Non-blocking: if declaredSize is 0
 * (client didn't send Content-Length) we skip the check.
 */
export async function assertQuota(userId: string, declaredBytes: number): Promise<void> {
  if (declaredBytes <= 0) return; // unknown size — skip soft check

  const row = await queryOne<UserStorageRow>(
    `SELECT storage_used_bytes, quota_bytes FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) throw new UserNotFoundError();

  const used = Number(row.storage_used_bytes);
  const quota = Number(row.quota_bytes);
  if (used + declaredBytes > quota) {
    throw new QuotaExceededError();
  }
}

/**
 * Add bytes to the user's running counter after a successful version commit.
 * Called inside the commitVersion transaction.
 */
export async function incrementStorageUsed(userId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  await query(
    `UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2`,
    [bytes, userId]
  );
}

/** Admin: set a user's quota. */
export async function setUserQuota(targetUserId: string, quotaBytes: number): Promise<void> {
  const result = await query<{ id: string }>(
    `UPDATE users SET quota_bytes = $1 WHERE id = $2 RETURNING id`,
    [quotaBytes, targetUserId]
  );
  if (result.length === 0) throw new UserNotFoundError();
}

/** Admin: get storage overview for all users (for admin dashboard). */
export async function getAllUsersStorage(): Promise<
  { userId: string; name: string; email: string; usedBytes: number; quotaBytes: number }[]
> {
  const rows = await query<{
    id: string;
    name: string;
    email: string;
    storage_used_bytes: string;
    quota_bytes: string;
  }>(
    `SELECT id, name, email, storage_used_bytes, quota_bytes FROM users ORDER BY storage_used_bytes DESC`
  );
  return rows.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    usedBytes: Number(r.storage_used_bytes),
    quotaBytes: Number(r.quota_bytes),
  }));
}
