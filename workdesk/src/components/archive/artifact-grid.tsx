"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, FileImage, FileType, Film, Music, Archive, File,
  Paperclip, MoreHorizontal, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateArtifact, useDeleteArtifact } from "@/modules/archive/hooks";
import type { ArtifactSummary } from "@/modules/archive/types";
import { ArtifactContextMenu } from "./artifact-context-menu";

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactGrid — grid + list view for a set's artifacts.
//
// Features:
//   - Grid: colored banner header for file types, icon for text
//   - List: table with visibility badge
//   - Inline renaming (double-click title)
//   - Right-click context menu
//   - Loading skeletons
//   - Click to select, double-click to open
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

interface ContextMenuState { artifact: ArtifactSummary; x: number; y: number }

interface Props {
  artifacts: ArtifactSummary[];
  isLoading: boolean;
  selectedArtifactId: string | null;
  onSelect: (id: string) => void;
  view: ViewMode;
  setId: string | null;
  onNewArtifact?: () => void;
}

export function ArtifactGrid({
  artifacts, isLoading, selectedArtifactId, onSelect, view, setId, onNewArtifact,
}: Props) {
  const router = useRouter();
  const updateArtifact = useUpdateArtifact();
  const deleteArtifact = useDeleteArtifact();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  function startRename(a: ArtifactSummary) {
    setRenamingId(a.id);
    setRenameVal(a.title);
  }

  async function commitRename() {
    if (!renamingId) return;
    const title = renameVal.trim();
    if (title) await updateArtifact.mutateAsync({ id: renamingId, payload: { title } });
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    await deleteArtifact.mutateAsync(id);
  }

  function handleContextMenu(e: React.MouseEvent, a: ArtifactSummary) {
    e.preventDefault();
    setContextMenu({ artifact: a, x: e.clientX, y: e.clientY });
  }

  if (isLoading) return <LoadingSkeletons view={view} />;

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16 px-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
          <FileText size={20} className="text-text-secondary" />
        </div>
        <p className="text-[14px] font-medium text-text-primary">No artifacts yet</p>
        <p className="text-[12px] text-text-secondary">
          {setId ? "This Set is empty." : "No artifacts found."}
        </p>
        {onNewArtifact && (
          <button
            onClick={onNewArtifact}
            className="mt-1 h-8 px-4 text-[13px] bg-primary text-on-primary rounded-md hover:opacity-90 transition-opacity"
          >
            New Artifact
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {view === "grid" ? (
          <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {artifacts.map(a => (
              <GridCard
                key={a.id}
                artifact={a}
                selected={selectedArtifactId === a.id}
                renaming={renamingId === a.id}
                renameVal={renameVal}
                renameInputRef={renamingId === a.id ? renameInputRef : undefined}
                onClick={() => onSelect(a.id)}
                onDoubleClick={() => router.push(`/archive/${a.id}`)}
                onContextMenu={e => handleContextMenu(e, a)}
                onRenameChange={setRenameVal}
                onRenameCommit={commitRename}
                onRenameCancel={() => setRenamingId(null)}
              />
            ))}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-default text-text-secondary">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Visibility</th>
                <th className="px-4 py-2.5 text-left font-medium">Modified</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {artifacts.map(a => (
                <ListRow
                  key={a.id}
                  artifact={a}
                  selected={selectedArtifactId === a.id}
                  renaming={renamingId === a.id}
                  renameVal={renameVal}
                  renameInputRef={renamingId === a.id ? renameInputRef : undefined}
                  onClick={() => onSelect(a.id)}
                  onDoubleClick={() => router.push(`/archive/${a.id}`)}
                  onContextMenu={e => handleContextMenu(e, a)}
                  onRenameChange={setRenameVal}
                  onRenameCommit={commitRename}
                  onRenameCancel={() => setRenamingId(null)}
                  onRename={() => startRename(a)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar — always at the bottom of the panel */}
      <div className="shrink-0 border-t border-border-default bg-surface-secondary px-4 py-1.5 text-[11px] text-text-secondary">
        {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
        {selectedArtifactId && " · 1 selected"}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ArtifactContextMenu
          artifact={contextMenu.artifact}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={() => router.push(`/archive/${contextMenu.artifact.id}`)}
          onRename={() => { startRename(contextMenu.artifact); setContextMenu(null); }}
          onDelete={() => { handleDelete(contextMenu.artifact.id); setContextMenu(null); }}
        />
      )}
    </div>
  );
}

// ── GridCard ──────────────────────────────────────────────────────────────────

function GridCard({
  artifact, selected, renaming, renameVal, renameInputRef,
  onClick, onDoubleClick, onContextMenu,
  onRenameChange, onRenameCommit, onRenameCancel,
}: {
  artifact: ArtifactSummary;
  selected: boolean;
  renaming: boolean;
  renameVal: string;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}) {
  const isFile = artifact.type !== "TEXT";

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative flex flex-col rounded-lg border cursor-pointer transition-all overflow-hidden",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border-default bg-surface-container hover:border-outline-variant hover:bg-surface-container-high"
      )}
    >
      {/* Banner / icon area */}
      {isFile ? (
        <div className={cn("h-[72px] flex items-center justify-center shrink-0", bannerClass(artifact.type))}>
          <FileTypeIcon type={artifact.type} size={26} />
        </div>
      ) : (
        <div className="h-[72px] flex items-center justify-center shrink-0 bg-surface-container-high relative">
          <FileText size={26} className="text-text-secondary" />
          {/* Attachment badge */}
          {"hasAttachment" in artifact && (artifact as ArtifactSummary & { hasAttachment?: boolean }).hasAttachment && (
            <span className="absolute top-2 right-2">
              <Paperclip size={10} className="text-text-secondary" />
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <div className="px-2 py-2 flex-1">
        {renaming ? (
          <input
            ref={renameInputRef as React.RefObject<HTMLInputElement>}
            value={renameVal}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.stopPropagation(); onRenameCommit(); }
              if (e.key === "Escape") { e.stopPropagation(); onRenameCancel(); }
            }}
            onBlur={onRenameCommit}
            onClick={e => e.stopPropagation()}
            className="w-full h-5 px-1 text-[11px] bg-surface-elevated border border-primary rounded outline-none text-text-primary"
          />
        ) : (
          <p className="text-[11px] font-medium text-text-primary truncate leading-tight">{artifact.title}</p>
        )}
        <p className="text-[10px] text-text-secondary mt-0.5 uppercase">{artifact.type}</p>
      </div>
    </div>
  );
}

// ── ListRow ───────────────────────────────────────────────────────────────────

function ListRow({
  artifact, selected, renaming, renameVal, renameInputRef,
  onClick, onDoubleClick, onContextMenu,
  onRenameChange, onRenameCommit, onRenameCancel, onRename,
}: {
  artifact: ArtifactSummary;
  selected: boolean;
  renaming: boolean;
  renameVal: string;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRename: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group border-b border-border-default cursor-pointer transition-colors",
        selected ? "bg-primary/5" : "hover:bg-surface-container-high"
      )}
    >
      <td className="px-4 py-2.5 max-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileTypeIcon type={artifact.type} size={14} />
          {renaming ? (
            <input
              ref={renameInputRef as React.RefObject<HTMLInputElement>}
              value={renameVal}
              onChange={e => onRenameChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.stopPropagation(); onRenameCommit(); }
                if (e.key === "Escape") { e.stopPropagation(); onRenameCancel(); }
              }}
              onBlur={onRenameCommit}
              onClick={e => e.stopPropagation()}
              className="flex-1 h-5 px-1 text-[12px] bg-surface-elevated border border-primary rounded outline-none text-text-primary"
            />
          ) : (
            <span className="truncate text-text-primary font-medium">{artifact.title}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-text-secondary uppercase text-[11px]">{artifact.type}</td>
      <td className="px-4 py-2.5">
        <VisibilityBadge vis={artifact.visibility} />
      </td>
      <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
        {new Date(artifact.updatedAt).toLocaleDateString()}
      </td>
      <td className="px-2 py-2.5">
        <button
          onClick={e => { e.stopPropagation(); onRename(); }}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container text-text-secondary hover:text-text-primary transition-all"
        >
          <MoreHorizontal size={13} />
        </button>
      </td>
    </tr>
  );
}

// ── Loading skeletons ──────────────────────────────────────────────────────────

function LoadingSkeletons({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="flex-1">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-default">
            <div className="w-4 h-4 rounded bg-surface-container animate-pulse" />
            <div className="flex-1 h-3 rounded bg-surface-container animate-pulse" style={{ width: `${50 + (i % 4) * 10}%` }} />
            <div className="w-12 h-3 rounded bg-surface-container animate-pulse" />
            <div className="w-16 h-3 rounded bg-surface-container animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border-default overflow-hidden bg-surface-container">
          <div className="h-[72px] bg-surface-container-high animate-pulse" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 rounded bg-surface-container-high animate-pulse w-3/4" />
            <div className="h-2 rounded bg-surface-container-high animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bannerClass(type: string): string {
  switch (type) {
    case "PDF":   return "bg-[#ffba42]/20";
    case "IMAGE": return "bg-[#bc8cff]/20";
    case "DOCX":  return "bg-[#3FB950]/20";
    case "PPTX":  return "bg-[#f78166]/20";
    case "ZIP":   return "bg-[#8b949e]/20";
    default:      return "bg-surface-container-high";
  }
}

function FileTypeIcon({ type, size }: { type: string; size: number }) {
  const cls = "text-text-secondary shrink-0";
  switch (type) {
    case "PDF":   return <FileType size={size} className="text-[#ffba42] shrink-0" />;
    case "IMAGE": return <FileImage size={size} className="text-[#bc8cff] shrink-0" />;
    case "DOCX":  return <FileText size={size} className="text-[#3FB950] shrink-0" />;
    case "PPTX":  return <File size={size} className="text-[#f78166] shrink-0" />;
    case "ZIP":   return <Archive size={size} className={cls} />;
    case "VIDEO": return <Film size={size} className={cls} />;
    case "AUDIO": return <Music size={size} className={cls} />;
    default:      return <FileText size={size} className="text-primary shrink-0" />;
  }
}

function VisibilityBadge({ vis }: { vis: string }) {
  const map: Record<string, string> = {
    PRIVATE: "text-text-secondary bg-surface-container-high",
    SHARED: "text-warning bg-warning/10",
    PUBLIC: "text-success bg-success/10",
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium capitalize", map[vis] ?? map.PRIVATE)}>
      {vis.toLowerCase()}
    </span>
  );
}

// Re-export Loader2 for use in parent if needed
export { Loader2 };
