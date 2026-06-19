# UI Redesign — Artifact Editor & Settings Page

**Scope:** Changes made after the prompt _"make the editor and that page where we edit text files look exactly like the reference project"_
**Commit:** v0.3 + uncommitted toggle/toolbar fixes
**Date:** 2026-06-19
**Files changed:** 6

---

## 1. Artifact Editor (`src/app/(app)/archive/[id]/page.tsx`)

### Before
- Single-panel layout: top bar with breadcrumb + title input + action buttons, right sidebar with metadata, center editor in a bordered box
- "Edit info" button opened an `ArtifactDialog` modal for all metadata changes
- No version history in the left panel
- Single "Save version" button at the bottom of the editor box
- No word/char count in toolbar

### After — Three-Panel Layout

```
[200px left nav] | [36px vertical toolbar] | [flex-1 canvas] | [260px metadata]
```

#### Left panel (`w-[200px]`)
- Back button → `/archive`
- "Document" nav item (always active, highlighted blue)
- "Version History" nav item with count badge — toggles the version list below
- Expandable version history list: each entry shows version number, date, change summary, "Restore" button (owner only), "Current" badge on head version

#### Top bar (40px, `h-10`)
- Left: word count + char count (`{n} words · {n} chars`), unsaved-changes dot + "Unsaved changes" text, save state indicator (Loader2 / CheckCircle2 / error text)
- Right: version badge (`v{n} · draft` when dirty), history clock toggle button, **"Save draft"** button (disabled when clean), **"Commit"** button (blue, opens CommitModal)

#### Vertical formatting toolbar (`w-9`, between left panel and canvas)
- Only visible for TEXT artifacts when user is owner
- Full-height column with right border, scrollable
- Icons: H1 H2 H3 | Bold Italic Strike Code Link | BulletList OrderedList TaskList | Blockquote CodeBlock HorizontalRule | Undo Redo
- Groups separated by thin horizontal dividers
- `onMouseDown preventDefault` preserves ProseMirror selection before click fires — fixes heading applying to wrong block

#### Canvas (scrollable, `max-w-[740px] mx-auto px-8 py-8`)
- Large inline title `<input>` (26px semibold, transparent bg) — saves on blur/Enter
- Frameless Tiptap editor below (no border box wrapper)

#### Right metadata panel (`w-[260px]`)
- "Artifact Metadata" header
- **INFORMATION** section: Type, Visibility (inline `<select>` for owner), Owner, Created date, Modified date
- **VERSIONS (n)** section: up to 5 versions listed with restore buttons; "+N more" link opens history panel
- **TAGS** section: `TagPicker` component (inline add/remove)
- **DESCRIPTION** section: inline `<textarea>` (editable, saves on blur) for owners; read-only text for others
- **ACTIONS** section (owner only): Share button, Move to Set button, Move to Trash button (red)

#### Removed
- `ArtifactDialog` modal — all metadata is now editable inline in the right panel
- Bottom `SaveBar` inside the editor component — replaced by top toolbar buttons
- "Edit info" button — replaced by direct inline editing

#### New modals
- **CommitModal**: dialog with optional change summary input + Commit button (triggered by top toolbar Commit button)
- **Delete confirm modal**: "Move to Trash?" with cancel/confirm
- **Unsaved warning modal**: shown on navigate-away when `isDirty`, offers Keep editing / Discard

#### Save state machine
```
idle → saving → saved (resets after 2s) | error (resets after 3s)
```
- "Save draft": calls `onSave(doc, null)` — no changeSummary, saves content to server
- "Commit": opens modal, calls `onSave(doc, summary)` — saves with named changeSummary

> Both Save draft and Commit persist to the server (PUT `/api/archive/artifacts/{id}/content`). Neither is local-only. Content is visible from any browser after login.

---

## 2. Rich-Text Editor (`src/components/archive/rich-text-editor.tsx`)

### Before
- Self-contained with internal horizontal toolbar at the top
- Wrapped in a `rounded-lg border` box
- "Save version" button at the bottom inside the component
- Toolbar buttons used text symbols (H1/H2/H3 as text, `≡` for list, etc.)

### After

#### Frameless
- No border wrapper — just `EditorContent` rendered bare
- Editor fills the canvas naturally

#### Exported `EditorToolbar`
- New exported component `EditorToolbar({ editor: Editor })`
- Renders vertically: `flex-col items-center gap-0.5`
- Uses lucide-react icons for all buttons (Bold, Italic, Heading1/2/3, List, ListOrdered, ListChecks, Quote, FileCode2, Minus, Undo2, Redo2, Link2)
- Groups separated by `HDivider` (horizontal thin line)
- Parent page renders this in its own `w-9` column

#### `Btn` component
- Replaces the old `ToolBtn` — explicitly receives `editor` instance and `run: (editor) => void`
- `onMouseDown` prevents default (keeps ProseMirror selection alive)
- `onClick` executes the command **without** calling `.focus()` first — this fixes headings applying to the wrong block when the editor's focus state was being reset to position 0

#### Heading bug fix
- Old code: `editor.chain().focus().toggleHeading({ level: 1 }).run()` — `.focus()` was repositioning cursor to position 0 before the command ran, so H1 always applied to the first block regardless of where the cursor was
- New code: `editor.chain().toggleHeading({ level: 1 }).run()` — no `.focus()`, so the command operates on the actual cursor position

#### Link prompt fix
- Saves `{ from, to }` selection coordinates before `window.prompt()` steals focus
- After the prompt, restores selection then applies the link — so the link applies to the originally selected text

#### `onEditorReady` prop
- `(editor: Editor) => void` — called once when Tiptap initialises
- Parent stores the instance in `useState<Editor | null>` and passes it to `EditorToolbar`

#### `onSaveDraftReady` prop
- `(fn: (summary: string | null) => Promise<void>) => void`
- Registers a closure that captures the editor's current doc and calls `onSave`
- Parent stores this fn and calls it from the "Save draft" button (with `null`) and from CommitModal (with the summary string)

#### `CommitModal`
- New exported component
- Opens on "Commit" button click in page toolbar
- Input for optional change summary + Commit button
- Calls `onConfirm(summary)` which triggers the registered save fn

---

## 3. Settings / Profile Page (`src/app/(app)/profile/page.tsx`)

### Before
- Flat page with two sections: "Account information" and "Change password"
- No left navigation
- Used generic `<Button>`, `<Field>`, `<Input>` components

### After — Tabbed Settings Layout

```
[210px left nav] | [flex-1 content, max-w-[560px]]
```

#### Left nav
- "Settings" header
- 5 nav items with icons: Profile · Security · Appearance · Notifications · Account
- "Account" item turns red on hover
- "WorkDesk · Flex Studios" footer

#### Profile tab
- Avatar: initials circle (primary/20 bg)
- Editable: name, email (via `useUpdateProfile`)
- Read-only: role, account status (with colored dot)

#### Security tab
- Change password form (via `useChangePassword`)
- Show/hide toggles on current + new password fields
- 4-bar password strength meter with color coding (danger/warning/success)

#### Appearance tab
- Theme selector: Dark (active), System, Light (both marked "V2")
- Date format radio group with live preview (`DD/MM/YYYY` / `MM/DD/YYYY` / `YYYY-MM-DD`)
- Saves to `localStorage` key `workdesk_prefs`

#### Notifications tab
- Three toggle rows: Bulletin deadline reminders, Message sounds, Desktop notifications
- Desktop notifications row includes browser permission request button
- Saves to `localStorage` key `workdesk_notif_prefs`

#### Account tab
- Account summary bullets
- Sign out button (calls `POST /api/auth/logout` + clears auth context)
- Danger zone: admin-contact info for data deletion (no delete-account API exists)

---

## 4. Toggle Animation (`src/app/globals.css` + profile page)

### Before
- `w-10 h-5` track, `w-4 h-4` thumb at `top-0.5`
- `transition-transform duration-200` — linear slide
- OFF state had only a border with no fill — invisible on dark bg

### After

**Track** (`.toggle-track`):
- `w-11 h-6` — slightly larger for easier tap target
- `transition: background-color 200ms ease, box-shadow 200ms ease`
- ON state: soft blue glow ring via `box-shadow: 0 0 0 3px rgba(88,166,255,0.2), 0 0 10px rgba(88,166,255,0.15)`
- OFF state: `bg-surface-container` (dark fill) + border — clearly visible against dark backgrounds

**Thumb** (`.toggle-thumb`):
- `w-[18px] h-[18px]` at `top-[3px] left-[3px]`
- `transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)` — spring curve with slight overshoot and settle
- `box-shadow: 0 1px 3px rgba(0,0,0,0.35)` — subtle depth
- `:active` state: thumb stretches to `width: 22px` (squash-and-stretch on press)
- `role="switch"` + `aria-checked` added for accessibility

---

## 5. ProseMirror Prose Styles (`src/app/globals.css`)

All styles scoped to `.ProseMirror` to avoid leaking to page-level headings.

| Element | Style |
|---|---|
| `h1` | 30px, 700, margin-top 1.5em |
| `h2` | 22px, 600, margin-top 1.25em |
| `h3` | 18px, 600, margin-top 1em |
| `p` | 15px, line-height 1.75 |
| `strong` | font-weight 700 |
| `em` | italic |
| `s` | line-through, text-secondary color |
| `code` (inline) | monospace, `bg-surface-container`, blue text, border |
| `pre` + `pre code` | dark bg block, full-width, overflow-x auto |
| `blockquote` | 3px left border in primary blue, italic, text-secondary |
| `hr` | 1px border-default line |
| `ul` | disc bullets |
| `ol` | decimal numbers |
| `li` | 15px, line-height 1.75 |
| `ul[data-type="taskList"]` | no bullets, checkbox + flex row layout |
| `a` | primary color, underline |
| `::selection` | `#1f6feb44` blue highlight |
| `> * + *` | `margin-top: 0.75em` between all sibling blocks |
| Placeholder | `data-placeholder` attr, 45% opacity |

---

## 6. Database (`migrations/0014_notifications.sql`)

Migration `0014_notifications.sql` was written but had not been applied. Applied via `npm run migrate`:

```sql
CREATE TYPE notification_type AS ENUM (
  'ARTIFACT_SHARED', 'MESSAGE_RECEIVED', 'BULLETIN_POSTED', 'ARTIFACT_PUBLISHED'
);
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, is_read, created_at DESC);
```

Fixes the `GET /api/notifications 500 — relation "notifications" does not exist` error.

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/app/(app)/archive/[id]/page.tsx` | Full three-panel layout rewrite |
| `src/app/(app)/profile/page.tsx` | Full settings page rewrite (5 tabs) |
| `src/components/archive/rich-text-editor.tsx` | Frameless editor, exported vertical toolbar, heading bug fix |
| `src/app/globals.css` | ProseMirror prose styles + toggle animation CSS |
| `migrations/0014_notifications.sql` | Applied (was pending) |
