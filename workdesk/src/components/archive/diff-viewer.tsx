"use client";

import { useMemo } from "react";
import { diffLines } from "diff";
import type { VersionDetail } from "@/modules/archive/types";

// ─────────────────────────────────────────────────────────────────────────────
// DiffViewer — unified line-diff between two Tiptap JSON documents.
//
// Plain text is extracted from the Tiptap JSON node tree, then diffLines() is
// used to produce added/removed/unchanged spans.
// ─────────────────────────────────────────────────────────────────────────────

// Extract all visible text from a Tiptap JSON node.
function extractText(node: Record<string, unknown>): string {
  const type = node.type as string | undefined;

  // Leaf text node
  if (type === "text") {
    return (node.text as string) ?? "";
  }

  // Hard-break → newline
  if (type === "hardBreak") return "\n";

  const children = (node.content as Array<Record<string, unknown>>) ?? [];
  const childText = children.map(extractText).join("");

  // Block-level nodes get a trailing newline
  const blockTypes = new Set([
    "paragraph", "heading", "blockquote", "codeBlock",
    "bulletList", "orderedList", "listItem",
    "taskList", "taskItem", "horizontalRule",
  ]);

  if (type && blockTypes.has(type)) {
    return childText + "\n";
  }

  return childText;
}

function docToText(doc: Record<string, unknown> | null): string {
  if (!doc) return "";
  try {
    return extractText(doc).replace(/\n{3,}/g, "\n\n").trimEnd();
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface DiffViewerProps {
  versionA: VersionDetail;
  versionB: VersionDetail;
  contentA: Record<string, unknown> | null;
  contentB: Record<string, unknown> | null;
  loading: boolean;
}

export function DiffViewer({ versionA, versionB, contentA, contentB, loading }: DiffViewerProps) {
  const hunks = useMemo(() => {
    if (!contentA || !contentB) return null;
    const textA = docToText(contentA);
    const textB = docToText(contentB);
    return diffLines(textA, textB, { newlineIsToken: false });
  }, [contentA, contentB]);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface-container px-4 py-2 text-xs text-text-secondary">
        <span className="font-mono text-text-primary">v{versionA.versionNumber}</span>
        <span className="text-text-secondary/60">→</span>
        <span className="font-mono text-text-primary">v{versionB.versionNumber}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
          Loading versions…
        </div>
      ) : !hunks ? (
        <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
          Could not compute diff.
        </div>
      ) : hunks.every((h) => !h.added && !h.removed) ? (
        <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
          These versions have identical content.
        </div>
      ) : (
        <pre className="overflow-auto p-4 font-mono text-xs leading-5">
          {hunks.map((part, i) => (
            <span
              key={i}
              className={
                part.added
                  ? "block bg-success/10 text-success"
                  : part.removed
                  ? "block bg-danger/10 text-danger line-through decoration-danger/40"
                  : "block text-text-secondary"
              }
            >
              {(part.value ?? "").split("\n").filter((_, j, arr) => j < arr.length - 1 || (part.value ?? "").endsWith("\n") ? true : true).map((line, j) => {
                const isLast = j === (part.value ?? "").split("\n").length - 1;
                if (isLast && !(part.value ?? "").endsWith("\n")) {
                  return (
                    <span key={j} className="block">
                      {part.added ? "+ " : part.removed ? "- " : "  "}
                      {line}
                    </span>
                  );
                }
                if (line === "" && isLast) return null;
                return (
                  <span key={j} className="block">
                    {part.added ? "+ " : part.removed ? "- " : "  "}
                    {line}
                  </span>
                );
              })}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}
