"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ArtifactDialog } from "@/components/archive/artifact-dialog";
import { CommitVersionDialog } from "@/components/archive/commit-version-dialog";
import { VersionTimeline } from "@/components/archive/version-timeline";
import { useArtifactDetail } from "@/modules/archive/hooks";
import { useRecordOpen } from "@/modules/activity/hooks";
import { ApiError } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Artifact workspace (Slice 2).
//
// Scope: metadata (view + edit), version timeline, commit-new-version, restore,
// per-version download. No editor / comments / collaborators (V1.1+).
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ArtifactWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading, error } = useArtifactDetail(id);
  const recordOpen = useRecordOpen();

  // Record open on first successful load (fire-and-forget).
  useEffect(() => {
    if (artifact) {
      recordOpen.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  const [editOpen, setEditOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="px-8 py-6">
        <LoadingState label="Loading artifact…" />
      </div>
    );
  }

  if (error || !artifact) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="px-8 py-6">
        <ErrorState
          message={notFound ? "This artifact doesn't exist or has been deleted." : "Failed to load this artifact."}
        />
        <Link href="/archive" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-start justify-between border-b border-border-default px-8 py-5">
        <div className="min-w-0">
          <Link href="/archive" className="text-xs text-text-secondary hover:text-text-primary">
            ← Archive
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold text-text-primary">{artifact.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit metadata
          </Button>
          <Button onClick={() => setCommitOpen(true)}>Commit new version</Button>
        </div>
      </div>

      {/* Body: center (versions) + right (metadata) */}
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 overflow-y-auto px-8 py-6">
          {artifact.description && (
            <p className="mb-6 max-w-2xl text-sm text-text-secondary">{artifact.description}</p>
          )}
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Version history</h2>
          <VersionTimeline artifactId={artifact.id} versions={artifact.versions} />
        </section>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border-default bg-surface-secondary px-5 py-6">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Properties</h2>
          <dl className="space-y-3 text-sm">
            <Meta label="Type" value={artifact.type} />
            <Meta label="Visibility" value={artifact.visibility} />
            <Meta label="Created" value={fmtDate(artifact.createdAt)} />
            <Meta label="Last modified" value={fmtDate(artifact.updatedAt)} />
            <div>
              <dt className="text-text-secondary">Tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {artifact.tags.length === 0 ? (
                  <span className="text-text-secondary/60">None</span>
                ) : (
                  artifact.tags.map((t) => (
                    <span key={t} className="rounded bg-surface-container-high px-2 py-0.5 text-xs text-text-primary">
                      {t}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      {/* Dialogs */}
      <ArtifactDialog
        open={editOpen}
        editing={artifact}
        setId={artifact.setId}
        onClose={() => setEditOpen(false)}
      />
      <CommitVersionDialog open={commitOpen} artifactId={artifact.id} onClose={() => setCommitOpen(false)} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-text-primary">{value}</dd>
    </div>
  );
}
