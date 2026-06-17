# WORKDESK MINDMAP // claude-internal // not-human-doc // dense-recall
# legend: >=children ::=def @=path !=gotcha/risk ?=unbuilt/planned x=immutable-rule ~=approx →=flow ⚠=loophole
# root @c:\Data\Projects\WorkDesk = {Docs/ PRD+TRD-txt, UI/ stitch-mockups-only, workdesk/ = THE-codebase}
# org=Flex Studios. product=WorkDesk = knowledge-archive+collab+org-OS. permanent-institutional-memory. (rebranded from "GoBitsNBytes"; brand mark=F.S monogram @src/components/brand.tsx)

## STACK
next16.2.7(app-router,RSC,react19.2) ts5-strict-no-any tailwind4 postgres+pg(node-postgres,raw-SQL) iron-session8 bcryptjs zod4 @aws-sdk/client-s3(→cloudflare-R2,S3-compat)
# x PRISMA REMOVED (2026-06, version-conflicts in env). data-layer = raw SQL via pg Pool. NO ORM, NO codegen, NO @prisma/*.
# !next16 = "NOT the nextjs you know"(AGENTS.md) read node_modules/next/dist/docs before next-api code.
# DATA-LAYER @src/lib/db.ts: pg Pool singleton(globalThis,dev-hmr-safe) + helpers query<T>(sql,params)→rows, queryOne<T>→row|null, transaction(fn(tx))→BEGIN/COMMIT/ROLLBACK(tx=PoolClient, use tx.query inside). x ALWAYS parameterized $1,$2 — never interpolate.
# ENUMS @src/lib/enums.ts: hand-rolled const-objects+union-types (Role UserStatus ArtifactType Visibility AuditAction) replacing @prisma/client. mirror pg ENUM types in migration.
# ROWS: services define snake_case *Row interfaces, map → camelCase DTOs via to*() helpers. jsonb cols (tags,details) auto-parsed by pg on read; JSON.stringify on write ($n::jsonb).
# MIGRATIONS @workdesk/migrations/*.sql forward-only, runner @scripts/migrate.ts (tracks _migrations table, each file in own txn). 0001_baseline.sql=full schema. cmds: npm run migrate, npm run seed. seed@scripts/seed.ts (pg, ON CONFLICT DO NOTHING, audits only on genuine insert).
# deploy:vercel+pg-host+R2. search:phase1=postgres-FTS(not-yet),phase2=meilisearch?. realtime:socket.io?. graph:react-flow?. redis?=future cache.

## BUILD-STATE (critical: most-PRD=unbuilt)
BUILT: auth-module(full,pg), archive-module(full,pg), storage(presign up/dn). proxy(edge-rbac). sql-schema(0001_baseline). migrate+seed runners. all typecheck clean (tsc --noEmit exit0 post-prisma-removal).
?UNBUILT: frontend(@src/app/page.tsx=NEXTJS-BOILERPLATE-still, layout.tsx=default). Library Messaging Bulletin Countdown MailHub GraphView Notifications Trash Dashboard Search-FTS Sharing Comments Review-workflow PWA. NO react-query NO socket.io NO react-flow installed yet.
# UI/ = stitch HTML+png mockups ONLY, NOT wired. screens: dashboard(desk/tab/mob) shell(desk/tab/mob) archive_explorer(default/list/states) artifact_workspace_editor bulletin library mail_hub messaging graph_view settings_profile production_system. each=code.html+screen.png.

## ROADMAP (PRD versions, 2 doc-sets d1/d2 partly-overlap)
V1=archive-foundation(auth,sets,artifacts,versions,search,trash,storage-quota,star,PWA) ←current-impl-target
V2=collab+library(messaging,artifact-share-by-ref,bulletin,countdown,activity-feed,notifications,visibility,library-sections,relationships,graph,knowledge-packs,subscriptions)
V3=collab-workspace(DM,comments,mentions,review-states,notif-center,bulk-ops)
V4=ops-hub(bulletin,countdown,mail-hub gmail/outlook,tool-dock chatgpt/claude/stitch/canva/figma/github,discord-share)
V5=ecosystem(gdrive,github,figma,canva imports,dev-API+webhooks,backups)
# non-goals(x): NO AI-assistant, NO auto-gen-content, NO replace-external-tools.

## ARCHITECTURE-PRINCIPLES (x=enforce-always)
x REFERENCE-BASED-SHARING: files NEVER duplicated across modules; share=transfer-reference-only; ownership stays w/ origin artifact.
x IMMUTABLE-HISTORY: no version ever overwritten; append-only; restore=NEW-version-node copying old contentKey (see restoreVersion).
x OWNERSHIP: creator=primary-owner; org=permanent-archival-rights; admin=transfer-authority; member-leaving must NOT lose knowledge.
x MODULAR: each module owns own services+schemas+types+ui, minimal coupling, independently-deployable.
x server-side-validation mandatory(zod). db-transactions for critical multi-write ops. no dup business-logic.
VISIBILITY enum: PRIVATE(owner-only) SHARED(explicit-users,?not-impl) PUBLIC(via-library,?not-impl).

## DB-SCHEMA @workdesk/migrations/0001_baseline.sql (postgres, uuid-pk via gen_random_uuid/pgcrypto, snake_case tables+cols)
# NOTE: model defs below use prisma-ish shorthand for brevity but SOURCE-OF-TRUTH is the .sql. pg ENUM types lowercase (role,user_status,artifact_type,visibility,audit_action). FKs: RESTRICT everywhere EXCEPT versions.artifact_id→CASCADE.
enum Role{MEMBER ADMIN} UserStatus{ACTIVE SUSPENDED} Visibility{PRIVATE SHARED PUBLIC}
enum ArtifactType{TEXT PDF DOCX PPTX IMAGE ZIP OTHER}
enum AuditAction{USER_CREATED USER_SUSPENDED USER_ACTIVATED USER_ROLE_CHANGED PASSWORD_CHANGED EMAIL_CHANGED PROFILE_UPDATED OWNERSHIP_TRANSFERRED ARTIFACT_VISIBILITY_CHANGED LIBRARY_SECTION_DELETED SET_DELETED SET_CREATED SET_UPDATED ARTIFACT_CREATED ARTIFACT_UPDATED ARTIFACT_DELETED ARTIFACT_VERSION_COMMITTED ARTIFACT_VERSION_RESTORED}
# !many AuditActions defined but NOT-yet-emitted (EMAIL_CHANGED PROFILE_UPDATED OWNERSHIP_TRANSFERRED LIBRARY_SECTION_DELETED USER_CREATED) = future-hooks.

User{id email!uniq passwordHash name role=MEMBER status=ACTIVE themePreference="dark" createdAt updatedAt}
 >rel: auditLogsActed[AuditActor] auditLogsTargeted[AuditTarget] sets[SetOwner] artifacts[ArtifactOwner] authoredVersions[VersionAuthor]
 >idx: email, [role,status]
Set{id name parentId? ownerId createdAt updatedAt deletedAt?}  # self-nesting via parentId
 >rel: owner(Restrict) parent:Set?(SetParent,Restrict) children:Set[] artifacts:Artifact[]
 >idx: parentId, ownerId. !onDelete=Restrict everywhere (no hard cascade except Version)
Artifact{id title description? tags:Json="[]" type:ArtifactType visibility=PRIVATE ownerId setId? createdAt updatedAt deletedAt?}
 >rel: owner(Restrict) set?(Restrict) versions:Version[]
 >idx: setId ownerId visibility. !tags stored as Json-array → normalizeTags() guards non-array.
Version{id artifactId versionNumber:Int contentKey changeSummary? authorId createdAt}  # contentKey→R2-object-key
 >rel: artifact(Cascade!) author(Restrict)
 >x @@unique([artifactId,versionNumber]) idx: artifactId authorId contentKey. ONLY model w/ onDelete=Cascade(via artifact).
AuditLog{id action:AuditAction actorId targetId? details:Json="{}" createdAt}
 >rel: actor→users(Restrict,FK). targetId=POLYMORPHIC(user|set|artifact) → x NO FK (dropped in migration 0002). idx:[actorId,createdAt] targetId
 # ⚠FIXED-BUG(Slice1): baseline had target_id→users FK; archive audits use set/artifact ids → FK-violation. for folder-create it silently no-op'd (audit swallows err), for artifact-create it aborted the txn → INTERNAL_ERROR. fix=0002 drops the FK + 0001 patched for fresh installs.

## SESSION/AUTH-CORE @src/lib/session.ts
SessionData{userId email name role isLoggedIn} sealed in iron-session cookie "workdesk.session".
cfg: httpOnly, secure=prod, sameSite=lax, maxAge=7d-60s. password=env SESSION_SECRET(>=32char,REQUIRED).
getSession()=cookies()+getIronSession. requireSession()→throws UnauthenticatedError. requireAdminSession()→+ForbiddenError if role!=ADMIN.
err-classes: UnauthenticatedError(code UNAUTHENTICATED) ForbiddenError(FORBIDDEN).
# !session carries role for RBAC w/o db-roundtrip BUT /api/auth/session re-fetches db to catch suspension/role-change since issue.

## EDGE-PROXY @src/proxy.ts (next16 "proxy" convention, NOT middleware.ts)
reads(never-writes) session at edge via readSession()= unsealData<SessionData>(cookie[SESSION_OPTIONS.cookieName], {password}).
# ⚠FIXED-BUG(Slice1): old code used getIronSession(req.cookies as any,...) → at edge runtime NextRequest.cookies ≠ cookie-store shape iron-session's stateful API wants → threw "adapterFn is not a function" on EVERY page load (404+crash). fix=use stateless unsealData (read-only decrypt), try/catch→{} on tampered/expired/rotated cookie. VERIFIED: unsealData compatible w/ what login's getIronSession seals.
PROTECTED_PREFIXES=[dashboard archive library messaging bulletin mail-hub graph-view settings]→login if !auth.
ADMIN_ONLY=[settings/admin]→/dashboard if !admin.
AUTH_ROUTES=[login forgot-password]→/dashboard if already-auth.
redirectToLogin preserves ?from=path. matcher excludes _next/static _next/image favicon.ico api/auth.
# ⚠ proxy only reads; writes happen in login/logout/session handlers. ⚠ `req.cookies as any` cast = type-escape, watch on next-upgrade.
# ⚠ proxy guards PAGE routes by prefix BUT api routes self-guard via requireSession (api/* mostly NOT in matcher except non-auth). VERIFY each new api route calls requireSession itself — proxy ≠ api-guard.

## API-CONVENTIONS
envelope @src/types/common.ts: ApiResponse<T>{success,data?,error?{code,message,details?}}. helpers ok(data) fail(code,msg,details).
pattern/route: try{requireSession→zod.safeParse(body|query)→service-call→ok}catch{map typed-err→status, else 500 INTERNAL_ERROR + console.error}.
status-map: UnauthenticatedError 401, Forbidden 403, *NotFound 404, validation/circular/self-role/bad-current-pw 400, InvalidContentKey/Suspended 403, create 201.
# !err detection mixes `instanceof Class` AND `err.name==="UnauthenticatedError"` (archive routes). keep both styles consistent per-file.

## AUTH-MODULE @src/modules/auth
types: SafeUser(NO passwordHash) UserSummary UpdateUserPayload{status?,role?}. re-exports SessionData.
schemas(zod): LoginSchema(email lc+trim,pw min1) ChangePasswordSchema(new:8-72char,upper+lower+digit; refine new==confirm; refine new!=current) UpdateUserSchema(status|role, >=1) UserIdParamSchema(uuid).
service @services/authService.ts BCRYPT_ROUNDS=12:
 verifyCredentials(email,pw)→x ALWAYS-run-bcrypt-even-if-no-user(dummyHash) anti-timing; vague InvalidCredentialsError anti-enum; suspend-check AFTER cred-check (anti-leak ordering)→SafeUser.
 getUserById→UserNotFoundError. changePassword: verify-current→hash→$transaction{update+audit PASSWORD_CHANGED}.
 listAllUsers→UserSummary[] desc. updateUser: ⚠SelfRoleChangeError(admin can't change own role); $transaction{update + audit USER_SUSPENDED|ACTIVATED|ROLE_CHANGED w/ before/after snapshot}. hashPassword util(seed).
 errs: InvalidCredentials UserSuspended UserNotFound InvalidCurrentPassword SelfRoleChange.
 writeAuditLog: NON-throwing(try/catch swallow) x audit-fail must-not-block-op.

## ARCHIVE-MODULE @src/modules/archive
types: SetSummary SetDetail(+children+artifacts) ArtifactSummary ArtifactDetail(+versions) VersionDetail + Create/Update payloads. CreateArtifactPayload can carry initialFileKey→commits v1 inline.
schemas(zod): CreateSet(name1-100,parentId-uuid?) UpdateSet(>=1) CreateArtifact(title1-255,desc<=1000,tags<=20each1-50,type-enum,vis?,setId?,initialFileKey?,changeSummary<=255) UpdateArtifact(>=1) CommitVersion(contentKey,changeSummary<=255) RestoreVersion(versionNumber:int+) IdParam(uuid) ListSets/Artifacts/Upload/Download querys.
 ALLOWED_UPLOAD_CONTENT_TYPES: pdf docx pptx zip(+x-zip-compressed) text/plain jpeg png gif webp octet-stream.
contentKey @utils/contentKey.ts: x format=`archives/{userId}/{uuid}-{sanitizedFilename}`. buildArchiveContentKey(). assertContentKeyNamespace(userId,key)→⚠rejects ".." "//" + must startWith `archives/{userId}/` (path-traversal+cross-user guard). InvalidContentKeyError(403).
service @services/archiveService.ts (normalizeTags guards Json):
 verifyContentKeyReference(owner,key)= namespace-check + key MUST be referenced by a non-deleted owned artifact-version (⚠blocks downloading uncommitted upload-tickets / orphan keys).
 SETS: createSet(parent-must-be-owned+live) updateSet(⚠CIRCULAR-REF-guard: walk targetParent.parentId chain, reject if hits setId; reject self-parent) softDeleteSet(⚠recursive descendant-collect → $transaction cascade-soft-delete sets+contained-artifacts + audit deletedSetCount) getSets(parentId|"root") getSetDetail(immediate children+artifacts, NO deep-recurse).
 ARTIFACTS: createArtifact($transaction artifact[+optional v1]+audit; assertContentKeyNamespace if initialFileKey) updateArtifact(tags-replace-whole; extra audit ARTIFACT_VISIBILITY_CHANGED if vis-diff) softDeleteArtifact(set deletedAt+audit) getArtifacts(setId|"root"|null; search=title/desc contains insensitive; ⚠tags-filter done IN-MEMORY post-query AND-match-all) getArtifactDetails(+versions desc).
 VERSIONS(x append-only linear ledger): commitVersion(assertNamespace key; $transaction: lastVersion+1 → create → bump artifact.updatedAt → audit COMMITTED) restoreVersion(⚠copies targetVersion.contentKey into NEW head version, never mutates old; audit RESTORED restoredFrom/newNumber).
 errs: SetNotFound ArtifactNotFound VersionNotFound CircularReference InvalidContentKey(re-exported).
 # ⚠ALL queries scope by ownerId+deletedAt:null → ownership=row-level-filter, NOT separate authz layer. cross-user access impossible via these but NO sharing/PUBLIC read-path exists yet.

## STORAGE @src/lib/storage.ts + api/storage
r2Client=S3Client(endpoint=https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com, region="auto"). env: R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME(default "workdesk"). !falls-back to "placeholder-*" if env-missing (won't error loudly).
getPresignedUploadUrl(key,contentType,3600) getPresignedDownloadUrl(key,3600).
→ GET /api/storage/upload?contentType&filename → builds namespaced key → presigned PUT. {uploadUrl,contentKey}.
→ GET /api/storage/download?contentKey → verifyContentKeyReference(owner) → presigned GET. {downloadUrl,contentKey}.
# x client uploads DIRECT to R2 via presigned-PUT (server never proxies bytes). flow→ get-upload-ticket → PUT-to-R2 → commitVersion(contentKey).

## API-ROUTE-MAP @src/app/api
auth/login POST(set-session) | logout POST(destroy,idempotent) | session GET(db-refresh,suspend→destroy+403) | change-password PUT
auth/admin/users GET(admin,list) | auth/admin/users/[id] PUT(admin, status|role)
archive/sets GET(?id=detail | ?parentId list) POST PUT(?id rename/move) DELETE(?id cascade-soft)
archive/artifacts GET(?id=detail | list ?setId&search&tags) POST PUT(?id) DELETE(?id soft)
archive/artifacts/[id]/versions POST(commit) PUT(restore, body.versionNumber)
storage/upload GET | storage/download GET
# !mutations use ?id query-param (not path) EXCEPT versions + admin/users which use [id] path-segment. inconsistent — match per-endpoint.

## SEED @scripts/seed.ts (pg)
insert admin from env SEED_ADMIN_EMAIL/PASSWORD/NAME(default "Administrator"). ON CONFLICT(email) DO NOTHING (won't overwrite); audits USER_CREATED only on genuine insert(fixed dup-audit bug from prisma ver). bcrypt 12. run: npm run seed (after npm run migrate).

## ENV (.env.example)
DATABASE_URL SESSION_SECRET(>=32) SEED_ADMIN_* R2_* NODE_ENV. .env exists(gitignored).

## DOCS @workdesk/docs
archive-manual-tests.md, archive-rollback.md (TRD x requires every feature ship w/ manual-tests+expected+edge+rollback).

## OPEN-LOOPHOLES / WATCH (⚠ when extending)
1. SHARED visibility + sharing-by-reference: enum+rule exist, ZERO impl. no shared-read path, no permission-join table. building = ArtifactShare model + read-path that bypasses ownerId-filter safely.
2. PUBLIC/Library: no LibrarySection model in schema despite TRD domain-model + LIBRARY_SECTION_DELETED audit. add models + public read-path (reference-only x no-dup).
3. Trash/30d-retention + permanent-delete + R2 object-GC: soft-delete sets deletedAt but NOTHING purges R2 objects or rows. orphan-key growth.
4. Storage-quota per-user: PRD wants it, no usage-tracking/enforcement anywhere.
5. tags filter in-memory → won't scale; move to pg jsonb-containment when search-module lands.
6. getArtifacts setId-arg tri-state: null=all, "root"=top-level(setId null), uuid=that-set. easy to misuse.
7. audit writeAuditLog swallows errors → audit-gaps invisible. acceptable per-x but monitor.
8. proxy `as any` cast + api routes not edge-guarded → every new api handler MUST self-call requireSession/requireAdminSession.
9. EMAIL_CHANGED/PROFILE_UPDATED/OWNERSHIP_TRANSFERRED actions declared, no service emits → profile-edit + ownership-transfer endpoints still TODO.
10. no rate-limiting, no CSRF-token (relies sameSite=lax), no forgot-password impl despite /forgot-password route in proxy.
11. realtime/notifications/socket.io: nothing. V2+ notif triggers all unbuilt.
