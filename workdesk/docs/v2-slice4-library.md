# V2 Slice 4 — Library Sections & Artifact Publishing

## What Was Built

A curated organisational library where artifact owners can publish their work for all members to discover. Published artifacts get `visibility = PUBLIC` and appear in named sections. Members can subscribe to sections. Publishing and unpublishing are transactional and never duplicate file content.

**Migration:** `0011_library.sql`
**Commit:** `feat(v2-slice-4): library sections + artifact publishing`

---

## Schema

```sql
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
```

---

## Backend

### `libraryService.ts` (`src/modules/library/services/`)

| Function | Behaviour |
|---|---|
| `listSections(userId)` | Returns all sections with artifact count, subscriber count, and `isSubscribed` flag for the calling user |
| `createSection(userId, name, description?)` | Inserts section via CTE + immediate JOIN to return full summary in one query |
| `deleteSection(userId, userRole, sectionId)` | Section creator or ADMIN only. Cascades `library_artifacts` rows but leaves artifacts in owners' archives untouched. |
| `getSectionArtifacts(sectionId)` | Returns `LibraryArtifactItem[]` with owner and added-by details. Excludes soft-deleted artifacts. |
| `publishArtifact(ownerId, artifactId, sectionId)` | Owner only. Transaction: SET `visibility = 'PUBLIC'` + INSERT `library_artifacts` + audit log. Errors if already in this section. |
| `unpublishArtifact(ownerId, artifactId, sectionId)` | DELETE `library_artifacts` row. If the artifact has no remaining section memberships, reverts `visibility = 'PRIVATE'`. |
| `subscribeSection(userId, sectionId)` | INSERT with `ON CONFLICT DO NOTHING` (idempotent). |
| `unsubscribeSection(userId, sectionId)` | DELETE subscription row. |
| `getSubscriptions(userId)` | Returns sections the user follows. |
| `getArtifactSections(artifactId)` | Returns `{ id, name }[]` — which sections contain this artifact. Used by the Publish dialog in the workspace. |

### Extended: `archiveService.getArtifactDetails`

The `PUBLIC` visibility path (added in this slice) allows any authenticated member to read an artifact's detail and content without a share grant. This powers the Library's "click to open" flow for non-owners.

### Extended: `archiveService.verifyContentKeyReference`

Allows PUBLIC artifact content keys to be downloaded by any authenticated user, not just the owner.

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/library/sections` | GET | List all sections |
| `/api/library/sections` | POST | Create section (`{ name, description? }`) |
| `/api/library/sections/[id]` | GET | Get artifacts in section |
| `/api/library/sections/[id]` | DELETE | Delete section (creator or admin) |
| `/api/library/sections/[id]/artifacts` | POST | Publish artifact (`{ artifactId }`) |
| `/api/library/sections/[id]/artifacts` | DELETE | Unpublish artifact (`{ artifactId }` in body) |
| `/api/library/sections/[id]/subscribe` | POST | Subscribe |
| `/api/library/sections/[id]/subscribe` | DELETE | Unsubscribe |
| `/api/library/artifact-sections` | GET | `?artifactId=` — which sections contain this artifact |

---

## Frontend

### `LibraryPage` (`src/app/(app)/library/page.tsx`)

Two-pane layout:

**Left — Section list (`w-80`):**
- Section cards showing name, description, artifact count, subscriber count, and creator name.
- Subscribe / Subscribed toggle button per card.
- Delete button for section creator and admins (with confirmation dialog).
- "New section" button opens `CreateSectionDialog`.
- Clicking a card opens the section detail on the right.

**Right — Section detail:**
- Section header with name, description, creator, and artifact count.
- Artifact list: title, type, owner. Each row has a PUBLIC badge and a Remove button (owner only).
- Clicking an artifact row navigates to `/archive/[artifact-id]`.

### `CreateSectionDialog` (`src/components/library/create-section-dialog.tsx`)

Modal with name (required, max 100) and description (optional, max 500) fields.

### `PublishDialog` (`src/components/library/publish-dialog.tsx`)

Opened from the artifact workspace via the **Publish to Library** button (owner only).

- **"Published in"** panel: lists sections the artifact is already in, with a Remove button per section.
- **"Publish to section"** panel: lists remaining sections the artifact is not yet in, with a Publish button per row.
- Both actions update immediately via TanStack Query invalidation.

### Artifact workspace changes

- **"Publish to Library"** button in the owner action bar.
- Visibility property in the right panel shows an **"In Library"** badge when `visibility === 'PUBLIC'`.

### Archive explorer changes

- Artifact subtitles now include **"Published"** (PUBLIC) or **"Shared"** (SHARED) text so visibility is visible at a glance without opening the workspace.

### Sidebar

- "Library" nav entry added before "Archive".

---

## Visibility Lifecycle

```
PRIVATE  →  share with user  →  SHARED
SHARED   →  revoke all grants →  PRIVATE
PRIVATE  →  publish to section → PUBLIC
PUBLIC   →  remove from last section → PRIVATE
```

An artifact can be in `SHARED` and published to library (effectively `PUBLIC`) if the owner publishes it directly — `publishArtifact` always sets visibility to `PUBLIC` regardless of prior state.

---

## Manual Test Plan

**Prerequisites:** Admin + at least one member. Dev server running. Migrations applied.

### Create a section

1. Navigate to **Library** → click **New section**.
2. Enter a name (e.g. "Onboarding") and optional description → Create.
3. The section card appears in the left panel.

### Publish an artifact

4. Navigate to **Archive** → open any artifact you own.
5. Click **Publish to Library**.
6. The Publish dialog opens. Click **Publish** next to "Onboarding".
7. The section moves to the "Published in" panel.
8. Close the dialog. The Properties panel shows visibility: PUBLIC + "In Library" badge.
9. Back in the Archive explorer, the artifact's subtitle shows "Published".

### Browse the library

10. Navigate to **Library** → click the "Onboarding" section card.
11. The right panel lists the published artifact.
12. Click the artifact row → opens the workspace.

### Non-owner access

13. Log in as another user → navigate to **Library** → "Onboarding" → click the artifact.
14. The workspace opens. Properties panel shows "Read-only — you are not the owner."
15. No Publish to Library / Edit metadata / Share buttons are visible.

### Subscribe

16. Click **Subscribe** on the "Onboarding" section card.
17. Button changes to **Subscribed**. Subscriber count increments.

### Unpublish

18. As the artifact owner, open the artifact workspace → **Publish to Library**.
19. Click **Remove** next to "Onboarding".
20. The section moves back to the available list.
21. If "Onboarding" was the only section, the artifact's visibility reverts to PRIVATE.

### Delete a section

22. Log in as admin → Library → Delete "Onboarding" section.
23. Confirmation dialog appears. Confirm.
24. Section is removed. Artifacts that were in it remain in their owners' archives unchanged.

### Edge cases

| Scenario | Expected |
|---|---|
| Publish same artifact to same section twice | 409 — already published |
| Non-owner tries to publish | 403 — not the artifact owner |
| Delete section as non-creator, non-admin | 403 — forbidden |
| Unpublish from section artifact isn't in | 404 — not published |
| Access PUBLIC artifact without login | 401 — authentication required (proxy) |

---

## Rollback

1. Revert artifact visibility:
   ```sql
   UPDATE artifacts a
   SET visibility = 'PRIVATE'
   WHERE visibility = 'PUBLIC'
     AND NOT EXISTS (
       SELECT 1 FROM artifact_shares s WHERE s.artifact_id = a.id
     );
   ```
   (Leaves SHARED artifacts as SHARED if they have share grants.)

2. Drop tables:
   ```sql
   DROP TABLE library_subscriptions;
   DROP TABLE library_artifacts;
   DROP TABLE library_sections;
   ```

3. Remove Library nav entry from sidebar.
4. Remove **Publish to Library** button and `PublishDialog` from the artifact workspace.
5. Remove the `PUBLIC` fallback path from `archiveService.getArtifactDetails` and `verifyContentKeyReference`.
