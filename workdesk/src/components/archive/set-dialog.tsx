"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useCreateSet, useUpdateSet } from "@/modules/archive/hooks";
import type { SetSummary } from "@/modules/archive/types";

// Create a folder under `parentId`, or rename `editing`.
export function SetDialog({
  open,
  onClose,
  parentId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
  editing?: SetSummary | null;
}) {
  const isEdit = Boolean(editing);
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();

  const [name, setName] = useState(editing?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isEdit && editing) {
        await updateSet.mutateAsync({ id: editing.id, payload: { name } });
      } else {
        await createSet.mutateAsync({ name, parentId });
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Rename folder" : "New folder"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" htmlFor="set-name">
          <Input
            id="set-name"
            required
            maxLength={100}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing"
          />
        </Field>

        {error && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Rename" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
