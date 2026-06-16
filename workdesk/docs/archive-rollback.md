# Archive Module — Rollback Procedures

This document describes how to recover from failed operations, partial deployments, and data integrity issues in the Archive module.

---

## 1. Database Migration Rollback

### Apply pending migrations

```bash
cd workdesk
npx prisma migrate deploy
```

### Roll back the latest migration (development only)

If a migration introduced the version audit enums or `contentKey` index and must be reverted:

```bash
# Identify the migration folder name under prisma/migrations/
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Manually revert SQL if needed, then re-apply previous state
npx prisma db push --force-reset   # DESTRUCTIVE — dev only
```

**Production:** Never use `--force-reset`. Instead, write a forward migration that drops the index or reverts enum additions:

```sql
-- Example: remove contentKey index
DROP INDEX IF EXISTS "versions_contentKey_idx";

-- Enum values cannot be removed in PostgreSQL without recreating the type.
-- Prefer leaving unused enum values in place.
```

---

## 2. Soft-Delete Rollback (Sets & Artifacts)

Soft deletes set `deletedAt` without removing rows. To restore:

### Restore a single artifact

```sql
UPDATE artifacts
SET "deletedAt" = NULL, "updatedAt" = NOW()
WHERE id = 'ARTIFACT_UUID'
  AND "ownerId" = 'USER_UUID';
```

### Restore a set and its descendants

```sql
-- 1. Collect descendant set IDs (run recursively or use a CTE)
WITH RECURSIVE descendants AS (
  SELECT id FROM sets WHERE id = 'SET_UUID'
  UNION ALL
  SELECT s.id FROM sets s
  INNER JOIN descendants d ON s."parentId" = d.id
)
UPDATE sets SET "deletedAt" = NULL, "updatedAt" = NOW()
WHERE id IN (SELECT id FROM descendants);

-- 2. Restore artifacts in those sets
UPDATE artifacts SET "deletedAt" = NULL, "updatedAt" = NOW()
WHERE "setId" IN (SELECT id FROM descendants);
```

### Verify restoration

```sql
SELECT id, name, "deletedAt" FROM sets WHERE "ownerId" = 'USER_UUID' AND "deletedAt" IS NULL;
SELECT id, title, "deletedAt" FROM artifacts WHERE "ownerId" = 'USER_UUID' AND "deletedAt" IS NULL;
```

---

## 3. Version Ledger Rollback

Versions are append-only. **Do not delete version rows** in normal operations.

### Undo an accidental version commit

Append a corrective version that restores the previous head's `contentKey`:

```bash
curl -b cookies.txt -X PUT "http://localhost:3000/api/archive/artifacts/ARTIFACT_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{"versionNumber": PREVIOUS_VERSION_NUMBER}'
```

### Emergency: remove a corrupt version row (last resort)

Only if the version was committed in error and has no dependents:

```sql
-- Verify this is the latest version
SELECT "versionNumber", "contentKey" FROM versions
WHERE "artifactId" = 'ARTIFACT_UUID'
ORDER BY "versionNumber" DESC;

-- Delete only if confirmed corrupt and no audit/compliance requirement
DELETE FROM versions
WHERE "artifactId" = 'ARTIFACT_UUID' AND "versionNumber" = N;
```

Re-sequence is **not** supported — gaps in `versionNumber` are acceptable.

---

## 4. R2 Object Rollback

R2 objects are referenced by `contentKey` in the `versions` table. Objects are never deleted automatically on soft-delete.

### Orphaned objects (uploaded but never committed)

Keys under `archives/{userId}/` that have no matching `versions.contentKey` are safe to delete:

```sql
-- Find keys in versions for a user
SELECT DISTINCT v."contentKey"
FROM versions v
JOIN artifacts a ON a.id = v."artifactId"
WHERE a."ownerId" = 'USER_UUID';
```

Compare against R2 bucket listing and delete unreferenced keys via Cloudflare dashboard or `aws s3 rm` with R2 endpoint.

### Restore file content after accidental overwrite

Because versions are immutable pointers:

1. Identify the previous `contentKey` from the version history.
2. Request a download URL for that key.
3. If the R2 object still exists, no action needed — restore via API (section 3).
4. If the R2 object was deleted, restore from R2 versioning/backup (enable bucket versioning in Cloudflare for production).

---

## 5. Failed Transaction Recovery

Archive write operations use `db.$transaction()` for:

- Set cascade delete + audit log
- Artifact create + initial version + audit log
- Version commit/restore + audit log

If a transaction fails mid-flight, PostgreSQL rolls back automatically. No manual cleanup is required.

### Detect partial state

```sql
-- Artifact without expected initial version
SELECT a.id, a.title
FROM artifacts a
LEFT JOIN versions v ON v."artifactId" = a.id
WHERE a."deletedAt" IS NULL
GROUP BY a.id
HAVING COUNT(v.id) = 0 AND a.type != 'TEXT';
```

---

## 6. Circular Reference / Move Rollback

If a set move fails with `CIRCULAR_REFERENCE`, no DB change occurs. Retry with a valid `parentId`.

If a bad move somehow persisted (manual SQL), fix:

```sql
UPDATE sets SET "parentId" = 'CORRECT_PARENT_UUID', "updatedAt" = NOW()
WHERE id = 'SET_UUID';
```

---

## 7. Deployment Rollback (Application Code)

```bash
# Revert to previous git revision
git checkout PREVIOUS_TAG

# Reinstall and rebuild
npm ci
npx prisma generate
npm run build

# Restart the process
npm run start
```

Ensure the previous code version is compatible with the current database schema. If new migrations were applied, roll forward with a fix rather than reverting schema.

---

## 8. Audit Trail Recovery

Audit logs are best-effort (failures are logged to console, not thrown). If audit writes failed:

```sql
-- Check for missing audit on recent artifact creates
SELECT a.id, a.title, a."createdAt"
FROM artifacts a
LEFT JOIN audit_logs al ON al."targetId" = a.id AND al.action = 'ARTIFACT_CREATED'
WHERE al.id IS NULL
  AND a."createdAt" > NOW() - INTERVAL '1 day';
```

Manually insert audit rows only for compliance gaps — include `actorId`, `action`, `targetId`, and `details` JSON.

---

## Quick Reference

| Scenario | Action |
|----------|--------|
| Accidental folder delete | SQL soft-delete rollback (section 2) |
| Accidental artifact delete | SQL soft-delete rollback (section 2) |
| Bad version commit | API restore or append corrective version (section 3) |
| Orphan R2 upload | Delete unreferenced key from bucket (section 4) |
| Failed API write | Automatic PG rollback — retry request |
| Bad migration | Forward-fix migration or `migrate resolve` (section 1) |
| Code regression | Git checkout + rebuild (section 7) |
