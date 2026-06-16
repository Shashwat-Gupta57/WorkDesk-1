# Archive Module — Manual Test Plan

Prerequisites:

1. PostgreSQL running with `DATABASE_URL` set in `.env.local`
2. R2 credentials configured (or placeholders for upload/download signing tests)
3. App running: `npm run dev` from `workdesk/`
4. Seeded admin user: `npx prisma db seed`

Use `curl` or an HTTP client. Save the session cookie from login as `$COOKIE`.

## Setup

```bash
# Login and capture session cookie
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gobitsandbytes.in","password":"ChangeMe@123"}'

export COOKIE="workdesk.session=$(grep workdesk.session cookies.txt | awk '{print $7}')"
```

---

## 1. Sets (Folders)

### 1.1 Create root set

```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/archive/sets \
  -H "Content-Type: application/json" \
  -d '{"name":"Projects"}' | jq
```

**Expected:** `201`, `success: true`, set with `parentId: null`.

### 1.2 Create nested set

```bash
# Replace PARENT_ID with ID from 1.1
curl -s -b cookies.txt -X POST http://localhost:3000/api/archive/sets \
  -H "Content-Type: application/json" \
  -d '{"name":"2026","parentId":"PARENT_ID"}' | jq
```

**Expected:** `201`, child set references parent.

### 1.3 List children

```bash
curl -s -b cookies.txt "http://localhost:3000/api/archive/sets?parentId=PARENT_ID" | jq
```

### 1.4 Get set detail

```bash
curl -s -b cookies.txt "http://localhost:3000/api/archive/sets?id=PARENT_ID" | jq
```

**Expected:** Set metadata, `children` array, `artifacts` array.

### 1.5 Update set (rename + move)

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/sets?id=CHILD_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"2026 Archive"}' | jq
```

### 1.6 Edge: circular reference

```bash
# Try moving parent into its own child — should fail with CIRCULAR_REFERENCE
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/sets?id=PARENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"parentId":"CHILD_ID"}' | jq
```

**Expected:** `400`, `error.code: "CIRCULAR_REFERENCE"`.

### 1.7 Edge: empty update body

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/sets?id=PARENT_ID" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Expected:** `400`, validation error.

### 1.8 Edge: invalid parent

```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/archive/sets \
  -H "Content-Type: application/json" \
  -d '{"name":"Orphan","parentId":"00000000-0000-0000-0000-000000000000"}' | jq
```

**Expected:** `404`, `SET_NOT_FOUND`.

---

## 2. File Upload (R2 Presigned)

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/storage/upload?contentType=application/pdf&filename=report.pdf" | jq
```

**Expected:** `uploadUrl` and `contentKey` (format: `archives/{userId}/{uuid}-report.pdf`).

Save `contentKey` as `$KEY`. Upload a file:

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary @./sample.pdf
```

### Edge: unsupported content type

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/storage/upload?contentType=application/x-malware&filename=bad.exe" | jq
```

**Expected:** `400`, validation error.

---

## 3. Artifacts (Metadata)

### 3.1 Create with initial version

```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/archive/artifacts \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Q1 Report",
    "description":"Quarterly summary",
    "tags":["finance","2026"],
    "type":"PDF",
    "visibility":"PRIVATE",
    "setId":"PARENT_ID",
    "initialFileKey":"CONTENT_KEY_FROM_UPLOAD"
  }' | jq
```

**Expected:** `201`, artifact with `versions[0].versionNumber: 1`.

### 3.2 List artifacts in set

```bash
curl -s -b cookies.txt "http://localhost:3000/api/archive/artifacts?setId=PARENT_ID" | jq
```

### 3.3 Search and tag filter

```bash
curl -s -b cookies.txt "http://localhost:3000/api/archive/artifacts?search=report&tags=finance" | jq
```

### 3.4 Update metadata

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/artifacts?id=ARTIFACT_ID" \
  -H "Content-Type: application/json" \
  -d '{"title":"Q1 Financial Report","visibility":"SHARED"}' | jq
```

### 3.5 Move artifact to root

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/artifacts?id=ARTIFACT_ID" \
  -H "Content-Type: application/json" \
  -d '{"setId":null}' | jq
```

**Expected:** `setId: null` in response.

### 3.6 Edge: foreign content key

```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/archive/artifacts \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad","type":"PDF","initialFileKey":"archives/other-user-id/fake-key"}' | jq
```

**Expected:** `403`, `INVALID_CONTENT_KEY`.

---

## 4. Versions

### 4.1 Commit new version

Upload a second file, then:

```bash
curl -s -b cookies.txt -X POST "http://localhost:3000/api/archive/artifacts/ARTIFACT_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{"contentKey":"NEW_CONTENT_KEY","changeSummary":"Revised figures"}' | jq
```

**Expected:** `201`, `versionNumber: 2`.

### 4.2 Restore historical version

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/artifacts/ARTIFACT_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{"versionNumber":1}' | jq
```

**Expected:** New head version pointing at v1 content key.

### 4.3 Edge: restore missing version

```bash
curl -s -b cookies.txt -X PUT "http://localhost:3000/api/archive/artifacts/ARTIFACT_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{"versionNumber":999}' | jq
```

**Expected:** `404`, `VERSION_NOT_FOUND`.

---

## 5. Download

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/storage/download?contentKey=CONTENT_KEY_FROM_VERSION" | jq
```

**Expected:** `downloadUrl` presigned GET URL.

### Edge: uncommitted upload key (not linked to any version)

```bash
# Request upload URL but do NOT create artifact/version
curl -s -b cookies.txt \
  "http://localhost:3000/api/storage/download?contentKey=ORPHAN_KEY" | jq
```

**Expected:** `403`, not linked to artifacts.

---

## 6. Soft Delete

### 6.1 Delete artifact

```bash
curl -s -b cookies.txt -X DELETE "http://localhost:3000/api/archive/artifacts?id=ARTIFACT_ID" | jq
```

**Expected:** Artifact no longer appears in listings; versions preserved in DB.

### 6.2 Cascade delete set

```bash
curl -s -b cookies.txt -X DELETE "http://localhost:3000/api/archive/sets?id=PARENT_ID" | jq
```

**Expected:** Parent, all nested sets, and contained artifacts soft-deleted.

### 6.3 Edge: double delete

```bash
curl -s -b cookies.txt -X DELETE "http://localhost:3000/api/archive/sets?id=PARENT_ID" | jq
```

**Expected:** `404`, `SET_NOT_FOUND`.

---

## 7. Auth Edge Cases

```bash
# Unauthenticated request
curl -s http://localhost:3000/api/archive/sets | jq
```

**Expected:** `401`, `UNAUTHENTICATED`.

---

## Audit Verification

After operations, inspect audit logs in PostgreSQL:

```sql
SELECT action, "actorId", "targetId", details, "createdAt"
FROM audit_logs
WHERE action LIKE 'SET_%' OR action LIKE 'ARTIFACT_%'
ORDER BY "createdAt" DESC
LIMIT 20;
```

Expected actions: `SET_CREATED`, `SET_UPDATED`, `SET_DELETED`, `ARTIFACT_CREATED`, `ARTIFACT_UPDATED`, `ARTIFACT_VISIBILITY_CHANGED`, `ARTIFACT_DELETED`, `ARTIFACT_VERSION_COMMITTED`, `ARTIFACT_VERSION_RESTORED`.
