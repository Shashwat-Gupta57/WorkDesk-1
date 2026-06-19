"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, History, FolderInput, Trash2, Pencil } from "lucide-react";
import type { ArtifactSummary } from "@/modules/archive/types";
import { MoveModal } from "./move-modal";

interface Props {
  artifact: ArtifactSummary;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: () => void;
  onRename?: () => void;
  onDelete: () => void;
}

export function ArtifactContextMenu({ artifact, x, y, onClose, onOpen, onRename, onDelete }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (moveOpen) {
    return (
      <MoveModal
        artifactId={artifact.id}
        currentSetId={artifact.setId ?? null}
        artifactTitle={artifact.title}
        onClose={() => { setMoveOpen(false); onClose(); }}
        onMoved={onClose}
      />
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-44 bg-surface-elevated border border-border-default rounded-md shadow-lg overflow-hidden py-1"
      style={{ top: y, left: x }}
    >
      <button
        className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-text-primary hover:bg-primary hover:text-on-primary transition-colors"
        onClick={() => { onOpen(); onClose(); }}
      >
        <ExternalLink size={13} /> Open
      </button>
      {onRename && (
        <button
          className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-container-high hover:text-text-primary transition-colors"
          onClick={onRename}
        >
          <Pencil size={13} /> Rename
        </button>
      )}
      <button
        className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-container-high hover:text-text-primary transition-colors"
        onClick={() => { router.push(`/archive/${artifact.id}`); onClose(); }}
      >
        <History size={13} /> Version History
      </button>
      <button
        className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-container-high hover:text-text-primary transition-colors"
        onClick={() => setMoveOpen(true)}
      >
        <FolderInput size={13} /> Move to…
      </button>
      <div className="my-1 border-t border-border-default" />
      <button
        className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-danger hover:bg-surface-container-high transition-colors"
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={13} /> Move to Trash
      </button>
    </div>
  );
}
