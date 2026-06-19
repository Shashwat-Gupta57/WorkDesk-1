"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Check, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ArtifactDialog } from "@/components/archive/artifact-dialog";
import { CommitVersionDialog } from "@/components/archive/commit-version-dialog";
import { ShareDialog } from "@/components/archive/share-dialog";
import { PublishDialog } from "@/components/library/publish-dialog";
import { VersionTimeline } from "@/components/archive/version-timeline";
import { RichTextEditor } from "@/components/archive/rich-text-editor";
import { RichTextViewer } from "@/components/archive/rich-text-editor";
import { DiffViewer } from "@/components/archive/diff-viewer";
import { FileViewer } from "@/components/archive/file-viewer";
import { TagPicker } from "@/components/archive/tag-picker";
import { RelationshipsPanel } from "@/components/archive/relationships-panel";
import { useArtifactDetail, useTextContent, useSaveTextContent, useUpdateArtifact } from "@/modules/archive/hooks";
import { useRecordOpen } from "@/modules/activity/hooks";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { ArtifactType } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { VersionDetail } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// Artifact workspace.
//
// Save-state machine: idle → saving → saved | error → idle (auto-resets after 2.5s)
// Title: inline-editable input that saves on blur.
// Unsaved content: beforeunload guard + modal on programmatic navigation.
// ─────────────────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ArtifactWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading, error } = useArtifactDetail(id);
  const recordOpen = useRecordOpen();
  const { user } = useAuth();
  const updateArtifact = useUpdateArtifact();

  useEffect(() => {
    if (artifact) recordOpen.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [compareVersion, setCompareVersion] = useState<VersionDetail | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  // ── Inline title ───────────────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (artifact) setTitleDraft(artifact.title);
  }, [artifact?.title]);

  async function handleTitleBlur() {
    if (!artifact || !titleDraft.trim() || titleDraft.trim() === artifact.title) return;
    await updateArtifact.mutateAsync({ id, payload: { title: titleDraft.trim() } });
  }

  const isText = artifact?.type === ArtifactType.TEXT;
  const isOwner = Boolean(user && artifact && user.id === artifact.ownerId);
  const headVersion = artifact?.versions[0] ?? null;

  const { data: headContent, isLoading: contentLoading } = useTextContent(id, undefined, isText);
  const { data: compareContent, isLoading: compareLoading } = useTextContent(
    id, compareVersion?.versionNumber, isText && Boolean(compareVersion)
  );
  const saveContent = useSaveTextContent(id);

  const handleSave = useCallback(
    async (doc: Record<string, unknown>, changeSummary: string | null) => {
      setSaveState("saving");
      try {
        await saveContent.mutateAsync({ doc, changeSummary });
        setHasUnsaved(false);
        setSaveState("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500);
      } catch {
        setSaveState("error");
      }
    },
    [saveContent]
  );

  // Warn browser on close if unsaved
  useEffect(() => {
    function guard(e: BeforeUnloadEvent) {
      if (hasUnsaved) e.preventDefault();
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [hasUnsaved]);

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
      <div className="flex items-center gap-3 border-b border-border-default px-6 py-3 shrink-0">
        <Link
          href="/archive"
          className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary transition-colors shrink-0"
        >
          <ChevronLeft size={14} />
          Archive
        </Link>
        <span className="text-border-default select-none">/</span>

        {/* Inline title */}
        {isOwner ? (
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 min-w-0 text-[15px] font-semibold text-text-primary bg-transparent outline-none focus:bg-surface-container rounded px-1 -ml-1 transition-colors truncate"
          />
        ) : (
          <span className="flex-1 min-w-0 text-[15px] font-semibold text-text-primary truncate">{artifact.title}</span>
        )}

        {/* Save indicator */}
        <div className="shrink-0 min-w-[80px] flex items-center gap-1.5 text-[12px]">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-text-secondary">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-success">
              <Check size={12} /> Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="flex items-center gap-1 text-danger">
              <AlertCircle size={12} /> Save failed
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isOwner && (
            <>
              <Button variant="secondary" onClick={() => setPublishOpen(true)}>Publish</Button>
              <Button variant="secondary" onClick={() => setShareOpen(true)}>Share</Button>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit info</Button>
            </>
          )}
          {isOwner && !isText && (
            <Button onClick={() => setCommitOpen(true)}>Commit version</Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center: content */}
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
            saving={saveState === "saving"}
            onSave={handleSave}
            onCompare={handleCompare}
            onCloseCompare={() => setCompareVersion(null)}
            onContentChange={() => setHasUnsaved(true)}
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
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border-default bg-surface-secondary px-5 py-5">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-text-secondary">Properties</h2>
          <dl className="space-y-4 text-sm">
            <PropRow label="Type" value={artifact.type} />
            <div>
              <dt className="text-[12px] text-text-secondary mb-0.5">Visibility</dt>
              <dd className="flex items-center gap-1.5">
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  artifact.visibility === "PUBLIC" ? "bg-success"
                    : artifact.visibility === "SHARED" ? "bg-warning"
                    : "bg-text-secondary"
                )} />
                <span className="text-[13px] text-text-primary capitalize">{artifact.visibility.toLowerCase()}</span>
                {artifact.visibility === "PUBLIC" && (
                  <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Published
                  </span>
                )}
              </dd>
            </div>
            <PropRow label="Created" value={fmtDate(artifact.createdAt)} />
            <PropRow label="Modified" value={fmtDate(artifact.updatedAt)} />

            {!isOwner && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Read-only — you are not the owner.
              </div>
            )}

            <div>
              <dt className="text-[12px] text-text-secondary mb-2">Tags</dt>
              <dd>
                {isOwner ? (
                  <TagPicker artifactId={artifact.id} tags={artifact.tags} />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {artifact.tags.length === 0 ? (
                      <span className="text-[12px] text-text-secondary/60">None</span>
                    ) : (
                      artifact.tags.map(t => (
                        <span key={t} className="rounded bg-surface-container-high px-2 py-0.5 text-[11px] text-text-primary">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </dd>
            </div>
          </dl>

          {/* Relationships */}
          <div className="mt-6 border-t border-border-default pt-5">
            <RelationshipsPanel artifactId={artifact.id} artifactTitle={artifact.title} />
          </div>
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
          <ShareDialog
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            artifactId={artifact.id}
            artifactTitle={artifact.title}
          />
          <PublishDialog
            open={publishOpen}
            onClose={() => setPublishOpen(false)}
            artifactId={artifact.id}
            artifactTitle={artifact.title}
          />
        </>
      )}

      {/* Unsaved changes warning */}
      {unsavedOpen && (
        <UnsavedWarningModal
          onKeep={() => setUnsavedOpen(false)}
          onDiscard={() => { setHasUnsaved(false); setUnsavedOpen(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center content
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
  onContentChange: () => void;
}

function CenterContent({
  artifact, isText, isOwner, headVersion, headContent, contentLoading,
  compareVersion, compareContent, compareLoading, saving, onSave, onCloseCompare, onContentChange,
}: CenterContentProps) {
  if (isText) {
    if (compareVersion && artifact.versions[0]) {
      return (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Comparing v{compareVersion.versionNumber} → current
            </h2>
            <button type="button" onClick={onCloseCompare} className="text-xs text-primary hover:underline">
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
          onChange={onContentChange}
        />
      );
    }

    return (
      <div>
        <p className="mb-3 text-xs text-text-secondary">Read-only view</p>
        <RichTextViewer content={headContent} />
      </div>
    );
  }

  if (!headVersion) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-default py-12 text-center text-sm text-text-secondary">
        <p>No versions committed yet.</p>
        {isOwner && <p className="text-xs">Use "Commit version" above to upload the first file.</p>}
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-text-secondary mb-0.5">{label}</dt>
      <dd className="text-[13px] text-text-primary">{value}</dd>
    </div>
  );
}

function UnsavedWarningModal({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-elevated border border-border-default rounded-lg shadow-xl w-80 p-6 space-y-4">
        <p className="text-[14px] font-semibold text-text-primary">Unsaved changes</p>
        <p className="text-[13px] text-text-secondary">You have unsaved changes that will be lost.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onDiscard} className="h-8 px-3 text-[12px] text-danger border border-border-default rounded hover:bg-danger/10 transition-colors">
            Discard
          </button>
          <button onClick={onKeep} className="h-8 px-3 text-[12px] bg-primary text-on-primary rounded hover:opacity-90 transition-opacity">
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
