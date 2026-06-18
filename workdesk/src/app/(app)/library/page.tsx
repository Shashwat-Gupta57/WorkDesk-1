"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { Confirm } from "@/components/ui/confirm";
import { CreateSectionDialog } from "@/components/library/create-section-dialog";
import {
  useLibrarySections,
  useLibrarySectionArtifacts,
  useDeleteSection,
  useSubscribeSection,
  useUnsubscribeSection,
  useUnpublishArtifact,
} from "@/modules/library/hooks";
import { useAuth } from "@/lib/auth-context";
import type { LibrarySectionSummary, LibraryArtifactItem } from "@/modules/library/types";

// ─────────────────────────────────────────────────────────────────────────────
// Library page — section grid + section detail panel
// ─────────────────────────────────────────────────────────────────────────────

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  section,
  isActive,
  isCreator,
  isAdmin,
  onSelect,
  onDelete,
  onSubscribe,
  onUnsubscribe,
  subPending,
}: {
  section: LibrarySectionSummary;
  isActive: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  subPending: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-4 cursor-pointer transition-colors hover:border-primary/50 " +
        (isActive ? "border-primary bg-primary/5" : "border-border-default bg-surface-container")
      }
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-primary truncate">{section.name}</h3>
          {section.description && (
            <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{section.description}</p>
          )}
          <p className="mt-2 text-xs text-text-secondary">
            {section.artifactCount} artifact{section.artifactCount !== 1 ? "s" : ""} ·{" "}
            {section.subscriberCount} subscriber{section.subscriberCount !== 1 ? "s" : ""} ·{" "}
            by {section.createdByName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          {section.isSubscribed ? (
            <Button variant="secondary" className="h-6 text-xs" disabled={subPending} onClick={onUnsubscribe}>
              Subscribed
            </Button>
          ) : (
            <Button variant="ghost" className="h-6 text-xs" disabled={subPending} onClick={onSubscribe}>
              Subscribe
            </Button>
          )}
          {(isCreator || isAdmin) && (
            <Button variant="ghost" className="h-6 text-xs text-danger hover:text-danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section detail panel ──────────────────────────────────────────────────────

function SectionDetail({
  section,
  userId,
}: {
  section: LibrarySectionSummary;
  userId: string;
}) {
  const { data: artifacts, isLoading, error } = useLibrarySectionArtifacts(section.id);
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border-default px-5 py-4">
        <h2 className="font-semibold text-text-primary">{section.name}</h2>
        {section.description && (
          <p className="mt-0.5 text-sm text-text-secondary">{section.description}</p>
        )}
        <p className="mt-1 text-xs text-text-secondary">
          Created by {section.createdByName} · {section.artifactCount} artifact{section.artifactCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading && <LoadingState label="Loading artifacts…" />}
        {error && <ErrorState message="Failed to load artifacts." />}
        {!isLoading && !error && artifacts?.length === 0 && (
          <EmptyState title="No artifacts yet" hint="Publish an artifact from your workspace to add it here." />
        )}
        {artifacts && artifacts.length > 0 && (
          <ul className="space-y-2">
            {artifacts.map((art) => (
              <ArtifactRow
                key={art.id}
                art={art}
                sectionId={section.id}
                isOwner={art.ownerId === userId}
                onOpen={() => router.push(`/archive/${art.id}`)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ArtifactRow({
  art,
  sectionId,
  isOwner,
  onOpen,
}: {
  art: LibraryArtifactItem;
  sectionId: string;
  isOwner: boolean;
  onOpen: () => void;
}) {
  const unpublish = useUnpublishArtifact(sectionId);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-container px-4 py-3">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className="truncate font-medium text-text-primary">{art.title}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {art.type} · by {art.ownerName}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          PUBLIC
        </span>
        {isOwner && (
          <Button
            variant="ghost"
            className="h-6 text-xs text-text-secondary hover:text-danger"
            disabled={unpublish.isPending}
            onClick={() => unpublish.mutate(art.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { user } = useAuth();
  const { data: sections, isLoading, error } = useLibrarySections();
  const deleteSection = useDeleteSection();
  const subscribeSection = useSubscribeSection();
  const unsubscribeSection = useUnsubscribeSection();

  const [createOpen, setCreateOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<LibrarySectionSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: section grid */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border-default">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <h1 className="font-semibold text-text-primary">Library</h1>
          <Button variant="secondary" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
            New section
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && <LoadingState label="Loading sections…" />}
          {error && <ErrorState message="Failed to load library." />}
          {!isLoading && !error && sections?.length === 0 && (
            <EmptyState title="No sections yet" hint="Create one to start publishing artifacts." />
          )}
          {sections?.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              isActive={activeSection?.id === s.id}
              isCreator={s.createdBy === user?.id}
              isAdmin={isAdmin}
              onSelect={() => setActiveSection(s)}
              onDelete={() => { setDeleteError(null); setDeleteTarget({ id: s.id, name: s.name }); }}
              onSubscribe={() => subscribeSection.mutate(s.id)}
              onUnsubscribe={() => unsubscribeSection.mutate(s.id)}
              subPending={
                (subscribeSection.isPending && subscribeSection.variables === s.id) ||
                (unsubscribeSection.isPending && unsubscribeSection.variables === s.id)
              }
            />
          ))}
        </div>
      </div>

      {/* Right: section detail */}
      <main className="flex flex-1 overflow-hidden">
        {activeSection && user ? (
          <SectionDetail section={activeSection} userId={user.id} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="Select a section"
              hint="Choose a section from the left to browse its artifacts."
              action={<Button onClick={() => setCreateOpen(true)}>New section</Button>}
            />
          </div>
        )}
      </main>

      <CreateSectionDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <Confirm
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete section"
        message={`Delete "${deleteTarget?.name}"? Artifacts in this section will remain in their owners' archives. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteSection.isPending}
        error={deleteError}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteSection.mutate(deleteTarget.id, {
            onSuccess: () => {
              if (activeSection?.id === deleteTarget.id) setActiveSection(null);
              setDeleteTarget(null);
            },
            onError: () => setDeleteError("Failed to delete section."),
          });
        }}
      />
    </div>
  );
}
