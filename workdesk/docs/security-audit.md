# WorkDesk — Security & Production Audit

**Date:** 2026-06-19
**Auditor:** Senior Engineering Review (Claude Sonnet 4.6)
**Scope:** Full codebase — backend services, API routes, DB schema (migrations 0001–0012), auth layer, storage, edge proxy.
**Excluded by policy:** Rate limiting, CSRF hardening, notifications — deferred to post-build phase.

---

## Architecture Baseline (what is solid)

| Concern | Implementation | Assessment |
|---|---|---|
| Database | 100% raw SQL via `pg` (node-postgres). Pool singleton, parameterized `$1/$2` everywhere, `transaction()` helper for multi-write ops. No ORM. | ✅ Clean |
| Auth session | iron-session sealed cookie — `httpOnly`, `secure` in prod, `sameSite=lax`, 7-day TTL. | ✅ Correct |
| Password hashing | bcryptjs, 12 rounds. Constant-time dummy hash on login to prevent user enumeration. | ✅ Correct |
| Input validation | zod `safeParse` on all route inputs before any DB call. | ✅ Correct |
| Route authorization | Every API route calls `requireSession()` or `requireAdminSession()` as first step. Edge proxy is a second layer for page routes only. | ✅ Correct |
| SQL injection | No string interpolation of user input in any query found. All values are parameterized. | ✅ Clean |
| Ownership scoping | Archive queries always filter `owner_id = $userId AND deleted_at IS NULL`. Sharing adds a separate JOIN path. | ✅ Correct |
| Content-key traversal | `assertContentKeyNamespace` + `resolveKey` both reject `..` segments and enforce path containment. | ✅ Correct |
| Immutable history | Versions are append-only. Restore = new version copying old contentKey. Hard to accidentally destroy. | ✅ By design |
| CDN / caching | No cache headers set on API responses. Vercel CDN handles static assets automatically. No Redis or edge cache configured. All API routes are fully dynamic. | ⚠️ No cache strategy yet |

---

## Critical Bugs (data correctness — must fix before any real users)

### CRIT-1 — PostgreSQL `audit_action` enum is missing all V2 values

**File:** `migrations/0001_baseline.sql:33`, `src/lib/enums.ts`, all V2 services

The `audit_action` PostgreSQL enum defined in `0001_baseline.sql` contains only 19 values (V1 actions). The TypeScript `AuditAction` enum and service code emit these additional values that **do not exist in the database enum**:

- `ARTIFACT_SHARED`
- `ARTIFACT_SHARE_REVOKED`
- `BULLETIN_CREATED`
- `BULLETIN_DELETED`
- `BULLETIN_PINNED`
- `COUNTDOWN_COMPLETED`

Every `INSERT INTO audit_logs` using these values throws a PostgreSQL `invalid input value for enum audit_action` error. This error is caught by `writeAuditLog`'s try/catch and silently discarded. **The entire audit trail for V2 features (sharing, bulletin, countdown) is silently empty.**

**Fix:** Add a migration:
```sql
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ARTIFACT_SHARED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ARTIFACT_SHARE_REVOKED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'BULLETIN_CREATED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'BULLETIN_DELETED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'BULLETIN_PINNED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'COUNTDOWN_COMPLETED';
```

---

### CRIT-2 — PostgreSQL `activity_event_type` enum is missing all V2 activity event types

**File:** `migrations/0006_activity.sql:21`, `src/modules/activity/services/activityService.ts`

The `activity_event_type` enum in `0006_activity.sql` has only V1 types. The service emits these V2 types that don't exist in the DB enum:

- `BULLETIN_POSTED`
- `COUNTDOWN_ASSIGNED`
- `COUNTDOWN_COMPLETED`
- `ARTIFACT_SHARED`
- `ARTIFACT_SHARE_REVOKED`
- `ARTIFACT_RESTORED` (used in trashService)
- `SET_RESTORED` (used in trashService)

Every `emitActivityEvent` call with a V2 type silently fails (fire-and-forget `.catch()`). **The activity feed shows nothing for all V2 operations.**

**Fix:** Add a migration:
```sql
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'BULLETIN_POSTED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'COUNTDOWN_ASSIGNED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'COUNTDOWN_COMPLETED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'ARTIFACT_SHARED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'ARTIFACT_SHARE_REVOKED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'ARTIFACT_RESTORED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'SET_RESTORED';
```

---

### CRIT-3 — Production storage is completely broken (Vercel target)

**File:** `src/lib/storage.ts`, `src/app/api/storage/local/[...path]/route.ts`, `src/modules/archive/services/trashService.ts:19`

The entire storage backend writes to `process.cwd()/uploads/` — the local filesystem. On Vercel (stated deployment target) this filesystem is ephemeral and read-only outside `/tmp`. All file uploads will fail silently or succeed in dev but vanish on the next deployment.

Additionally, `src/app/api/archive/artifacts/[id]/content/route.ts:143` has an explicit `throw new Error("Server-side R2 write for text content is not yet implemented")` that crashes the rich-text save path unless `USE_LOCAL_STORAGE=true`. This env var is not set in production by default.

**No action needed yet** (acknowledged infrastructure gap — wire R2/S3 before deploying).

---

## Security Bugs (must fix regardless of build phase)

### SEC-1 — Shared-file downloads are blocked at the storage layer

**File:** `src/app/api/storage/local/[...path]/route.ts:91`

The GET handler enforces `segments[1] !== session.userId → 403 Forbidden`. This rejects any request where the file's owner is not the current user. A user who has been granted a share on another user's artifact **cannot download the file** — the content key `archives/{otherUserId}/...` will always fail the check.

The sharing model (artifact_shares table, `canReadSharedArtifact`, `verifyContentKeyReference`) correctly grants read access at the metadata/version level, but the actual bytes are inaccessible. The download route (`/api/storage/download`) calls `verifyContentKeyReference` (which correctly allows shared reads) and then produces a URL pointing at this `/local/[...path]` route — which then blocks the grantee.

**Shared downloads are completely non-functional.**

**Fix:** In the GET handler, after failing the owner check (`segments[1] !== session.userId`), call `verifyContentKeyReference(session.userId, segments.join('/'))` before returning 403. If that passes, serve the file.

```typescript
// After the owner check fails:
if (segments[1] !== session.userId) {
  const contentKey = segments.join('/');
  try {
    await verifyContentKeyReference(session.userId, contentKey);
    // shared read allowed — fall through to serve file
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
```

---

### SEC-2 — `revokeShare` is not atomic — race condition leaves dangling state

**File:** `src/modules/sharing/services/shareService.ts:183`

The delete of the share row and the subsequent `UPDATE artifacts SET visibility = 'PRIVATE'` are two separate queries with no wrapping transaction. A concurrent `shareArtifact` call between these two queries can:

1. Thread A: DELETE share row for grantee X
2. Thread B: INSERT new share row for grantee Y (artifact is still SHARED)
3. Thread A: UPDATE visibility = 'PRIVATE' (no remaining grants... but Thread B just added one)

Result: artifact is PRIVATE with a live share grant for Y. The grant row exists but is permanently inert — the owner sees no way to know Y still has a row, and Y cannot access the artifact. Clean-up requires admin intervention.

**Fix:** Wrap both operations in `transaction()`:

```typescript
await transaction(async (tx) => {
  const deleted = await tx.query(`DELETE FROM artifact_shares WHERE artifact_id = $1 AND grantee_id = $2 AND owner_id = $3 RETURNING id`, [...]);
  if (deleted.rows.length === 0) throw new ShareNotFoundError();
  const remaining = await tx.query(`SELECT COUNT(*) AS count FROM artifact_shares WHERE artifact_id = $1`, [artifactId]);
  if (Number(remaining.rows[0].count) === 0) {
    await tx.query(`UPDATE artifacts SET visibility = 'PRIVATE', updated_at = now() WHERE id = $1 AND visibility = 'SHARED'`, [artifactId]);
  }
});
```

---

### SEC-3 — Post-ownership-transfer, original owner can still download files

**File:** `src/modules/archive/services/archiveService.ts:154`, `src/modules/archive/utils/contentKey.ts:28`

`verifyContentKeyReference` fast-paths on `keyOwnerId === userId` — if the extracted userId from the content key matches the caller, it only checks their own artifact table. But after `transferOwnership`, the content key namespace `archives/{originalOwnerId}/...` still starts with the original owner's userId. `extractUserId` returns the original owner's id, the caller matches, and the DB query `WHERE a.owner_id = $2` now fails (new owner is different) — so the check correctly rejects it.

**Wait — re-reading:** the query checks `a.owner_id = userId` where `userId = session.userId = originalOwner`. After transfer, `a.owner_id = newOwnerId ≠ originalOwner`. So the version query returns null → throws `InvalidContentKeyError`. **The original owner is correctly blocked.**

However, the original owner can still hit the local storage GET route directly with the content key URL (since the URL is deterministic and stored client-side after any version was ever viewed). The GET route checks `segments[1] !== session.userId` — and `segments[1]` IS the original owner's userId — so the original owner **can still download the raw file bytes** directly via the `/api/storage/local/` URL, bypassing the content-key verification entirely.

**Fix:** The local storage GET route must call `verifyContentKeyReference` for all requests, not just shared-path requests. Ownership check via URL segment is insufficient after ownership transfer.

---

### SEC-4 — Session does not invalidate on user suspension or role change

**File:** `src/lib/session.ts`, `src/modules/auth/services/authService.ts:279`

The session cookie carries `role` and `status` sealed at login time. When an admin:
- **Suspends a user:** the suspended user's session remains valid for up to 7 days. They can continue to access all protected routes.
- **Demotes an admin:** the demoted admin's session still carries `role: "ADMIN"`, granting continued admin access until expiry.

The proxy and `requireAdminSession` read role from the sealed cookie, never from the DB.

**Fix (minimal):** Add a DB lookup in `requireSession` to re-check `status === 'ACTIVE'`. This adds one query per request but is the correct fix.

```typescript
// In requireSession(), after unsealing:
const user = await queryOne('SELECT status, role FROM users WHERE id = $1', [session.userId]);
if (!user || user.status === 'SUSPENDED') throw new UnauthenticatedError();
// Optionally re-derive role from DB to catch demotion
```

Alternatively, maintain a server-side session store (Redis) and invalidate on admin action — but that's a bigger change.

---

### SEC-5 — Password reset token delivered to HTTP response in non-production

**File:** `src/app/api/auth/forgot-password/route.ts:30`

In non-production environments, `{ resetToken: plainToken }` is returned in the JSON response body. This is intentional for dev but the `NODE_ENV` check means **any staging environment that doesn't set `NODE_ENV=production` leaks reset tokens in API responses**. Staging environments are often `NODE_ENV=development` or unset.

**Fix:** Use a separate env flag (`EXPOSE_RESET_TOKEN_IN_RESPONSE=true`) that is explicitly opt-in rather than relying on `NODE_ENV !== 'production'`. Never expose tokens in staging.

---

### SEC-6 — `updateProfile` doesn't refresh the session after email change

**File:** `src/modules/auth/services/authService.ts:406`, `src/app/api/auth/profile/route.ts`

When a user changes their email via `updateProfile`, the iron-session cookie still holds the old email. The session is not re-sealed with the new value. Subsequent `requireSession()` calls return the stale email. Any feature that reads `session.email` (e.g., activity logging, audit log actor display) will show the old email until the user logs out and back in.

**Fix:** After `updateProfile` succeeds in the route handler, re-seal the session with the updated email:
```typescript
session.email = updatedUser.email;
await session.save();
```

---

### SEC-7 — `updateUser` audit log misses role change when both `status` and `role` are patched

**File:** `src/modules/auth/services/authService.ts:319`

The audit action selection is:
```
if status === 'SUSPENDED' → USER_SUSPENDED
else if status === 'ACTIVE' → USER_ACTIVATED  
else → USER_ROLE_CHANGED
```

If an admin passes `{ status: 'ACTIVE', role: 'ADMIN' }` in one call, only `USER_ACTIVATED` is logged. The role promotion to ADMIN is not audited. This is a compliance gap — role escalations must be in the audit trail.

**Fix:** Emit two audit log entries when both fields change, or always log `USER_ROLE_CHANGED` additionally when `payload.role` is present.

---

## Logical Bugs (functional correctness)

### LOG-1 — Bulletin cursor pagination is broken

**File:** `src/modules/bulletin/services/bulletinService.ts:118`

The cursor WHERE clause reduces to `b.created_at < $3` regardless of pinned status. Pinned bulletins are sorted first (`ORDER BY b.pinned DESC, b.created_at DESC`) but the cursor only tracks `created_at`. On page 2, pinned items re-appear if their `created_at` is older than the cursor — and non-pinned items from page 1 can be skipped if they appeared before the first pinned item's `created_at`.

Keyset pagination with a compound sort key (`pinned DESC, created_at DESC`) requires a compound cursor. A single `created_at` cursor is structurally wrong here.

**Fix:** Either use offset pagination for bulletins (acceptable given low volume), or implement a compound cursor: `WHERE (b.pinned < $cursor_pinned) OR (b.pinned = $cursor_pinned AND b.created_at < $cursor_created_at)`.

---

### LOG-2 — `permanentDelete` incorrectly 404s for versionless artifacts

**File:** `src/modules/archive/services/trashService.ts:153`

```typescript
const versions = await query(...); // fetch versions
if (versions.length === 0) {
  const exists = await queryOne(...); // check artifact exists
  if (!exists) throw new TrashItemNotFoundError();
  // Falls through — but the DELETE below will silently succeed for 0 versions
}
```

If `versions.length === 0` and the artifact **does** exist, `exists` is non-null, no error is thrown, and the code falls through to the transaction which deletes the artifact correctly. So actually the 404 only fires when the artifact doesn't exist — which is correct.

**However:** `totalBytes = 0` so storage counter isn't decremented. A versionless artifact has no storage to reclaim, so this is actually fine.

**Actual bug:** `versions.length === 0` + exists check + `permanentDelete` is called via `purgeExpiredTrash` in a loop. If the artifact was already deleted between the `SELECT id` and the `DELETE`, the DELETE returns 0 rows, the outer function throws `TrashItemNotFoundError`, and `purgeExpiredTrash` catches it silently. This is fine.

**Net: this is a false alarm — code is correct.** Marking resolved.

---

### LOG-3 — `sendMessage` emits wrong activity event type

**File:** `src/modules/messaging/services/messagingService.ts:256`

New messages emit `eventType: "ARTIFACT_SHARED"` (reusing the closest available type). The recipient's activity feed displays "shared an artifact" for every message received. This is live and misleading to users today — the activity feed widget shows incorrect labels for all received messages.

**Fix:** Add `MESSAGE_RECEIVED` to the `activity_event_type` enum (via migration) and update `sendMessage` to use it.

---

### LOG-4 — Restore-set-from-trash leaves child artifacts permanently hidden

**File:** `src/modules/archive/services/trashService.ts:124`

`softDeleteSet` cascades `deleted_at = now()` onto all child artifacts. `restoreFromTrash(kind='set')` only clears `deleted_at` on the set row itself — child artifacts remain soft-deleted. The user sees an empty restored set with no indication that artifacts were inside it. There is no bulk-restore mechanism.

This creates a **silent data-visibility trap**: users think they've recovered their work but the content is gone from the UI with no warning.

**Fix:** Either restore child artifacts alongside the set, or show a warning in the trash UI: "Restoring this folder will not restore its contents — restore artifacts individually." Currently neither happens.

---

### LOG-5 — Unread message badge is unreliable on first message

**File:** `src/modules/messaging/services/messagingService.ts:278`, `migrations/0010_messaging.sql:11`

`conversation_members.last_read_at` defaults to `now()` at row insertion time (when `getOrCreateConversation` creates the conversation). The unread query is `m.created_at > me.last_read_at`. For the **receiving user**, `last_read_at` = time they were added to the conversation. Any message sent before they open the thread — but after they were added — is correctly counted as unread.

**The actual edge case:** if the conversation was just created and the first message arrives within the same millisecond as `last_read_at` (practically impossible but theoretically `created_at = last_read_at`), the `>` (not `>=`) comparison would miss it. Negligible in practice.

**Real issue:** after `getOrCreateConversation`, the receiving user has `last_read_at = now()`. The sender immediately sends a message. Since `message.created_at >= last_read_at` (same moment), the `>` condition excludes it. Practically, network latency makes this unlikely, but it's a logical edge case where the first message isn't counted as unread.

**Fix:** Set `last_read_at = 'epoch'` (or `NULL` with a `COALESCE` in the query) for the non-initiating member when creating a conversation.

---

### LOG-6 — `markOverdueAssignments` runs a global UPDATE on every bulletin list call

**File:** `src/modules/bulletin/services/bulletinService.ts:95`

```sql
UPDATE countdown_assignments ca
SET status = 'OVERDUE'
FROM bulletins b
WHERE ca.bulletin_id = b.id AND b.due_at < now() AND ca.status = 'PENDING'
```

This touches all users' countdown assignments on every `GET /api/bulletin` call from any user. With no index on `(ca.status, b.due_at)`, this is a full scan under load. At small scale it's fine; at any real user count it creates write contention on every page load.

**Note:** Not a security issue, but documented here as a known scalability concern to address before high-traffic deployment.

---

## Missing Production Infrastructure (not deferred — required before ship)

### INFRA-1 — No object storage for production

All file storage is local filesystem. Must wire R2, S3, or GCS behind the `storageService` interface before any production deployment. The interface is clean — this is a fill-in-the-blanks task, not a redesign.

### INFRA-2 — No email delivery

Password reset is the only flow requiring email. Must integrate a transactional email provider (Resend, SendGrid, Postmark, etc.) before production. The `requestPasswordReset` service already returns the plain token — the route handler just needs to call the mailer instead of logging.

### INFRA-3 — No HTTP cache headers on any API response

All API responses go out with no `Cache-Control` header, defaulting to browser heuristics. For responses that are safe to cache (e.g., `GET /api/members`, `GET /api/library/sections`, `GET /api/archive/sets`), adding `Cache-Control: private, max-age=30` would reduce DB load significantly. For sensitive responses (session, profile), `Cache-Control: no-store` should be explicit.

### INFRA-4 — `0012_relationships.sql` migration is created but never run

**File:** `migrations/0012_relationships.sql`

The Slice 5 migration file exists but is not in the applied migrations table. Any Slice 5 service code that references `artifact_relationships` will throw a PostgreSQL "relation does not exist" error. Run `npm run migrate` before writing any Slice 5 service code.

### INFRA-5 — No health check endpoint

No `/api/health` or `/api/ping` route exists. Vercel doesn't require one, but any external uptime monitor, load balancer, or future Kubernetes deployment needs it. Trivial to add.

---

## Duplicate Declarations (code hygiene — causes confusion)

| Symbol | Declared in |
|---|---|
| `UserNotFoundError` | `authService.ts` AND `storageService.ts` (separate classes, same code/name) |
| `ForbiddenError` | `session.ts` AND `bulletinService.ts` AND `libraryService.ts` |
| `writeAuditLog` helper | Duplicated in `archiveService.ts`, `authService.ts`, `shareService.ts`, `bulletinService.ts`, `libraryService.ts` |
| `ArtifactNotFoundError` | `archiveService.ts` AND `libraryService.ts` |

None of these cause runtime bugs (they're independent declarations), but they make `instanceof` checks across modules unreliable and make future refactors error-prone. Extract to `src/lib/errors.ts` and `src/lib/audit.ts`.

---

## Summary: What Must Be Fixed Before Any Real User Touches This

| Priority | Issue | File |
|---|---|---|
| 🔴 P0 | Audit trail completely broken for all V2 actions (silent enum mismatch) | `CRIT-1` |
| 🔴 P0 | Activity feed broken for all V2 events (silent enum mismatch) | `CRIT-2` |
| 🔴 P0 | Shared file downloads return 403 for all grantees | `SEC-1` |
| 🔴 P0 | Production storage doesn't work on Vercel | `CRIT-3` |
| 🔴 P0 | No email delivery for password reset | `INFRA-2` |
| 🟠 P1 | Suspended users remain authenticated for up to 7 days | `SEC-4` |
| 🟠 P1 | Original owner can download files after ownership transfer (via direct URL) | `SEC-3` |
| 🟠 P1 | `revokeShare` race condition leaves dangling share rows | `SEC-2` |
| 🟠 P1 | `sendMessage` emits wrong activity type — misleading feed labels | `LOG-3` |
| 🟠 P1 | Set restore leaves child artifacts hidden with no warning | `LOG-4` |
| 🟡 P2 | Bulletin pagination broken with pinned items | `LOG-1` |
| 🟡 P2 | Session email stale after profile email change | `SEC-6` |
| 🟡 P2 | Role escalation not audited when patched alongside status | `SEC-7` |
| 🟡 P2 | Staging envs may leak reset tokens in API response | `SEC-5` |
| 🟡 P2 | First unread message edge case in conversations | `LOG-5` |
| 🔵 P3 | `markOverdueAssignments` is a global write on every list call | `LOG-6` |
| 🔵 P3 | No cache headers on API responses | `INFRA-3` |
| 🔵 P3 | No health check endpoint | `INFRA-5` |
| 🔵 P3 | Duplicate error class declarations across modules | Code hygiene |
