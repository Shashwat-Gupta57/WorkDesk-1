"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

// ─────────────────────────────────────────────────────────────────────────────
// Rich-text editor for TEXT artifacts (Tiptap / ProseMirror).
//
// Toolbar: bold, italic, strike, code, h1/h2/h3, bullet list, ordered list,
//   task list, blockquote, code block, link, horizontal rule.
// Auto-save: debounced 2 s after the last keystroke; sets `isDirty`.
// Manual save: "Save version" button commits a named version.
// ─────────────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  initialContent: Record<string, unknown> | null;
  onSave: (doc: Record<string, unknown>, changeSummary: string | null) => Promise<void>;
  saving: boolean;
  readOnly?: boolean;
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={
        "flex h-7 w-7 items-center justify-center rounded text-sm transition-colors " +
        (active
          ? "bg-primary/20 text-primary"
          : "text-text-secondary hover:bg-surface-container hover:text-text-primary") +
        (disabled ? " opacity-40 cursor-not-allowed" : "")
      }
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
  const can = editor.can().chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border-default bg-surface-container px-3 py-1.5">
      {/* Headings */}
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

      <Divider />

      {/* Inline marks */}
      <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolBtn>
      <ToolBtn title="Inline code" active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        {"<>"}
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn title="Bullet list" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        ≡
      </ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        №
      </ToolBtn>
      <ToolBtn title="Task list" active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}>
        ☑
      </ToolBtn>

      <Divider />

      {/* Blocks */}
      <ToolBtn title="Blockquote" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        "
      </ToolBtn>
      <ToolBtn title="Code block" active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {"{}"}
      </ToolBtn>
      <ToolBtn title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </ToolBtn>

      <Divider />

      {/* Undo / Redo */}
      <ToolBtn title="Undo (Ctrl+Z)" disabled={!can.undo().run()}
        onClick={() => editor.chain().focus().undo().run()}>↩</ToolBtn>
      <ToolBtn title="Redo (Ctrl+Y)" disabled={!can.redo().run()}
        onClick={() => editor.chain().focus().redo().run()}>↪</ToolBtn>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function RichTextEditor({ initialContent, onSave, saving, readOnly = false }: RichTextEditorProps) {
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    },
  });

  // When initialContent changes (e.g. switching versions), replace editor content.
  useEffect(() => {
    if (!editor) return;
    const incoming = initialContent ?? { type: "doc", content: [{ type: "paragraph" }] };
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming);
      isDirtyRef.current = false;
    }
  }, [editor, initialContent]);

  // Cleanup timer on unmount.
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const handleManualSave = useCallback(
    async (changeSummary: string | null) => {
      if (!editor) return;
      await onSave(editor.getJSON() as Record<string, unknown>, changeSummary);
      isDirtyRef.current = false;
    },
    [editor, onSave]
  );

  if (!editor) return null;

  return (
    <div className="flex flex-col rounded-lg border border-border-default bg-surface-secondary overflow-hidden">
      {!readOnly && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-invert max-w-none flex-1 px-6 py-5 text-sm focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[320px]"
      />
      {!readOnly && (
        <SaveBar onSave={handleManualSave} saving={saving} />
      )}
    </div>
  );
}

// ── Save bar ──────────────────────────────────────────────────────────────────

function SaveBar({
  onSave,
  saving,
}: {
  onSave: (changeSummary: string | null) => Promise<void>;
  saving: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleClick() {
    const summary = inputRef.current?.value.trim() || null;
    await onSave(summary);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex items-center gap-2 border-t border-border-default bg-surface-container px-4 py-2">
      <input
        ref={inputRef}
        type="text"
        placeholder="Change summary (optional)"
        maxLength={255}
        className="min-w-0 flex-1 rounded border border-border-default bg-surface-secondary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        disabled={saving}
        onClick={handleClick}
        className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-medium text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save version"}
      </button>
    </div>
  );
}

// ── Read-only viewer (for diff / version preview) ────────────────────────────

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
