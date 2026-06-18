"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ArtifactDialog } from "@/components/archive/artifact-dialog";
import { CommitVersionDialog } from "@/components/archive/commit-version-dialog";
import { VersionTimeline } from "@/components/archive/version-timeline";
import { RichTextEditor } from "@/components/archive/rich-text-editor";
import { RichTextViewer } from "@/components/archive/rich-text-editor";
import { DiffViewer } from "@/components/archive/diff-viewer";
import { FileViewer } from "@/components/archive/file-viewer";
import { useArtifactDetail, useTextContent, useSaveTextContent } from "@/modules/archive/hooks";
import { useRecordOpen } from "@/modules/activity/hooks";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { ArtifactType } from "@/lib/enums";
import type { VersionDetail } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// Artifact workspace.
//
// Center section logic:
//   TEXT artifact
//     owner  → editable RichTextEditor (or DiffViewer when comparing)
//     viewer → read-only RichTextViewer
//   Non-TEXT artifact with a head version → FileViewer (PDF/image/DOCX/PPTX/other)
//   No versions yet → prompt to commit one
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ArtifactWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading, error } = useArtifactDetail(id);
  const recordOpen = useRecordOpen();
  const { user } = useAuth();

  useEffect(() => {
    if (artifact) recordOpen.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  const [editOpen, setEditOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [compareVersion, setCompareVersion] = useState<VersionDetail | null>(null);

  const isText = artifact?.type === ArtifactType.TEXT;
  const isOwner = Boolean(user && artifact && user.id === artifact.ownerId);
  const headVersion = artifact?.versions[0] ?? null;

  // Text content (TEXT artifacts only — only loaded when needed).
  const { data: headContent, isLoading: contentLoading } = useTextContent(
    id,
    undefined,
    // only fetch when it's a TEXT artifact
    isText
  );
  const { data: compareContent, isLoading: compareLoading } = useTextContent(
    id,
    compareVersion?.versionNumber,
    isText && Boolean(compareVersion)
  );
  const saveContent = useSaveTextContent(id);

  const handleSave = useCallback(
    async (doc: Record<string, unknown>, changeSummary: string | null) => {
      await saveContent.mutateAsync({ doc, changeSummary });
    },
    [saveContent]
  );

  function handleCompare(versionNumber: number) {
    const v = artifact?.versions.find((v) => v.versionNumber === versionNumber);
    setCompareVersion(v ?? null);
  }

  if (isLoading) {
    return <div className="px-8 py-6"><LoadingState label="Loading artifact…" /></div>;
  }

  if (error || !artifact) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="px-8 py-6">
        <ErrorState message={notFound ? "This artifact doesn't exist or has been deleted." : "Failed to load this artifact."} />
        <Link href="/archive" className="mt-4 inline-block text-sm text-primary hover:underline">← Back to Archive</Link>
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
          {isOwner && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit metadata
            </Button>
          )}
          {/* TEXT artifacts are saved via the editor; other types need a file commit. */}
          {isOwner && !isText && (
            <Button onClick={() => setCommitOpen(true)}>Commit new version</Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 overflow-y-auto px-8 py-6">
          {artifact.description && (
            <p className="mb-6 max-w-2xl text-sm text-text-secondary">{artifact.description}</p>
          )}

          <CenterContent
            artifact={artifact}
            isText={isText}
            isOwner={isOwner}
            headVersion={headVersion}
            headContent={headContent ?? null}
            contentLoading={contentLoading}
            compareVersion={compareVersion}
            compareContent={compareContent ?? null}
            compareLoading={compareLoading}
            saving={saveContent.isPending}
            onSave={handleSave}
            onCompare={handleCompare}
            onCloseCompare={() => setCompareVersion(null)}
          />

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Version history</h2>
            <VersionTimeline
              artifactId={artifact.id}
              versions={artifact.versions}
              onCompare={isText ? handleCompare : undefined}
            />
          </div>
        </section>

        {/* Right panel: properties */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border-default bg-surface-secondary px-5 py-6">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Properties</h2>
          <dl className="space-y-3 text-sm">
            <Meta label="Type" value={artifact.type} />
            <Meta label="Visibility" value={artifact.visibility} />
            <Meta label="Created" value={fmtDate(artifact.createdAt)} />
            <Meta label="Last modified" value={fmtDate(artifact.updatedAt)} />
            {!isOwner && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Read-only — you are not the owner of this artifact.
              </div>
            )}
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
      {isOwner && (
        <>
          <ArtifactDialog
            open={editOpen}
            editing={artifact}
            setId={artifact.setId}
            onClose={() => setEditOpen(false)}
          />
          <CommitVersionDialog
            open={commitOpen}
            artifactId={artifact.id}
            artifactType={artifact.type}
            onClose={() => setCommitOpen(false)}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center content — separated to keep the parent readable.
// ─────────────────────────────────────────────────────────────────────────────

interface CenterContentProps {
  artifact: { id: string; type: string; versions: VersionDetail[] };
  isText: boolean;
  isOwner: boolean;
  headVersion: VersionDetail | null;
  headContent: Record<string, unknown> | null;
  contentLoading: boolean;
  compareVersion: VersionDetail | null;
  compareContent: Record<string, unknown> | null;
  compareLoading: boolean;
  saving: boolean;
  onSave: (doc: Record<string, unknown>, changeSummary: string | null) => Promise<void>;
  onCompare: (versionNumber: number) => void;
  onCloseCompare: () => void;
}

function CenterContent({
  artifact,
  isText,
  isOwner,
  headVersion,
  headContent,
  contentLoading,
  compareVersion,
  compareContent,
  compareLoading,
  saving,
  onSave,
  onCloseCompare,
}: CenterContentProps) {
  // ── TEXT artifact ─────────────────────────────────────────────────────────
  if (isText) {
    if (compareVersion && artifact.versions[0]) {
      return (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Comparing v{compareVersion.versionNumber} → current
            </h2>
            <button
              type="button"
              onClick={onCloseCompare}
              className="text-xs text-primary hover:underline"
            >
              ✕ Close diff
            </button>
          </div>
          <DiffViewer
            versionA={compareVersion}
            versionB={artifact.versions[0]}
            contentA={compareContent}
            contentB={headContent}
            loading={compareLoading || contentLoading}
          />
        </div>
      );
    }

    if (contentLoading) {
      return <div className="text-sm text-text-secondary">Loading content…</div>;
    }

    if (isOwner) {
      return (
        <RichTextEditor
          initialContent={headContent}
          onSave={onSave}
          saving={saving}
        />
      );
    }

    // Non-owner: read-only viewer
    return (
      <div>
        <p className="mb-3 text-xs text-text-secondary">Read-only view</p>
        <RichTextViewer content={headContent} />
      </div>
    );
  }

  // ── Non-TEXT: in-browser file viewer ────────────────────────────────────
  if (!headVersion) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-default py-12 text-center text-sm text-text-secondary">
        <p>No versions committed yet.</p>
        {isOwner && (
          <p className="text-xs">Use "Commit new version" above to upload the first file.</p>
        )}
      </div>
    );
  }

  return (
    <FileViewer
      contentKey={headVersion.contentKey}
      artifactType={artifact.type}
      title=""
    />
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
