"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { ApiError } from "@/lib/api-client";
import { useAdminUsers, useTransferOwnership } from "@/modules/auth/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: ownership transfer — pick item kind + ID + target user, then submit.
//
// In V1 the admin manually enters the artifact/set UUID. A full picker UI
// (searchable dropdown of all items) is V2 polish.
// ─────────────────────────────────────────────────────────────────────────────

export function AdminOwnershipPanel() {
  const usersQuery = useAdminUsers();
  const transfer = useTransferOwnership();

  const [kind, setKind] = useState<"artifact" | "set">("artifact");
  const [itemId, setItemId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await transfer.mutateAsync({ kind, itemId: itemId.trim(), newOwnerId });
      setMsg({ type: "success", text: "Ownership transferred successfully." });
      setItemId("");
    } catch (err) {
      setMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Transfer failed.",
      });
    }
  }

  const users = usersQuery.data ?? [];

  if (usersQuery.isLoading) return <LoadingState />;

  return (
    <div className="max-w-md">
      <p className="mb-4 text-sm text-text-secondary">
        Transfer ownership of an artifact or set to another active member. Enter the item UUID
        (visible in the URL when viewing the item).
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border-default p-5">
        <Field label="Item type" htmlFor="own-kind">
          <Select
            id="own-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "artifact" | "set")}
          >
            <option value="artifact">Artifact</option>
            <option value="set">Set</option>
          </Select>
        </Field>

        <Field label="Item UUID" htmlFor="own-item-id">
          <Input
            id="own-item-id"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
            required
          />
        </Field>

        <Field label="New owner" htmlFor="own-new-owner">
          <Select
            id="own-new-owner"
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            required
          >
            <option value="">— select user —</option>
            {users.filter((u) => u.status === "ACTIVE").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>
        </Field>

        {msg && (
          <div
            role="alert"
            className={
              "rounded-md border px-3 py-2 text-sm " +
              (msg.type === "success"
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger")
            }
          >
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={transfer.isPending || !newOwnerId}>
            {transfer.isPending ? "Transferring…" : "Transfer ownership"}
          </Button>
        </div>
      </form>
    </div>
  );
}
