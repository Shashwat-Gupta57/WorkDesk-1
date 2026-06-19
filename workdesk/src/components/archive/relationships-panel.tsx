"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { Confirm } from "@/components/ui/confirm";
import { ApiError } from "@/lib/api-client";
import {
  useRelationships,
  useCreateRelationship,
  useDeleteRelationship,
} from "@/modules/relationships/hooks";
import type { ArtifactRelationship } from "@/modules/relationships/types";

// ─────────────────────────────────────────────────────────────────────────────
// RelationshipsPanel — shown in the artifact workspace properties sidebar.
// Lists all edges (in/out) for this artifact, lets the owner add/remove them.
// ─────────────────────────────────────────────────────────────────────────────

const RELATIONSHIP_LABELS: Record<string, string> = {
  BELONGS_TO:  "Belongs to",
  RELATED_TO:  "Related to",
  DERIVED_FROM: "Derived from",
  REPLACES:    "Replaces",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  BELONGS_TO:  "#58a6ff",
  RELATED_TO:  "#3fb950",
  DERIVED_FROM: "#d29922",
  REPLACES:    "#f85149",
};

// ── Add relationship dialog ───────────────────────────────────────────────────

function AddRelationshipDialog({
  open,
  onClose,
  fromId,
}: {
  open: boolean;
  onClose: () => void;
  fromId: string;
}) {
  const create = useCreateRelationship();
  const [toId, setToId] = useState("");
  const [type, setType] = useState("RELATED_TO");
  const [error, setError] = useState<string | null>(null);

  function reset() { setToId(""); setType("RELATED_TO"); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = toId.trim();
    if (!id) { setError("Paste an artifact ID to link."); return; }
    try {
      await create.mutateAsync({ fromId, toId: id, type });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create relationship.");
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add relationship">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Relationship type" htmlFor="rel-type">
          <Select
            id="rel-type"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Target artifact ID" htmlFor="rel-to">
          <Input
            id="rel-to"
            value={toId}
            onChange={e => setToId(e.target.value)}
            placeholder="Paste the artifact's UUID"
            required
          />
        </Field>
        <p className="text-xs text-text-secondary">
          Find an artifact's ID from its workspace URL: <code className="text-primary">/archive/&lt;id&gt;</code>
        </p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding…" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Relationship row ──────────────────────────────────────────────────────────

function RelRow({
  rel,
  currentId,
}: {
  rel: ArtifactRelationship;
  currentId: string;
}) {
  const del = useDeleteRelationship();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const isFrom = rel.fromId === currentId;
  const otherId = isFrom ? rel.toId : rel.fromId;
  const otherTitle = isFrom ? rel.toTitle : rel.fromTitle;
  const color = RELATIONSHIP_COLORS[rel.type] ?? "#8b949e";
  const label = RELATIONSHIP_LABELS[rel.type] ?? rel.type;

  return (
    <li
      className="group flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-surface-container"
      style={{ animationName: "graphNodeIn", animationDuration: "0.25s", animationFillMode: "both" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
          >
            {isFrom ? "→" : "←"} {label}
          </span>
        </div>
        <Link
          href={`/archive/${otherId}`}
          className="block truncate text-xs text-text-primary hover:text-primary hover:underline"
        >
          {otherTitle}
        </Link>
        <p className="text-[10px] text-text-secondary/70">by {rel.createdByName}</p>
      </div>
      <button
        onClick={() => { setDelError(null); setConfirmOpen(true); }}
        className="shrink-0 rounded p-0.5 text-text-secondary/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
        title="Remove relationship"
      >
        ✕
      </button>
      <Confirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Remove relationship"
        message={`Remove the "${label}" link to "${otherTitle}"?`}
        confirmLabel="Remove"
        busy={del.isPending}
        error={delError}
        onConfirm={() =>
          del.mutate(rel.id, {
            onSuccess: () => setConfirmOpen(false),
            onError: () => setDelError("Failed to remove relationship."),
          })
        }
      />
    </li>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function RelationshipsPanel({
  artifactId,
  artifactTitle,
}: {
  artifactId: string;
  artifactTitle: string;
}) {
  const { data: rels, isLoading } = useRelationships(artifactId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Relationships
        </h3>
        <button
          onClick={() => setAddOpen(true)}
          className="text-[10px] text-primary hover:underline"
        >
          + Add
        </button>
      </div>

      {isLoading && <LoadingState label="" />}

      {!isLoading && rels && rels.length === 0 && (
        <p className="text-xs text-text-secondary/60">
          No relationships yet. Link this artifact to others to surface connections in the Graph.
        </p>
      )}

      {rels && rels.length > 0 && (
        <ul className="space-y-0.5">
          {rels.map(r => (
            <RelRow key={r.id} rel={r} currentId={artifactId} />
          ))}
        </ul>
      )}

      <AddRelationshipDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        fromId={artifactId}
      />
    </div>
  );
}
