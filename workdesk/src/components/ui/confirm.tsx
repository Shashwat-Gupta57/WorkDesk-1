"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

// Confirmation dialog for destructive actions.
//
// Two usage modes:
//   Async mode (default): pass async onConfirm, omit busy/error.
//     The dialog manages its own loading/error state.
//   External mode: pass busy + optional error from a mutation hook.
//     onConfirm is called synchronously; caller owns state and closing.
export function Confirm({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  busy: externalBusy,
  error: externalError,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: (() => void) | (() => Promise<void>);
  /** External busy flag (use with mutation.isPending). Enables external mode. */
  busy?: boolean;
  /** External error string (use with mutation error). */
  error?: string | null;
}) {
  const [internalBusy, setInternalBusy] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const isExternal = externalBusy !== undefined;
  const busy = isExternal ? externalBusy : internalBusy;
  const error = isExternal ? (externalError ?? null) : internalError;

  async function run() {
    if (isExternal) {
      // Fire-and-forget — parent owns state.
      (onConfirm as () => void)();
      return;
    }
    setInternalError(null);
    setInternalBusy(true);
    try {
      await (onConfirm as () => Promise<void>)();
      onClose();
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "Action failed.");
      setInternalBusy(false);
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
