# V2 Slice 2 — Bulletin Board & Countdown Tasks

## What Was Built

An org-wide notice board. Any member can post announcements or countdown tasks. Countdown tasks carry assignees, a due date, per-user completion tracking, and automatic overdue detection. Admins can pin and delete any bulletin.

**Migration:** `0009_bulletin.sql`
**Commit:** `feat(v2-slice-2): bulletin board + countdown tasks`

---

## Schema

```sql
CREATE TYPE bulletin_type    AS ENUM ('ANNOUNCEMENT', 'COUNTDOWN');
CREATE TYPE countdown_status AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'INCOMPLETE');

CREATE TABLE bulletins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type        bulletin_type NOT NULL,
  title       TEXT NOT NULL CHECK (char_length(title) <= 255),
  body        TEXT CHECK (char_length(body) <= 2000),
  due_at      TIMESTAMPTZ,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE countdown_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id  UUID NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       countdown_status NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  UNIQUE (bulletin_id, user_id)
);
```

---

## Backend

### `bulletinService.ts` (`src/modules/bulletin/services/`)

| Function | Behaviour |
|---|---|
| `listBulletins(userId)` | Runs `markOverdueAssignments()` best-effort, then returns all bulletins with aggregate counts and the calling user's own countdown status |
| `getBulletin(userId, id)` | Returns `BulletinDetail` including the full assignment list |
| `createBulletin(authorId, payload)` | Validates discriminated union (ANNOUNCEMENT vs COUNTDOWN). Transaction: INSERT bulletin + INSERT assignments + audit log + activity events |
| `markComplete(userId, bulletinId)` | Sets `status = COMPLETED`, records `completed_at`. Only valid from `PENDING` or `OVERDUE`. |
| `deleteBulletin(actorId, actorRole, bulletinId)` | Author or ADMIN only. Hard deletes (assignments cascade). |
| `pinBulletin(adminId, bulletinId)` | Admin only. Toggles `pinned` flag. |

**Overdue sweep:** `markOverdueAssignments()` is called on every `listBulletins`. It UPDATEs any assignment where `due_at < now() AND status = 'PENDING'` to `OVERDUE`. No cron job needed.

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/bulletin` | GET | List all bulletins |
| `/api/bulletin` | POST | Create bulletin |
| `/api/bulletin/[id]` | GET | Get bulletin detail |
| `/api/bulletin/[id]` | PUT | Pin/unpin (admin only, `{ pinned: boolean }`) |
| `/api/bulletin/[id]` | DELETE | Delete bulletin (author or admin) |
| `/api/bulletin/[id]/complete` | POST | Mark calling user's assignment complete |

---

## Frontend

### `BulletinPage` (`src/app/(app)/bulletin/page.tsx`)

- Polls every **60 seconds** via `refetchInterval`.
- Pinned bulletins float to the top.
- Each `BulletinCard` shows:
  - Type badge (ANNOUNCEMENT / COUNTDOWN)
  - Due date in red when overdue
  - Progress bar for countdowns (completed / total assignees)
  - The calling user's own status badge
  - "Mark complete" button (own assignment, not yet completed)
  - Admin controls: Pin/Unpin, Delete (with confirmation dialog)

### `CreateBulletinDialog` (`src/components/bulletin/create-bulletin-dialog.tsx`)

- Type toggle: ANNOUNCEMENT or COUNTDOWN.
- COUNTDOWN reveals: due date/time picker + assignee picker (searchable member list with checkboxes).
- ANNOUNCEMENT hides both.

### Sidebar

- "Bulletin" nav entry added.

---

## Manual Test Plan

**Prerequisites:** At least two users (admin + member). Dev server running.

### Announcement

1. Log in as any user → navigate to **Bulletin**.
2. Click **New bulletin** → select **Announcement** → fill title + body → Submit.
3. The announcement card appears at the top of the feed.
4. All other logged-in users see it on their Bulletin page (refresh or wait ≤60s for poll).

### Countdown task

5. Click **New bulletin** → select **Countdown**.
6. Set a due date/time in the future. Check at least two members in the assignee list.
7. Submit.
8. A countdown card appears with a progress bar showing `0 / N completed`.
9. Log in as an **assigned member** → Bulletin page → the card shows their personal status badge as "PENDING".
10. Click **Mark complete** → status badge updates to "COMPLETED". Progress bar increments.

### Overdue

11. Create a countdown with a due date **1 minute in the future**. Assign yourself.
12. Wait for the time to pass, then refresh the Bulletin page.
13. The due date text turns red. Your assignment status badge changes to "OVERDUE".

### Admin controls

14. Log in as admin.
15. Click **Pin** on any bulletin → it moves to the top of the list. Pin badge appears.
16. Click **Unpin** → it returns to chronological order.
17. Click **Delete** → confirm dialog → bulletin is removed.
18. Log in as a non-admin member → **Delete** button is absent on other users' bulletins; only appears on own bulletins.

### Edge cases

| Scenario | Expected |
|---|---|
| Countdown with no assignees | 400 — at least one assignee required |
| Countdown with no due date | 400 — dueAt required |
| Non-author, non-admin tries to delete | 403 — forbidden |
| Mark complete on unassigned bulletin | 404 — assignment not found |
| Mark complete twice | 400 — already completed |

---

## Rollback

1. Drop data: `DELETE FROM countdown_assignments; DELETE FROM bulletins;`
2. Drop tables and types:
   ```sql
   DROP TABLE countdown_assignments;
   DROP TABLE bulletins;
   DROP TYPE countdown_status;
   DROP TYPE bulletin_type;
   ```
3. Remove `BulletinType` and `CountdownStatus` from `src/lib/enums.ts`.
4. Remove Bulletin nav entry from sidebar.
5. Remove `BULLETIN_CREATED`, `BULLETIN_DELETED`, `BULLETIN_PINNED`, `COUNTDOWN_COMPLETED` from `AuditAction` enum.
