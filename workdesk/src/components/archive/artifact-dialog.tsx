"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { uploadFile, UploadError } from "@/modules/archive/upload";
import { useCreateArtifact, useUpdateArtifact } from "@/modules/archive/hooks";
import { ArtifactType } from "@/lib/enums";
import type { ArtifactSummary } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// Create / edit artifact.
//
// Create: title, description, tags, type, optional file (→ presigned upload →
// committed as initial version via the artifact's initialFileKey).
// Edit: metadata only (title/description/tags). File versions are managed in the
// artifact workspace (Slice 2).
// ─────────────────────────────────────────────────────────────────────────────

const TYPES = Object.values(ArtifactType);

export function ArtifactDialog({
  open,
  onClose,
  setId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  setId: string | null; // current folder (null = root)
  editing?: ArtifactSummary | null;
}) {
  const isEdit = Boolean(editing);
  const createArtifact = useCreateArtifact();
  const updateArtifact = useUpdateArtifact();

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [tagsText, setTagsText] = useState((editing?.tags ?? []).join(", "));
  const [type, setType] = useState<string>(editing?.type ?? ArtifactType.TEXT);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parseTags = () =>
    tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isEdit && editing) {
        await updateArtifact.mutateAsync({
          id: editing.id,
          payload: { title, description: description || null, tags: parseTags() },
        });
      } else {
        let initialFileKey: string | undefined;
        if (file) {
          initialFileKey = await uploadFile(file);
        }
        await createArtifact.mutateAsync({
          title,
          description: description || null,
          tags: parseTags(),
          type: type as ArtifactType,
          setId,
          initialFileKey,
        });
      }
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit artifact" : "New artifact"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title" htmlFor="art-title">
          <Input
            id="art-title"
            required
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Marketing analysis"
          />
        </Field>

        <Field label="Description" htmlFor="art-desc">
          <Textarea
            id="art-desc"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional summary…"
          />
        </Field>

        <Field label="Tags (comma-separated)" htmlFor="art-tags">
          <Input
            id="art-tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="q3, proposal"
          />
        </Field>

        {!isEdit && (
          <>
            <Field label="Type" htmlFor="art-type">
              <Select id="art-type" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="File (optional — committed as version 1)" htmlFor="art-file">
              <input
                id="art-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-sm file:text-text-primary hover:file:bg-surface-container"
              />
            </Field>
          </>
        )}

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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
