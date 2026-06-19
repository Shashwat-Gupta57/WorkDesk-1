"use client";

import { useState } from "react";
import { RotateCcw, Download, GitCommitHorizontal, GitBranch } from "lucide-react";
import { Confirm } from "@/components/ui/confirm";
import { ApiError } from "@/lib/api-client";
import { getDownloadUrl, useRestoreVersion } from "@/modules/archive/hooks";
import type { VersionDetail } from "@/modules/archive/types";

export type { VersionDetail };

// ─────────────────────────────────────────────────────────────────────────────
// VSCode-style git graph — vertical branch line with commit nodes.
// Newest commit is at the top (HEAD). Each node shows hash-style v-number,
// summary, relative date, and hover actions (restore / download).
// ─────────────────────────────────────────────────────────────────────────────

function fmtRelative(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtFull(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Short pseudo-hash from version number — gives it the git commit feel
function pseudoHash(n: number): string {
  const h = (n * 0x9e3779b9 + 0x6b3a4b5c) >>> 0;
  return h.toString(16).slice(0, 7);
}

export function VersionTimeline({
  artifactId,
  versions,
  onCompare,
}: {
  artifactId: string;
  versions: VersionDetail[];
  onCompare?: (versionNumber: number) => void;
}) {
  const restore        = useRestoreVersion(artifactId);
  const [restoreTarget, setRestoreTarget] = useState<VersionDetail | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [hoveredId,     setHoveredId]     = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center" }}>
        <GitBranch size={28} style={{ color: "#30363d", margin: "0 auto 10px" }} />
        <p style={{ fontSize: 12, color: "#6e7681", fontFamily: "Inter, sans-serif" }}>No commits yet</p>
        <p style={{ fontSize: 11, color: "#484f58", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
          Commit a version to start this artifact&apos;s history.
        </p>
      </div>
    );
  }

  async function handleDownload(v: VersionDetail) {
    setDownloadError(null);
    setDownloadingId(v.id);
    try {
      const url = await getDownloadUrl(v.contentKey);
      window.location.href = url + (url.includes("?") ? "&" : "?") + "download=1";
    } catch (err) {
      setDownloadError(err instanceof ApiError ? `Download failed: ${err.message}` : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {downloadError && (
        <div style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 6, border: "1px solid #f8514944", background: "#f8514910", fontSize: 12, color: "#f85149" }}>
          {downloadError}
        </div>
      )}

      {/* Branch label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, paddingLeft: 2 }}>
        <GitBranch size={13} style={{ color: "#58a6ff" }} />
        <span style={{ fontSize: 11, color: "#58a6ff", fontWeight: 600, letterSpacing: "0.02em" }}>main</span>
        <span style={{ fontSize: 11, color: "#484f58" }}>· {versions.length} version{versions.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Graph */}
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {versions.map((v, i) => {
            const isHead     = i === 0;
            const isLast     = i === versions.length - 1;
            const isHovered  = hoveredId === v.id;
            const isCommit   = v.changeSummary !== null;
            // HEAD uses current commit/draft color; older nodes use that version's color
            const nodeColor  = isCommit ? "#3fb950" : "#58a6ff";
            const hashColor  = isHead ? nodeColor : "#6e7681";

            return (
              <li
                key={v.id}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ display: "flex", gap: 10, position: "relative" }}
              >
                {/* Column: node + line segment */}
                <div style={{ flexShrink: 0, width: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Node */}
                  <div style={{ position: "relative", zIndex: 1, paddingTop: 4 }}>
                    {isHead ? (
                      <div style={{
                        width: 13, height: 13, borderRadius: "50%",
                        background: nodeColor,
                        border: "2px solid #0d1117",
                        boxShadow: `0 0 0 3px ${nodeColor}33, 0 0 7px ${nodeColor}55`,
                      }} />
                    ) : (
                      <div style={{
                        width: 11, height: 11, borderRadius: "50%",
                        background: "#0d1117",
                        border: `2px solid ${nodeColor}`,
                        boxShadow: `0 0 0 2px ${nodeColor}22`,
                      }} />
                    )}
                  </div>
                  {/* Line segment below — only between nodes, not after the last one */}
                  {!isLast && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 12,
                      background: "#30363d",
                      marginTop: 2,
                    }} />
                  )}
                </div>

                {/* Commit body */}
                <div style={{
                  flex: 1, minWidth: 0, overflow: "hidden",
                  padding: "3px 8px 6px",
                  marginBottom: isLast ? 0 : 14,
                  borderRadius: 6,
                  border: `1px solid ${isHovered && !isHead ? "#30363d" : "transparent"}`,
                  background: isHovered && !isHead ? "#161b22" : "transparent",
                  transition: "border-color 0.15s, background 0.15s",
                }}>
                  {/* Top row: hash + type badge + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      color: hashColor, fontWeight: 600, flexShrink: 0,
                    }}>
                      {pseudoHash(v.versionNumber)}
                    </span>
                    {isHead && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                        background: `${nodeColor}22`, color: nodeColor,
                        border: `1px solid ${nodeColor}44`, textTransform: "uppercase", flexShrink: 0,
                      }}>
                        HEAD
                      </span>
                    )}
                    {isCommit && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                        background: "#3fb95015", color: "#3fb950",
                        border: "1px solid #3fb95033", textTransform: "uppercase", flexShrink: 0,
                      }}>
                        commit
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: "#484f58", marginLeft: "auto", flexShrink: 0 }} title={fmtFull(v.createdAt)}>
                      {fmtRelative(v.createdAt)}
                    </span>
                  </div>

                  {/* Summary */}
                  <p style={{
                    fontSize: 11,
                    color: isHead ? "#e6edf3" : "#8b949e",
                    fontWeight: isHead ? 500 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: 1,
                  }}>
                    {isCommit ? v.changeSummary : "Draft saved"}
                  </p>

                  {/* v-number */}
                  <span style={{ fontSize: 9, color: "#484f58" }}>v{v.versionNumber}</span>

                  {/* Hover actions — icon-only buttons to fit narrow panel */}
                  {isHovered && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:translateY(0); } }`}</style>
                      <button
                        type="button"
                        disabled={downloadingId === v.id}
                        onClick={() => handleDownload(v)}
                        title={downloadingId === v.id ? "Downloading…" : "Download"}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, borderRadius: 4,
                          border: "1px solid #30363d", background: "#21262d",
                          color: "#8b949e", cursor: "pointer", flexShrink: 0,
                          animation: "fadeIn 0.1s ease",
                        }}
                      >
                        {downloadingId === v.id ? <span style={{ fontSize: 9 }}>…</span> : <Download size={10} />}
                      </button>
                      {!isHead && onCompare && (
                        <button
                          type="button"
                          onClick={() => onCompare(v.versionNumber)}
                          title="Compare with current"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 22, height: 22, borderRadius: 4,
                            border: "1px solid #30363d", background: "#21262d",
                            color: "#8b949e", cursor: "pointer", flexShrink: 0,
                            animation: "fadeIn 0.1s ease",
                          }}
                        >
                          <GitCommitHorizontal size={10} />
                        </button>
                      )}
                      {!isHead && (
                        <button
                          type="button"
                          onClick={() => setRestoreTarget(v)}
                          title="Restore this version"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 22, height: 22, borderRadius: 4,
                            border: "1px solid #1f6feb55", background: "#1f6feb18",
                            color: "#58a6ff", cursor: "pointer", flexShrink: 0,
                            animation: "fadeIn 0.1s ease",
                          }}
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
      </ol>

      <Confirm
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title={`Restore v${restoreTarget?.versionNumber}`}
        message="Creates a new HEAD commit pointing at this version's content. Nothing is overwritten — the full history is preserved."
        confirmLabel="Restore"
        onConfirm={async () => {
          if (restoreTarget) await restore.mutateAsync(restoreTarget.versionNumber);
        }}
      />
    </div>
  );
}
