"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useCreateSection } from "@/modules/library/hooks";
import { ApiError } from "@/lib/api-client";

export function CreateSectionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateSection();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() { setName(""); setDescription(""); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name, description: description || null });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create section.");
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New library section">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" htmlFor="section-name">
          <Input id="section-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Onboarding Resources" />
        </Field>
        <Field label="Description (optional)" htmlFor="section-desc">
          <Textarea id="section-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's in this section?" />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
