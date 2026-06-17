# WorkDesk V1 — Implementation Plan

> Derived from `PRD v1 d1.txt` (feature-focused) and `PRD v1 d2.txt` (product-focused),
> reconciled, and checked against the current codebase. Companion to the root `CLAUDE.md`
> and Claude's `mindmap.md`.

## Decisions (locked)

1. **Scope = archive-only** (follow d2). V1 is the private archive. **Library, publishing,
   sharing, and all "Published" filters/states are deferred to V2.** d1 listed Library under
   V1, but d2 explicitly excludes all collaboration — d2's product intent wins.
2. **Delivery = full-stack, module by module.** Each slice ships its backend gaps *and* its
   real UI (wired to the Stitch mockups in `UI/`) before moving on.
3. **Rich-text editor + version Compare = V1.1 fast-follow**, not core V1. Core V1 ships
   file-based artifacts and version *restore*; rich-text editing/autosave and version diff
   land right after.

## d1 vs d2 reconciliation

| Area | d1 (features) | d2 (product) | V1 decision |
|---|---|---|---|
| Library / Publish | In V1 | Explicitly excluded | **Deferred to V2** |
| Sharing / collab | Implied via Library | "No collaboration" | **Deferred to V2** |
| List view (2nd mode) | — | Yes | **In** |
| Star / Favorites | — | Yes | **In** |
| Trash + 30d retention + permanent delete | — | Yes | **In** |
| Storage usage + admin quotas | — | Yes | **In** |
| Artifact locking (edit lock → read-only) | — | Yes | **In** |
| Ownership transfer (admin) | — | Yes | **In** |
| Rich-text editor / Compare versions | Rich text | Full editor + compare | **V1.1** |
| Remember Me / Forgot Password | Yes | (session mgmt) | **In** |
| Dashboard sections | Recent/Activity/Published/Notifications | Recent/Opened/Starred/Activity/Storage | **In** (drop "Published" + "Notifications" — V2) |

Spine both agree on: Auth, nested Sets, typed Artifacts, immutable Versioning, Search,
Profile/account, PWA.

## PRD logic audit (corrections applied)

The PRDs are AI-drafted and contain features that don't hold up once you account for V1 being
archive-only. Corrections folded into this plan:

1. **Artifact locking → deferred to V2.** d2 says "editing locks the artifact, others open
   read-only." But V1 has no sharing — no other user can open your private artifact, so a lock
   only guards you against yourself across browser tabs. It's meaningless until V2's
   SHARED/PUBLIC read paths exist. Removed from V1.
2. **Search "Owner" / "Published Status" filters → dropped from V1.** Every artifact a user
   can see in V1 is their own, so an owner filter is a no-op; publishing doesn't exist in V1.
   Both return in V2.
3. **"Shared" / "Published" in the artifact timeline → dropped from V1.** No share/publish
   events exist yet. V1 timeline = Created / Modified / Deleted / Restored / version events.
4. **Storage-quota enforcement is *soft*, not a hard gate.** Uploads use presigned PUT —
   the client uploads bytes directly to R2, so the server never sees actual size at write
   time. V1 enforces a soft projected-usage check at ticket issuance (using client-declared
   content-length) and reconciles *true* usage from R2 (HEAD on commit + periodic recount).
   The plan must not pretend the upload ticket is an authoritative quota gate.
5. **Dashboard "Pending Notifications" / "Published" widgets → dropped from V1** (no
   notification or publishing systems until V2).
6. **PWA push notifications → deferred to V2.** Nothing generates notifications in V1; push
   infra lands with the V2 notification triggers. V1 PWA = installable + offline cache +
   responsive only.
7. **Ownership transfer covers artifacts + sets only** (d2's "Transfer Libraries" references
   a V2 concept).
8. **Dashboard tracking (decision):** building it properly in V1 — a per-user access log
   (`lastOpenedAt` / open events) powers "Recently Opened," and a real user-facing
   **Activity Feed** (distinct from the security `AuditLog`) powers "Activity Summary."

## Current state (what already exists)

- **Backend built:** Auth module (login/logout/session/change-password/admin user mgmt),
  Archive module (sets CRUD + nesting + circular-ref guard + cascade soft-delete; artifacts
  CRUD + soft-delete; versions commit/restore — append-only), Storage (R2 presigned up/down
  with namespaced keys), edge proxy RBAC, Prisma schema, admin seed.
- **Not built:** the **entire frontend** (no page routes, no `components/`, no providers/hooks
  — `page.tsx` is still create-next-app boilerplate), and backend for Star, Trash/retention,
  Storage quota, Search index, Ownership transfer, profile/email/theme updates,
  Forgot Password, access-log + Activity Feed. (Locking → V2.)
- **No `prisma/migrations/`** yet — first migration needs to be created.

## V1 Gap List (backend)

These are net-new vs. the current backend:

- **Schema additions:** `Star` (user↔artifact/set), `quotaBytes` + `storageUsedBytes` on
  User, `byteSize` on Version (captured at commit), `ArtifactAccess` / `lastOpenedAt` for the
  access log, `ActivityEvent` (user-facing feed, separate from the security `AuditLog`),
  `PasswordResetToken` for forgot-password. Trash reuses existing `deletedAt` + a
  retention/purge job. Ownership transfer reuses existing fields + `OWNERSHIP_TRANSFERRED`
  audit emission. (No lock fields — locking is V2. `Notification` is V2.)
- **Endpoints to add:** star/unstar; list trash + restore + permanent-delete (+ R2 GC);
  storage usage (user + platform) + admin quota set; profile update (name/email/theme)
  emitting `EMAIL_CHANGED`/`PROFILE_UPDATED`; admin ownership transfer (artifact/set);
  forgot-password (request + reset); record-open + recent-opened; activity-feed read.
- **Search:** Phase-1 Postgres full-text over title/description/tags/set-name (artifact text
  content joins once the editor lands in V1.1). Replace the current in-memory tag filter with
  a jsonb-containment query. V1 filters = type, date, favorites (no owner/published — see audit).
- **Cross-cutting:** retention purge (soft-deleted > 30d → hard delete rows + R2 objects);
  **soft** storage-quota check at ticket issuance via client-declared size, with true usage
  reconciled from R2 (HEAD on commit + periodic recount) — not a hard gate; rate-limiting +
  CSRF posture review.

## Frontend foundation (built once, before feature slices)

- App shell from the Stitch mockups: persistent left sidebar (Dashboard, Archive, Settings,
  Profile; hide V2 nav items), main content area, optional right context panel; bottom
  sidebar = storage usage + user profile. Desktop-first, responsive (tablet/mobile variants
  exist in `UI/`).
- Design system: dark-only tokens from `UI/context.txt` (bg `#0D1117`, surfaces `#161B22`/
  `#1C2128`, border `#30363D`, text `#E6EDF3`/`#8B949E`, accent `#58A6FF`, success/warning/
  danger). Inter font. Stand up shadcn/ui + Tailwind theme to match.
- Data layer: TanStack Query for all API calls against the `ApiResponse` envelope; a typed
  fetch wrapper that unwraps `ok`/`fail`; auth/session provider hydrated from
  `GET /api/auth/session`; route protection already handled by `src/proxy.ts`.

## Execution slices (each = backend gap + wired UI)

Order favors shippable value and dependency flow.

**Slice 0 — Foundations**
First Prisma migration (baseline current schema). Frontend shell + design system + query/
auth provider + typed API client. Login page + session hydration + logout. _Exit:_ a user can
log in and see an empty authenticated shell.

**Slice 1 — Archive core (Sets + Artifacts + Explorer)**
Wire existing sets/artifacts APIs. Explorer (tree) + List view; single-click select,
double-click open, right-click context menu. Create/rename/delete sets; create/edit metadata
for artifacts; file upload via presigned PUT → commit initial version. Empty/loading/error
states. _Exit:_ full private file-archive usable end to end.

**Slice 2 — Versioning UI + Storage/Download**
Version history panel; commit new version; restore version (append-only). Download via
presigned GET. _Exit:_ users manage version history; (compare = V1.1).

**Slice 3 — Star + Search**
Schema + endpoints for star/unstar (artifacts & sets). Postgres FTS over title/desc/tags/
set-name with filters (**type, date, favorites** — no owner/published filter in V1); replace
in-memory tag filter with jsonb-containment. Search UI + starred views. _Exit:_ discovery +
favorites.

**Slice 4 — Trash + Storage management**
Trash view (list soft-deleted, restore, permanent-delete with R2 GC). 30-day retention purge
job. Storage usage tracking (user + platform) with `byteSize` captured per version; admin
per-user quotas; **soft** projected-usage check at upload-ticket issuance + reconciliation
from R2 (not a hard gate — see audit #4). _Exit:_ lifecycle + storage management complete.

**Slice 5 — Account + Admin**
Profile update (name/email/theme) with audit emission; forgot-password (request + reset);
Remember Me. Admin: user management UI (list/suspend/role), audit-log viewer, ownership
transfer (artifact/set). _Exit:_ account mgmt + admin complete. (Artifact edit-locking moved
to V2 — meaningless without sharing.)

**Slice 6 — Activity, Dashboard + PWA**
Backend: `ActivityEvent` feed (emitted on create/update/version-commit/delete/restore) +
access-log (record-open → `lastOpenedAt`). Dashboard widgets: Recent Artifacts (by
updatedAt), Recently Opened (from access log), Starred, Activity Summary (from ActivityEvent),
Storage Usage. (No "Published"/"Notifications" widgets — V2.) PWA: manifest, installable,
offline asset cache, responsive polish. (Push → V2 with notifications.) _Exit:_ V1 complete.

**V1.1 fast-follow**
Rich-text editor for TEXT artifacts (formatting, links, lists, tables, image embeds, manual +
auto-save) storing content as a versioned object; version **Compare/diff**; artifact text
content added to the search index.

## How to build each slice (working agreement)

- Follow the request-flow + module conventions in root `CLAUDE.md` (auth → zod → service →
  `ok`/`fail`; all DB logic in `modules/*/services`; `$transaction` for multi-writes;
  non-blocking audit logging; row-level ownership scoping).
- New feature ⇒ new module mirroring `modules/auth` & `modules/archive`
  (`types.ts` + `schemas.ts` + `services/`).
- Preserve the architecture invariants: reference-based (no file duplication), immutable
  version history, ownership preservation.
- Per TRD: every feature ships with a manual-test doc + rollback doc in `workdesk/docs/`.
- Watch the loopholes in `mindmap.md` (esp. orphan R2 GC on permanent-delete, quota
  enforcement, in-memory tag filtering, and self-guarding every new API route).

## Explicitly deferred (not V1)

Library / publishing / sections, sharing & SHARED/PUBLIC read paths, **artifact edit-locking**
(meaningless without sharing — see audit #1), messaging, bulletin/countdowns, mail hub, graph
view, notifications & push, comments/review, relationships, external integrations. These are
V2+ per d2 and the PRD roadmap.
