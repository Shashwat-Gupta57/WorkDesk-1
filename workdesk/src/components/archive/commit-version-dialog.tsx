"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { uploadFile, UploadError } from "@/modules/archive/upload";
import { useCommitVersion } from "@/modules/archive/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Commit a new version: upload a file to R2 (presigned PUT) → commit the
// returned contentKey as the next immutable version on this artifact.
// ─────────────────────────────────────────────────────────────────────────────

export function CommitVersionDialog({
  open,
  onClose,
  artifactId,
}: {
  open: boolean;
  onClose: () => void;
  artifactId: string;
}) {
  const commit = useCommitVersion(artifactId);
  const [file, setFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    setChangeSummary("");
    setError(null);
    setBusy(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to commit as the new version.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const contentKey = await uploadFile(file);
      await commit.mutateAsync({
        contentKey,
        changeSummary: changeSummary.trim() || null,
      });
      reset();
      onClose();
    } catch (err) {
      if (err instanceof UploadError) {
        setError(`File upload failed: ${err.message}`);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Commit new version"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="File" htmlFor="ver-file">
          <input
            id="ver-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-sm file:text-text-primary hover:file:bg-surface-container"
          />
        </Field>

        <Field label="Change summary (optional)" htmlFor="ver-summary">
          <Input
            id="ver-summary"
            maxLength={255}
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed in this version?"
          />
        </Field>

        {error && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Committing…" : "Commit version"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
