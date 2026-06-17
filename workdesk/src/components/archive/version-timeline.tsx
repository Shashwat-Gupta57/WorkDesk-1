"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Confirm } from "@/components/ui/confirm";
import { ApiError } from "@/lib/api-client";
import { getDownloadUrl, useRestoreVersion } from "@/modules/archive/hooks";
import type { VersionDetail } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// Version timeline — the append-only history of an artifact (newest first).
//
// The first row (highest versionNumber) is the current/head version: it can be
// downloaded but not restored. Older rows offer Restore, which appends a NEW
// head version copying the old content (immutable history — nothing overwritten).
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VersionTimeline({
  artifactId,
  versions,
}: {
  artifactId: string;
  versions: VersionDetail[];
}) {
  const restore = useRestoreVersion(artifactId);
  const [restoreTarget, setRestoreTarget] = useState<VersionDetail | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <EmptyState
        title="No versions yet"
        hint="Commit a version to start this artifact's history. Each commit is preserved forever."
      />
    );
  }

  async function handleDownload(v: VersionDetail) {
    setDownloadError(null);
    setDownloadingId(v.id);
    try {
      const url = await getDownloadUrl(v.contentKey);
      window.location.href = url; // browser handles the download
    } catch (err) {
      setDownloadError(
        err instanceof ApiError
          ? `Download failed: ${err.message}`
          : "Download failed. Is object storage configured?"
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div>
      {downloadError && (
        <div role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {downloadError}
        </div>
      )}

      <ol className="divide-y divide-border-default rounded-lg border border-border-default">
        {versions.map((v, i) => {
          const isHead = i === 0; // versions are newest-first
          return (
            <li key={v.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-surface-container-high text-sm font-semibold text-primary">
                v{v.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-text-primary">
                    {v.changeSummary || `Version ${v.versionNumber}`}
                  </p>
                  {isHead && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-success">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{fmtDate(v.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  className="h-8"
                  disabled={downloadingId === v.id}
                  onClick={() => handleDownload(v)}
                >
                  {downloadingId === v.id ? "…" : "Download"}
                </Button>
                {!isHead && (
                  <Button variant="secondary" className="h-8" onClick={() => setRestoreTarget(v)}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Confirm
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title={`Restore version ${restoreTarget?.versionNumber}`}
        message="This creates a new version at the top of the history pointing at the older content. Nothing is overwritten — the current version is preserved."
        confirmLabel="Restore"
        onConfirm={async () => {
          if (restoreTarget) await restore.mutateAsync(restoreTarget.versionNumber);
        }}
      />
    </div>
  );
}
