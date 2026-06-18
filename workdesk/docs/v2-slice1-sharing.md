# V2 Slice 1 — Artifact Sharing & SHARED Read Path

## What Was Built

Enables artifact owners to share their work with specific organisation members by email. Introduces the `SHARED` visibility tier and the per-user share grant table.

**Migration:** `0008_sharing.sql`
**Commit:** `feat(v2-slice-1): artifact sharing + SHARED read path`

---

## Schema

```sql
CREATE TABLE artifact_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grantee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, grantee_id),
  CHECK (owner_id <> grantee_id)
);
```

---

## Backend

### `shareService.ts` (`src/modules/sharing/services/`)

| Function | Behaviour |
|---|---|
| `shareArtifact(ownerId, artifactId, granteeEmail)` | Resolves grantee by email, auto-promotes artifact to `SHARED` visibility, inserts share row + emits audit + activity in a transaction |
| `revokeShare(ownerId, artifactId, granteeId)` | Deletes share row; reverts artifact to `PRIVATE` if no remaining grants exist |
| `listShareGrants(ownerId, artifactId)` | Returns all current grantees with name + email |
| `listSharedWithMe(userId)` | Returns `SharedArtifactSummary[]` — artifacts shared to this user |
| `canReadSharedArtifact(userId, artifactId)` | Boolean check for share grant existence |

### Extended: `archiveService.getArtifactDetails`

Accepts an optional `allowShared = true` flag. When set, the query first checks ownership, then falls back to:
1. `SHARED` path — JOIN `artifact_shares` WHERE `grantee_id = userId`
2. `PUBLIC` path — WHERE `visibility = 'PUBLIC'` (no join needed)

### Extended: `archiveService.verifyContentKeyReference`

Also extended to allow cross-namespace content key access for grantees and PUBLIC artifacts, so shared members can download files they didn't upload.

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/archive/artifacts/[id]/share` | GET | List share grants (owner only) |
| `/api/archive/artifacts/[id]/share` | POST | Grant access (`{ granteeEmail }`) |
| `/api/archive/artifacts/[id]/share` | DELETE | Revoke access (`{ granteeId }` in body) |
| `/api/archive/shared` | GET | List artifacts shared with the calling user |

---

## Frontend

### Components

- **`ShareDialog`** (`src/components/archive/share-dialog.tsx`) — Owner-only modal. Email input to add grantee. Lists current grantees with Revoke buttons.
- **`/archive/shared/page.tsx`** — "Shared with me" page listing `SharedArtifactSummary[]`. Each row navigates to the artifact workspace.

### Artifact workspace changes

- Share button added to the action bar (owner only).
- Read-only warning shown in the properties panel for non-owners.

### Sidebar

- "Shared with me" nav entry added under Archive.

---

## Manual Test Plan

**Prerequisites:** Two user accounts (admin + at least one member). Dev server running. Both users logged in in separate browsers.

### Happy path — share an artifact

1. Log in as **owner** (admin or any member).
2. Open Archive → create a TEXT artifact (e.g. title "Test Doc").
3. Open the artifact workspace → click **Share**.
4. Enter the **other user's email** → click Share.
5. Dialog updates: the grantee appears in the grantee list with a Revoke button.
6. The artifact's visibility in the Properties panel now shows `SHARED`.

### Verify grantee access

7. Log in as the **grantee** in a second browser.
8. Navigate to `/archive/shared`.
9. "Test Doc" appears in the list.
10. Click it → opens the artifact workspace in read-only mode.
11. The Properties panel shows "Read-only — you are not the owner."
12. No **Edit metadata**, **Commit new version**, or **Share** buttons are visible.

### Revoke

13. Back in the owner's browser, open Share dialog → click **Revoke** next to the grantee.
14. Grantee is removed from the list. Artifact reverts to `PRIVATE`.
15. In the grantee's browser, `/archive/shared` now shows an empty state.
16. Attempting to navigate directly to `/archive/{id}` returns a 404 error page.

### Edge cases

| Scenario | Expected |
|---|---|
| Share with own email | 400 — cannot share with yourself |
| Share with non-existent email | 404 — user not found |
| Share same artifact twice to same grantee | 409 — already shared |
| Non-owner attempts to share | 403 — forbidden |

---

## Rollback

1. Remove share rows: `DELETE FROM artifact_shares;`
2. Revert visibility on affected artifacts: `UPDATE artifacts SET visibility = 'PRIVATE' WHERE visibility = 'SHARED';`
3. Drop the table: `DROP TABLE artifact_shares;`
4. The `allowShared` flag in `archiveService` defaults to `false` on all routes except the two that explicitly pass `true` — reverting those two call sites to `false` restores the V1 read path.

> Note: migration files are forward-only. If dropping the table in production, create a new migration `0008_rollback_sharing.sql` rather than modifying the original.
