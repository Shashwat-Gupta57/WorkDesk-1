import { queryOne, transaction } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Ownership Transfer (Admin-only)
//
// Per TRD: the creator is the primary owner; only admins can transfer ownership.
// A member leaving must never cause knowledge loss. Transfer covers artifacts and sets.
// ─────────────────────────────────────────────────────────────────────────────

export class OwnershipTransferError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OwnershipTransferError";
  }
}

export type TransferKind = "artifact" | "set";

/**
 * transferOwnership
 *
 * Moves the owner_id of an artifact or set to a new user.
 * - Both the item and the target user must exist.
 * - Runs transfer + audit log in a single transaction.
 *
 * @throws OwnershipTransferError (ITEM_NOT_FOUND | USER_NOT_FOUND | SAME_OWNER)
 */
export async function transferOwnership(
  adminId: string,
  kind: TransferKind,
  itemId: string,
  newOwnerId: string
): Promise<void> {
  const table = kind === "artifact" ? "artifacts" : "sets";

  const item = await queryOne<{ id: string; owner_id: string }>(
    `SELECT id, owner_id FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
    [itemId]
  );
  if (!item) throw new OwnershipTransferError("ITEM_NOT_FOUND", `${kind} not found.`);
  if (item.owner_id === newOwnerId) throw new OwnershipTransferError("SAME_OWNER", "The target user already owns this item.");

  const targetUser = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND status = 'ACTIVE'`,
    [newOwnerId]
  );
  if (!targetUser) throw new OwnershipTransferError("USER_NOT_FOUND", "Target user not found or is suspended.");

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE ${table} SET owner_id = $1, updated_at = now() WHERE id = $2`,
      [newOwnerId, itemId]
    );

    await tx.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details) VALUES ($1, $2, $3, $4)`,
      [
        "OWNERSHIP_TRANSFERRED",
        adminId,
        itemId,
        JSON.stringify({ kind, previousOwnerId: item.owner_id, newOwnerId }),
      ]
    );
  });
}
