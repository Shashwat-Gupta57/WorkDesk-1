"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

// Confirmation dialog for destructive actions. Runs an async `onConfirm`,
// shows a busy state, and surfaces any thrown error message.
export function Confirm({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-secondary">{message}</p>
      {error && (
        <div role="alert" className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={run} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
