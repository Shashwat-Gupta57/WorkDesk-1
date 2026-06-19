"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, FileCode2, Minus, Undo2, Redo2, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Rich-text editor for TEXT artifacts (Tiptap / ProseMirror).
//
// FRAMELESS — renders bare ProseMirror content with no wrapping border box.
// The toolbar floats above the content area. Prose styles live in globals.css.
//
// Toolbar buttons use lucide icons. All formatting commands are fully wired.
// Save / Commit buttons live in the page-level toolbar (passed via callbacks).
// ─────────────────────────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  getDoc: () => Record<string, unknown>;
}

interface RichTextEditorProps {
  initialContent: Record<string, unknown> | null;
  onSave: (doc: Record<string, unknown>, changeSummary: string | null) => Promise<void>;
  saving: boolean;
  readOnly?: boolean;
  onChange?: () => void;
  /** Called once editor is ready; parent stores the fn to trigger save from toolbar buttons. */
  onSaveDraftReady?: (fn: (summary: string | null) => Promise<void>) => void;
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  active, disabled, title, onClick, children,
}: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-[13px] transition-colors",
        active
          ? "bg-primary/20 text-primary"
          : "text-text-secondary hover:bg-surface-container-high hover:text-text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border-default shrink-0" />;
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border-default bg-surface-secondary/60 px-3 py-1.5 sticky top-0 z-10 backdrop-blur-sm">
      {/* Headings */}
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={14} />
      </ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={14} />
      </ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={14} />
      </ToolBtn>

      <Divider />

      {/* Inline marks */}
      <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={14} />
      </ToolBtn>
      <ToolBtn title="Inline code" active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={14} />
      </ToolBtn>
      <ToolBtn title="Link" active={editor.isActive("link")}
        onClick={setLink}>
        <Link2 size={14} />
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn title="Bullet list" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={14} />
      </ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={14} />
      </ToolBtn>
      <ToolBtn title="Task list" active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks size={14} />
      </ToolBtn>

      <Divider />

      {/* Block formats */}
      <ToolBtn title="Blockquote" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={14} />
      </ToolBtn>
      <ToolBtn title="Code block" active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <FileCode2 size={14} />
      </ToolBtn>
      <ToolBtn title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={14} />
      </ToolBtn>

      <Divider />

      {/* History */}
      <ToolBtn title="Undo (Ctrl+Z)" disabled={!canUndo}
        onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn title="Redo (Ctrl+Y)" disabled={!canRedo}
        onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} />
      </ToolBtn>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function RichTextEditor({
  initialContent, onSave, saving, readOnly = false, onChange, onSaveDraftReady,
}: RichTextEditorProps) {
  const isDirtyRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable: !readOnly,
    onUpdate: () => {
      isDirtyRef.current = true;
      onChange?.();
    },
  });

  // Register save fn with parent so toolbar "Save draft" and "Commit" buttons can trigger it.
  useEffect(() => {
    if (!onSaveDraftReady || !editor) return;
    onSaveDraftReady(async (summary: string | null) => {
      await onSave(editor.getJSON() as Record<string, unknown>, summary);
      isDirtyRef.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, onSave]);

  // Replace content when version changes.
  useEffect(() => {
    if (!editor) return;
    const incoming = initialContent ?? { type: "doc", content: [{ type: "paragraph" }] };
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming);
      isDirtyRef.current = false;
    }
  }, [editor, initialContent]);

  if (!editor) return null;

  return (
    <div className="flex flex-col">
      {!readOnly && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="flex-1 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px]"
      />
    </div>
  );
}

// ── Commit modal — shown by page toolbar's "Commit" button ────────────────────

export function CommitModal({
  open,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  saving: boolean;
  onConfirm: (summary: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(inputRef.current?.value.trim() ?? "");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-elevated border border-border-default rounded-lg shadow-xl p-5 w-[380px] space-y-4"
        onClick={e => e.stopPropagation()}>
        <p className="text-[14px] font-semibold text-text-primary">Commit version</p>
        <p className="text-[13px] text-text-secondary">
          Save this as a named, permanent version. Add an optional change summary.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Change summary (optional)"
            maxLength={255}
            autoFocus
            className="w-full h-9 px-3 text-[13px] bg-surface-secondary border border-border-default rounded
                       outline-none text-text-primary placeholder:text-text-secondary focus:border-primary transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel}
              className="h-8 px-3 text-[13px] border border-border-default rounded text-text-secondary hover:text-text-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 h-8 px-4 text-[13px] font-medium bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? "Committing…" : "Commit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Read-only viewer ──────────────────────────────────────────────────────────

export function RichTextViewer({ content }: { content: Record<string, unknown> | null }) {
  return (
    <RichTextEditor
      initialContent={content}
      onSave={async () => {}}
      saving={false}
      readOnly
    />
  );
}
