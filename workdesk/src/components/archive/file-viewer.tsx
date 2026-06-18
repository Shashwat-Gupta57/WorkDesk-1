"use client";

import { useState, useEffect } from "react";
import { ArtifactType } from "@/lib/enums";
import { getDownloadUrl } from "@/modules/archive/hooks";
import { ApiError } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// FileViewer — renders the head version of a non-TEXT artifact in-browser.
//
// PDF / PPTX / DOCX  → <iframe> via browser-native PDF renderer (PDF) or
//                       Google Docs viewer for office files (fallback download).
// IMAGE              → <img> with natural size / max-width.
// OTHER / ZIP        → Download-only prompt.
// ─────────────────────────────────────────────────────────────────────────────

interface FileViewerProps {
  contentKey: string;
  artifactType: ArtifactType | string;
  title: string;
}

export function FileViewer({ contentKey, artifactType, title }: FileViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    getDownloadUrl(contentKey)
      .then((u) => { if (!cancelled) { setUrl(u); setLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Could not load file. Is storage configured?"
          );
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [contentKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
        Loading file…
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error ?? "File unavailable."}
      </div>
    );
  }

  const type = artifactType as ArtifactType;

  if (type === ArtifactType.IMAGE) {
    return (
      <div className="flex justify-center rounded-lg border border-border-default bg-surface-container p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          className="max-h-[70vh] max-w-full rounded object-contain"
        />
      </div>
    );
  }

  if (type === ArtifactType.PDF) {
    return (
      <div className="overflow-hidden rounded-lg border border-border-default" style={{ height: "75vh" }}>
        <iframe
          src={url}
          title={title}
          className="h-full w-full"
          allow="fullscreen"
        />
      </div>
    );
  }

  if (type === ArtifactType.DOCX || type === ArtifactType.PPTX) {
    // Google Docs Viewer works with public URLs. For presigned URLs (which may redirect)
    // we try it as a best-effort; if it fails the user can always download.
    const viewerUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`;
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg border border-border-default" style={{ height: "75vh" }}>
          <iframe
            src={viewerUrl}
            title={title}
            className="h-full w-full"
            allow="fullscreen"
          />
        </div>
        <p className="text-xs text-text-secondary">
          If the preview doesn't load,{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            download the file
          </a>{" "}
          to open it locally.
        </p>
      </div>
    );
  }

  // ZIP / OTHER / unknown — download prompt only.
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border-default bg-surface-container px-8 py-12 text-center">
      <div className="text-4xl">📁</div>
      <p className="text-sm text-text-secondary">
        This file type cannot be previewed in the browser.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90"
      >
        Download file
      </a>
    </div>
  );
}
