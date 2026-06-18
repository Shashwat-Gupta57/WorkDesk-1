# WorkDesk V2 — Implementation Plan

> Derived from `PRD v2 d1.txt` (Collaboration & Workflow) and `PRD v2 d2.txt` (Library &
> Knowledge Distribution), reconciled against the current codebase state (all V1 + V1.1
> complete) and the architecture principles in `CLAUDE.md` / `mindmap.md`.

---

## Decisions (locked)

1. **Reference-based sharing is the load-bearing constraint.** Artifacts are never copied.
   Sharing = a pointer row (`ArtifactShare`) that grants read access. The original stays in the
   owner's archive untouched.
2. **Visibility gates everything.** `PRIVATE` stays owner-only. `SHARED` enables per-user
   grants. `PUBLIC` enables library publishing. No read path bypasses these.
3. **Messaging is internal only.** No external email delivery. Conversations between users,
   with the ability to attach artifact references (not file copies).
4. **Bulletin and Countdown are org-wide.** Any member can post. Admins can pin/delete.
   Countdowns carry assignments and a completion workflow.
5. **Library = references into the archive.** A LibrarySection groups published artifacts;
   publishing = setting `visibility=PUBLIC` + adding a `LibraryArtifact` join row. The personal
   archive is never touched by section deletion.
6. **Graph view is read-only.** Relationships between artifacts/sets are created explicitly.
   The graph visualizes them. No drag-to-relate in V2 (V3+).
7. **Notifications are in-app only in V2.** Push delivery (PWA push) is already wired (manifest
   exists) but triggers require a notification store first. Email delivery is V4.
8. **No real-time (WebSocket) in V2.** Feed, notifications, and bulletin are polled (TanStack
   Query refetchInterval). Socket.io is a V3 addition when live comments land.
9. **Activity feed built in V1 is extended, not rebuilt.** New V2 event types
   (`ARTIFACT_SHARED`, `BULLETIN_POSTED`, `COUNTDOWN_ASSIGNED`, `COUNTDOWN_COMPLETED`) are
   added to the existing `activity_events` table and `activityService`.

---

## d1 vs d2 reconciliation

| Area | d1 (Collab & Workflow) | d2 (Library & Knowledge) | V2 decision |
|---|---|---|---|
| Internal messaging | Core feature | — | **In** |
| Artifact sharing by reference | Core feature | Referenced by library | **In** |
| Bulletin + Announcements | Core feature | — | **In** |
| Countdown + completion workflow | Core feature | — | **In** |
| Activity feed (V1 extension) | Mentions publishing/deadline events | — | **Extended** |
| Notifications (in-app) | Full trigger list | Updates on section delete | **In (in-app only)** |
| Library sections + publishing | Implied (visibility=PUBLIC) | Core feature | **In** |
| Artifact relationships | — | Belongs To / Related / Derived / Replaces | **In** |
| Graph view | — | Nodes + edges + search/zoom/filter | **In (read-only)** |
| Knowledge Packs | — | Curated onboarding collections | **In (simple V2 form)** |
| Library subscriptions + share links | — | Follow sections, internal/public links | **In** |
| Push notifications | In-app + push | — | **Deferred to V3** |
| Real-time / WebSocket | Implied | — | **Deferred to V3** |

---

## Current state (entering V2)

All V1 slices and V1.1 are complete:
- Auth, archive (sets/artifacts/versions), storage (R2 + local-fs), search (FTS), trash,
  stars, account management, admin tools, activity feed, dashboard, PWA.
- Rich-text editor (Tiptap) for TEXT artifacts, version diff, FTS content indexing.
- Schema: `users`, `sets`, `artifacts`, `versions`, `stars`, `audit_logs`,
  `activity_events`, `password_reset_tokens`, `storage_quotas`.

**What V2 must add to the schema:**
- `artifact_shares` — per-user share grants (the SHARED read path)
- `messages` + `conversations` + `conversation_members` — internal messaging
- `bulletins` — announcements and countdown posts
- `countdown_assignments` — per-user targets on a countdown bulletin
- `library_sections` — named groupings in the public library
- `library_artifacts` — join: section ↔ artifact (reference only)
- `library_subscriptions` — user follows a section
- `artifact_relationships` — typed directed edges between artifacts
- `notifications` — in-app notification store

---

## Schema additions (migration 0008+)

```sql
-- Sharing
CREATE TABLE artifact_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grantee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, grantee_id)
);

-- Messaging
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            TEXT NOT NULL CHECK (char_length(body) <= 4000),
  artifact_ref_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ
);

-- Bulletin
CREATE TYPE bulletin_type AS ENUM ('ANNOUNCEMENT', 'COUNTDOWN');
CREATE TYPE countdown_status AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'INCOMPLETE');
CREATE TABLE bulletins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type        bulletin_type NOT NULL,
  title       TEXT NOT NULL CHECK (char_length(title) <= 255),
  body        TEXT CHECK (char_length(body) <= 2000),
  due_at      TIMESTAMPTZ,           -- countdowns only
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE countdown_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id UUID NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      countdown_status NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  UNIQUE (bulletin_id, user_id)
);

-- Library
CREATE TABLE library_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(name) <= 100),
  description TEXT CHECK (char_length(description) <= 500),
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE library_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  UUID NOT NULL REFERENCES library_sections(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  added_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, artifact_id)
);
CREATE TABLE library_subscriptions (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES library_sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id)
);

-- Relationships
CREATE TYPE relationship_type AS ENUM ('BELONGS_TO', 'RELATED_TO', 'DERIVED_FROM', 'REPLACES');
CREATE TABLE artifact_relationships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id      UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  to_id        UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  type         relationship_type NOT NULL,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id, type)
);

-- Notifications
CREATE TYPE notification_type AS ENUM (
  'ARTIFACT_SHARED', 'BULLETIN_POSTED', 'COUNTDOWN_ASSIGNED',
  'COUNTDOWN_REMINDER', 'COUNTDOWN_COMPLETED', 'LIBRARY_SECTION_DELETED',
  'NEW_MESSAGE'
);
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read, created_at DESC);
```

---

## Execution slices

Each slice ships backend + wired frontend. Order follows dependency flow and value delivery.

---

### Slice 1 — Sharing & SHARED read path

**The prerequisite for everything that references other users' artifacts.**

**Backend**
- Migration: `artifact_shares` table (above). Add `SHARED_ARTIFACT` to `ArtifactType`...
  actually, add `ARTIFACT_SHARED` to `AuditAction` enum. Extend `Visibility` handling:
  `PRIVATE` stays owner-only; `SHARED` unlocks per-grant reads.
- `shareService.ts`:
  - `shareArtifact(ownerId, artifactId, granteeEmail)` — resolves grantee by email, inserts
    `artifact_shares` row, emits `ARTIFACT_SHARED` activity + notification.
  - `revokeShare(ownerId, artifactId, granteeId)` — deletes the row.
  - `listSharedWithMe(userId)` — artifacts shared to this user via `artifact_shares`.
  - `listSharedByMe(ownerId)` — artifacts this user has shared out.
- Extend `archiveService.getArtifactDetails` to accept shared reads: the existing
  `ownerId` filter is extended with an OR on `artifact_shares.grantee_id = userId`.
- Routes: `POST /api/archive/artifacts/[id]/share` (grant), `DELETE` (revoke),
  `GET /api/archive/shared` (list shared-with-me).
- Visibility toggle on artifact now actually gates `SHARED` — set visibility=SHARED to
  enable sharing, PRIVATE disables all shares.

**Frontend**
- "Share" button in artifact workspace (owner only). Modal: enter email → sends share.
  Lists current grantees with revoke option.
- New "Shared with me" section in Archive sidebar.
- Artifact workspace for shared artifacts: read-only view, no commit/edit (non-owner).
- Properties panel shows "Shared by [name]" for shared artifacts.

**Migration:** `0008_sharing.sql`

---

### Slice 2 — Bulletin + Countdown

**Org-wide notice board. Most visible V2 feature.**

**Backend**
- Migration: `bulletins` + `countdown_assignments` + `bulletin_type` + `countdown_status`
  enums (above).
- `bulletinService.ts`:
  - `createBulletin(authorId, payload)` — ANNOUNCEMENT or COUNTDOWN.
    Countdowns require `dueAt` + `assignees` (user IDs). Inserts bulletin + assignments in
    a transaction. Emits `BULLETIN_POSTED` activity + `COUNTDOWN_ASSIGNED` notifications.
  - `listBulletins(userId, filters?)` — paginated, newest first. Pinned float to top.
  - `getBulletin(id)` — detail with assignments + completion states.
  - `markComplete(userId, bulletinId)` — sets `countdown_assignments.status=COMPLETED`,
    records `completed_at`. Emits `COUNTDOWN_COMPLETED` activity.
  - `deleteBulletin(actorId, bulletinId)` — author or admin only.
  - `pinBulletin(adminId, bulletinId)` — admin only, toggles `pinned`.
  - Cron-like check (run on listBulletins): set overdue assignments where
    `due_at < now() AND status = PENDING`.
- Routes: `GET/POST /api/bulletin` (list, create), `GET/PUT/DELETE /api/bulletin/[id]`,
  `POST /api/bulletin/[id]/complete`.

**Frontend**
- New **Bulletin** nav item in sidebar (currently shown in mindmap as planned).
- Bulletin board page: pinned row at top, feed of announcements + countdowns below.
- Create bulletin dialog: type selector (Announcement / Countdown), body, due date (for
  countdown), assignee picker (member list search).
- Countdown row: progress bar (N/M completed), user's own status badge, "Mark complete"
  button. Overdue shown in red.
- Admin controls: pin/unpin, delete.

**Migration:** `0009_bulletin.sql`

---

### Slice 3 — Internal Messaging

**User-to-user conversations with artifact references.**

**Backend**
- Migration: `conversations` + `conversation_members` + `messages` (above).
- `messagingService.ts`:
  - `getOrCreateConversation(userA, userB)` — finds existing 1:1 or creates new one.
    (V2 = 1:1 only; group chats are V3.)
  - `sendMessage(senderId, conversationId, body, artifactRefId?)` — validates sender is a
    member, inserts message, bumps `conversations.updated_at`, emits `NEW_MESSAGE`
    notification to the other party.
  - `listConversations(userId)` — conversations the user is part of, ordered by
    `updated_at` desc, with last message preview + unread count.
  - `listMessages(userId, conversationId, cursor?)` — cursor-paginated, newest first.
    Validates membership.
  - `markRead(userId, conversationId)` — clears unread for this user (tracked via a
    `last_read_at` column on `conversation_members`).
  - `searchConversations(userId, query)` — message body FTS.
- Routes: `GET/POST /api/messaging/conversations`, `GET /api/messaging/conversations/[id]`,
  `POST /api/messaging/conversations/[id]/messages`,
  `GET /api/messaging/conversations/[id]/messages`.

**Frontend**
- New **Messages** nav item with unread badge.
- Conversation list panel (left). Click → opens message thread (right).
- Message composer: text input + optional artifact-attach (opens artifact picker,
  inserts a reference card in the message body).
- Attached artifact cards: show title + type icon; click → opens artifact workspace.
- New conversation: "Compose" button → search user by name/email.
- Unread count in sidebar badge + notification dot.

**Migration:** `0010_messaging.sql`

---

### Slice 4 — Library & Publishing

**Makes artifacts discoverable org-wide without duplication.**

**Backend**
- Migration: `library_sections` + `library_artifacts` + `library_subscriptions` (above).
- Extend `artifacts`: confirm `visibility` enum already supports `PUBLIC`.
- `libraryService.ts`:
  - `createSection(userId, name, description?)`.
  - `deleteSection(userId, sectionId)` — removes the section + all `library_artifacts`
    join rows. Sends `LIBRARY_SECTION_DELETED` notification to all artifact owners
    whose artifacts were in that section. Personal archives are untouched.
  - `publishArtifact(ownerId, artifactId, sectionId)` — sets `visibility=PUBLIC` on the
    artifact, inserts `library_artifacts` row.
  - `unpublishArtifact(ownerId, artifactId, sectionId)` — removes `library_artifacts` row.
    If artifact has no remaining section memberships, reverts `visibility=PRIVATE`.
  - `listSections(userId?)` — all sections (public listing).
  - `getSectionArtifacts(sectionId, userId?)` — artifacts in section visible to caller.
  - `subscribeSection(userId, sectionId)` / `unsubscribeSection`.
  - `getSubscriptions(userId)` — sections the user follows.
  - Public read path: `getArtifactDetails` extended — if `visibility=PUBLIC`, allow reads
    without ownership or share grant (reference-based, read-only to non-owners).
- Routes: `GET/POST /api/library/sections`, `GET/DELETE /api/library/sections/[id]`,
  `POST/DELETE /api/library/sections/[id]/artifacts`,
  `POST/DELETE /api/library/sections/[id]/subscribe`.

**Frontend**
- New **Library** nav item.
- Library page: section cards grid. Each section shows artifact count + subscriber count.
- Section detail: artifact list (read-only for non-owners, full viewer for owners).
- "Publish to Library" button in artifact workspace → section picker.
- Subscribe/unsubscribe button on each section.
- "Published" badge on artifacts in the Archive explorer (when `visibility=PUBLIC`).
- Subscriptions panel in sidebar or profile page.
- Section deletion warning modal listing affected artifact owners.

**Migration:** `0011_library.sql`

---

### Slice 5 — Relationships + Graph View

**Explicit artifact connections, visualized as an interactive graph.**

**Backend**
- Migration: `artifact_relationships` + `relationship_type` enum (above).
- `relationshipService.ts`:
  - `createRelationship(userId, fromId, toId, type)` — validates both artifacts are
    accessible (owned or shared-with-me or public). Prevents self-loops and duplicates.
  - `deleteRelationship(userId, relationshipId)` — creator or artifact owner only.
  - `getRelationships(userId, artifactId)` — all edges where `from_id` or `to_id` is
    the artifact.
  - `getGraphData(userId)` — all artifacts the user can access + all relationship edges
    between them. Returns `{ nodes: [...], edges: [...] }` for the graph renderer.
- Routes: `POST/DELETE /api/archive/relationships`,
  `GET /api/archive/artifacts/[id]/relationships`,
  `GET /api/archive/graph`.

**Frontend**
- "Relationships" section in artifact workspace properties sidebar: list of edges with
  relationship type labels, add/remove controls.
- New **Graph** nav item (or accessible from the Archive header).
- Graph view page powered by **react-flow** (installed fresh in this slice).
  - Nodes: sets (folder shape) and artifacts (file shape), colored by type.
  - Edges: typed, labeled with relationship type.
  - Controls: zoom/pan, minimap, search (highlight matching nodes), filter by type/set.
  - Clustering: group artifacts by their parent set.
  - Click node → opens artifact workspace / set view in a side panel.

**Migration:** `0012_relationships.sql`

---

### Slice 6 — Notifications + Knowledge Packs + V2 Polish

**Completes the notification store, curated onboarding packs, and wires all V2
activity events into the dashboard.**

**Backend**
- Migration: `notifications` table + `notification_type` enum (above).
  Add new `AuditAction` values: `ARTIFACT_SHARED`, `BULLETIN_POSTED`,
  `COUNTDOWN_ASSIGNED`, `COUNTDOWN_COMPLETED`.
- `notificationService.ts`:
  - `createNotification(userId, type, title, body?, link?)` — inserts row.
  - `listNotifications(userId, unreadOnly?)` — paginated, newest first.
  - `markRead(userId, notificationId)` / `markAllRead(userId)`.
  - `deleteNotification(userId, notificationId)`.
  - Backfill: update Slices 1–5 service calls to emit notifications via this service
    (they currently call the notification service inline — in this slice we solidify the
    service and wire any gaps).
- Knowledge Packs: curated sets of library artifacts. Implemented as regular library
  sections with an `is_pack BOOLEAN` flag added to `library_sections`.
  - Admins can mark a section as a Knowledge Pack.
  - On user first login (or from settings), a "Starter Packs" modal suggests packs to
    subscribe to.
- Activity feed: extend `activityService` with the new V2 event types
  (`ARTIFACT_SHARED`, `BULLETIN_POSTED`, `COUNTDOWN_ASSIGNED`, `COUNTDOWN_COMPLETED`).
  Dashboard activity widget renders these with correct labels/icons.

**Frontend**
- Notification bell icon in the top-right header (not currently in the sidebar).
  Badge shows unread count.
- Notification center dropdown/panel: list of notifications with type icon, title,
  body, relative time. Click → navigates to `link`. Mark read / mark all read.
- Dashboard: add Bulletin widget (latest 3 bulletins), Countdown widget (user's pending
  assignments), Messages widget (unread conversations count + last message preview).
- Settings: Knowledge Packs tab — subscribe/unsubscribe to packs, shown on first login.
- "Shared with me" count in sidebar updated via notification events.
- Full V2 polish pass: responsive fixes, empty states for all new pages, loading
  skeletons, error boundaries.

**Migration:** `0013_notifications.sql` (adds `is_pack` to `library_sections`)

---

## How to build each slice (working agreement)

Same conventions as V1:

- New module per feature: `modules/messaging/`, `modules/bulletin/`, `modules/library/`,
  `modules/relationships/`, `modules/notifications/` — each with `types.ts`, `schemas.ts`,
  `services/`.
- Every route handler follows the established pattern:
  `requireSession → zod.safeParse → service → ok/fail → typed error catch`.
- Multi-write ops use `transaction(tx => ...)`.
- Audit logging via `writeAuditLog` (non-blocking).
- Activity events via `emitActivityEvent` (non-blocking, best-effort).
- New notifications via `notificationService.createNotification` (best-effort, like audit).
- **Every new API route must call `requireSession` itself** — proxy only covers pages.
- Migrations are forward-only `.sql` files applied by `npm run migrate`.
- Per TRD: every feature ships with a manual-test doc + rollback doc in `workdesk/docs/`.

## Architecture invariants (unchanged from V1)

- **Reference-based sharing** — `library_artifacts` and `artifact_shares` hold pointers;
  no file or content duplication ever.
- **Immutable history** — version commits remain append-only; sharing/publishing a
  reference never touches version rows.
- **Ownership preservation** — owner of an artifact is always the user who created it,
  regardless of how many times it has been shared, published, or referenced.
- **Row-level access control** — every query scopes by (ownerId OR share grant OR public
  visibility) rather than relying on a separate authz layer.

## Explicitly deferred (not V2)

- Real-time / WebSocket / live collaboration (V3)
- Comments, mentions, review states, bulk operations (V3)
- PWA push notifications — infrastructure exists, triggers land in V3
- DMs / group chats beyond 1:1 (V3)
- Mail hub (Gmail/Outlook integration), tool dock (V4)
- External imports: GDrive, GitHub, Figma, Canva (V5)
- Developer API + webhooks (V5)
