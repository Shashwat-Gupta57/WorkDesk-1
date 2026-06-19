"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateArtifact, useUploadFile } from "@/modules/archive/hooks";
import { ArtifactType } from "@/lib/enums";

interface Props {
  setId: string | null;
  onClose: () => void;
}

function mimeToArtifactType(file: File): ArtifactType {
  if (file.type.startsWith("image/")) return ArtifactType.IMAGE;
  if (file.type === "application/pdf") return ArtifactType.PDF;
  if (file.type.includes("presentation") || file.name.endsWith(".pptx") || file.name.endsWith(".ppt")) return ArtifactType.PPTX;
  if (file.type.includes("word") || file.name.endsWith(".docx") || file.name.endsWith(".doc")) return ArtifactType.DOCX;
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed") return ArtifactType.ZIP;
  return ArtifactType.TEXT;
}

export function NewArtifactModal({ setId, onClose }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createArtifact = useCreateArtifact();
  const uploadFile = useUploadFile();

  const [mode, setMode] = useState<"text" | "file" | null>(null);
  const [title, setTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = createArtifact.isPending || uploadFile.isPending;

  async function handleCreateText() {
    if (!title.trim()) return;
    setError(null);
    try {
      const artifact = await createArtifact.mutateAsync({
        title: title.trim(),
        type: ArtifactType.TEXT,
        setId: setId ?? undefined,
      });
      onClose();
      router.push(`/archive/${artifact.id}`);
    } catch {
      setError("Failed to create artifact.");
    }
  }

  async function handleCreateFile(file: File) {
    setError(null);
    const fileTitle = title.trim() || file.name.replace(/\.[^/.]+$/, "");
    const fileType = mimeToArtifactType(file);

    try {
      const artifact = await createArtifact.mutateAsync({
        title: fileTitle,
        type: fileType,
        setId: setId ?? undefined,
      });
      await uploadFile.mutateAsync({ artifactId: artifact.id, file });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-elevated border border-border-default rounded-lg shadow-xl w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <span className="text-[14px] font-semibold text-text-primary">New Artifact</span>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Mode picker */}
        {!mode && (
          <div className="p-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("text")}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border-default hover:border-primary hover:bg-primary/5 transition-all text-left"
            >
              <FileText size={28} className="text-primary" />
              <div>
                <p className="text-[13px] font-semibold text-text-primary">Text document</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Write, edit, version your content</p>
              </div>
            </button>
            <button
              onClick={() => setMode("file")}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border-default hover:border-primary hover:bg-primary/5 transition-all text-left"
            >
              <Upload size={28} className="text-primary" />
              <div>
                <p className="text-[13px] font-semibold text-text-primary">Upload file</p>
                <p className="text-[11px] text-text-secondary mt-0.5">PDF, image, video, audio, ZIP…</p>
              </div>
            </button>
          </div>
        )}

        {/* Text form */}
        {mode === "text" && (
          <div className="p-5 space-y-4">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateText(); if (e.key === "Escape") onClose(); }}
              placeholder="Artifact name"
              className="w-full h-9 px-3 text-[13px] bg-surface-secondary border border-border-default rounded outline-none text-text-primary placeholder:text-text-secondary focus:border-primary transition-colors"
            />
            {error && <p className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setMode(null)} className="h-8 px-3 text-[13px] border border-border-default rounded text-text-secondary hover:text-text-primary transition-colors">Back</button>
              <button
                onClick={handleCreateText}
                disabled={!title.trim() || busy}
                className="h-8 px-4 text-[13px] bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        )}

        {/* File upload form */}
        {mode === "file" && (
          <div className="p-5 space-y-4">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Name (optional — defaults to filename)"
              className="w-full h-9 px-3 text-[13px] bg-surface-secondary border border-border-default rounded outline-none text-text-primary placeholder:text-text-secondary focus:border-primary transition-colors"
            />

            {!selectedFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/10" : "border-border-default hover:border-text-secondary hover:bg-surface-container-high"
                )}
              >
                <Upload size={22} className="text-text-secondary" />
                <p className="text-[12px] text-text-secondary">Drop file here or <span className="text-primary">click to browse</span></p>
                <p className="text-[10px] text-text-secondary">PDF, images, video, audio, DOCX, ZIP · max 50 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.mp3,.wav,.doc,.docx,.ppt,.pptx,.zip,.txt,.md"
                  onChange={e => handleFiles(e.target.files)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-high border border-border-default">
                <Upload size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-text-primary truncate">{selectedFile.name}</p>
                  <p className="text-[11px] text-text-secondary">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setSelectedFile(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X size={13} />
                </button>
              </div>
            )}

            {error && <p className="text-[12px] text-danger">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setMode(null); setSelectedFile(null); setError(null); }} className="h-8 px-3 text-[13px] border border-border-default rounded text-text-secondary hover:text-text-primary transition-colors">Back</button>
              <button
                onClick={() => selectedFile && handleCreateFile(selectedFile)}
                disabled={!selectedFile || busy}
                className="h-8 px-4 text-[13px] bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Upload & Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
