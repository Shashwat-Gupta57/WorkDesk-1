"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateArtifact } from "@/modules/archive/hooks";

interface Props {
  artifactId: string;
  tags: string[];
}

export function TagPicker({ artifactId, tags }: Props) {
  const updateArtifact = useUpdateArtifact();
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function addTag() {
    const val = input.trim().toLowerCase();
    if (!val) { setInput(""); return; }
    if (tags.includes(val)) { setInput(""); return; }
    await updateArtifact.mutateAsync({ id: artifactId, payload: { tags: [...tags, val] } });
    setInput("");
  }

  async function removeTag(name: string) {
    await updateArtifact.mutateAsync({ id: artifactId, payload: { tags: tags.filter(t => t !== name) } });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20"
          >
            <Tag size={9} />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-danger transition-colors ml-0.5"
            >
              <X size={9} />
            </button>
          </span>
        ))}

        {editing ? (
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
              if (e.key === "Escape") { setEditing(false); setInput(""); }
            }}
            onBlur={() => { addTag(); setEditing(false); }}
            placeholder="tag name…"
            className="h-5 w-24 px-1.5 text-[11px] bg-surface-elevated border border-primary rounded outline-none text-text-primary placeholder:text-text-secondary"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors",
              "border border-dashed border-border-default text-text-secondary hover:border-primary hover:text-primary"
            )}
          >
            <Plus size={9} /> Add tag
          </button>
        )}
      </div>
    </div>
  );
}
