# WORKDESK MINDMAP // claude-internal // not-human-doc // dense-recall
# legend: >=children ::=def @=path !=gotcha/risk ?=unbuilt/planned x=immutable-rule ~=approx →=flow ⚠=loophole/watch
# root @c:\Data\Projects\WorkDesk = {Docs/ PRD+TRD-txt, UI/ stitch-mockups-only, workdesk/ = THE-codebase}
# org=Flex Studios. product=WorkDesk = knowledge-archive+collab+org-OS. permanent-institutional-memory.

## STACK
next16.2.7(app-router,RSC,react19.2) ts5-strict-no-any tailwind4 tanstack-query-v5 tiptap(rich-text) react-flow?(planned-slice5) postgres+pg(node-postgres,raw-SQL) iron-session8 bcryptjs zod4
# x PRISMA REMOVED (2026-06, version-conflicts). data-layer = raw SQL via pg Pool. NO ORM, NO codegen, NO @prisma/*.
# STORAGE: local filesystem ONLY (dev). env LOCAL_STORAGE_PATH. NO Cloudflare R2 / S3 — removed due to deployment issues.
# !next16 = "NOT the nextjs you know"(AGENTS.md) read node_modules/next/dist/docs before next-api code.
# DATA-LAYER @src/lib/db.ts: pg Pool singleton(globalThis,dev-hmr-safe) + helpers query<T>(sql,params)→rows[], queryOne<T>→row|null, transaction(fn(tx))→BEGIN/COMMIT/ROLLBACK(tx=PoolClient, use tx.query inside). x ALWAYS parameterized $1,$2 — never interpolate.
# ENUMS @src/lib/enums.ts: hand-rolled const-objects+union-types (Role UserStatus ArtifactType Visibility AuditAction BulletinType CountdownStatus) replacing @prisma/client. mirror pg ENUM types in migrations.
# ROWS: services define snake_case *Row interfaces, map→camelCase DTOs via rowTo*() helpers. jsonb cols (tags,details) auto-parsed by pg; JSON.stringify on write.
# MIGRATIONS @workdesk/migrations/*.sql forward-only, runner @scripts/migrate.ts (tracks _migrations table, each in own txn). npm run migrate. npm run seed (seed admin from SEED_ADMIN_* env vars, ON CONFLICT DO NOTHING).
# deploy target: Vercel + hosted Postgres. search: postgres-FTS(built). realtime: none in V2 (V3+ socket.io). graph: react-flow (Slice 5).

## BUILD-STATE (2026-06, post-V2-Slice-6 + UI-redesign)
BUILT-BACKEND: auth(full), archive(sets/artifacts/versions/search/FTS/trash/stars/storage-quota/ownership), storage(local-FS presign-like), sharing(artifact_shares,shareService), bulletin(bulletins+countdown_assignments,bulletinService), messaging(conversations+messages,messagingService), library(library_sections+artifacts+subscriptions,libraryService), activity(activityService), relationships(relationshipService+graph-data), notifications(notificationService+table), members-list-api. Proxy(edge-RBAC). All 14 migrations applied. typecheck clean.
BUILT-FRONTEND: auth(login/forgot-pw/reset-pw), dashboard(activity+starred+quick-open widgets), archive(explorer,workspace/[id] THREE-PANEL-REDESIGN,shared,starred,trash), bulletin, messaging(two-pane), library(section-grid+detail), graph-view(react-flow full impl), profile/settings(FULL-SETTINGS-PAGE 5-tabs), settings(account+admin). Sidebar(all V2 nav+unread-badge). PWA manifest.
?UNBUILT: V3+ (comments,mentions,review,real-time). V4+ (mail-hub,tool-dock). V5+ (external imports,API).

## ROADMAP
V1=archive-foundation ← COMPLETE (auth,sets,artifacts,versions,search,trash,storage-quota,stars,PWA,activity-feed,dashboard,admin,rich-text-editor,version-diff)
V2=collab+library ← COMPLETE (all 6 slices done)
  Slice1 DONE: artifact-sharing, SHARED read path, share-dialog, "Shared with me" page
  Slice2 DONE: bulletin board, countdown tasks, progress bars, mark-complete, admin pin/delete
  Slice3 DONE: 1:1 messaging, conversation list, thread pane, unread badge, artifact-ref cards
  Slice4 DONE: library sections, publish/unpublish artifacts (visibility=PUBLIC), subscribe, section detail, sidebar Library nav, Published badge in explorer
  Slice5 DONE: artifact_relationships table+service, graph view (react-flow, full impl at /graph-view)
  Slice6 DONE: notifications table (0014)+service, graph view polish
UI-REDESIGN DONE (v0.3+): artifact editor three-panel layout, settings page 5-tab redesign, vertical formatting toolbar, ProseMirror prose styles, animated toggles, heading bug fix
V3=collab-workspace(DM-groups,comments,mentions,review-states,real-time/socket.io,bulk-ops)
V4=ops-hub(mail-hub gmail/outlook,tool-dock,discord-share)
V5=ecosystem(gdrive,github,figma,canva imports,dev-API+webhooks,backups)
# non-goals(x): NO AI-assistant, NO auto-gen-content, NO replace-external-tools.

## ARCHITECTURE-PRINCIPLES (x=enforce-always)
x REFERENCE-BASED-SHARING: files NEVER duplicated; share=pointer-row only; ownership never changes via share.
x IMMUTABLE-HISTORY: versions append-only; restore=NEW version copying old contentKey.
x OWNERSHIP: creator=primary-owner; org=permanent-archival-rights; admin=transfer-authority only; member-leaving must NOT lose knowledge.
x MODULAR: each module owns services+schemas+types+hooks+components. minimal coupling.
x server-side-validation mandatory(zod safeParse). db-transactions for critical multi-write ops. no dup business-logic in handlers.
VISIBILITY: PRIVATE(owner-only) → SHARED(per artifact_shares grant) → PUBLIC(via library_artifacts, any authed member reads).
READ-PATH: getArtifactDetails(userId,id,allowShared=false) — owner OR SHARED(JOIN artifact_shares) OR PUBLIC(visibility='PUBLIC'). allowShared=true on artifact detail+content routes.

## DB-SCHEMA (migrations 0001-0014, postgres, uuid-pk, snake_case)
# Migration files: 0001_baseline 0002_audit_target_polymorphic 0003_stars_fts 0004_trash_storage 0005_password_reset 0006_activity 0007_fts_content 0008_sharing 0009_bulletin 0010_messaging 0011_library 0012_relationships 0013_user_phone 0014_notifications — ALL APPLIED

### Core (0001)
enum Role{MEMBER ADMIN} UserStatus{ACTIVE SUSPENDED} Visibility{PRIVATE SHARED PUBLIC}
enum ArtifactType{TEXT PDF DOCX PPTX IMAGE ZIP OTHER}
enum AuditAction{USER_CREATED USER_SUSPENDED USER_ACTIVATED USER_ROLE_CHANGED PASSWORD_CHANGED EMAIL_CHANGED PROFILE_UPDATED OWNERSHIP_TRANSFERRED ARTIFACT_VISIBILITY_CHANGED LIBRARY_SECTION_DELETED SET_DELETED SET_CREATED SET_UPDATED ARTIFACT_CREATED ARTIFACT_UPDATED ARTIFACT_DELETED ARTIFACT_VERSION_COMMITTED ARTIFACT_VERSION_RESTORED BULLETIN_CREATED BULLETIN_DELETED BULLETIN_PINNED COUNTDOWN_COMPLETED}
User{id email!uniq passwordHash name role=MEMBER status=ACTIVE themePreference="dark" createdAt updatedAt}
Set{id name parentId? ownerId createdAt updatedAt deletedAt?}
Artifact{id title description? tags:Json="[]" type visibility=PRIVATE ownerId setId? createdAt updatedAt deletedAt?}
Version{id artifactId versionNumber:Int contentKey changeSummary? authorId createdAt} # x unique(artifactId,versionNumber); onDelete=Cascade via artifact
AuditLog{id action actorId targetId? details:Json createdAt} # targetId POLYMORPHIC (no FK, 0002 fix)

### V1 additions (0003-0007)
Star{id userId artifactId-or-setId? targetType createdAt} # stars on artifacts+sets
StorageQuota{userId usedBytes limitBytes}
PasswordResetToken{id userId token expiresAt usedAt?}
ActivityEvent{id userId type:ActivityEventType targetId? targetTitle? details:Json createdAt}
# ArtifactFtsContent{artifactId content tsvector} — FTS content index for TEXT artifacts (0007)
# search_vector GENERATED ALWAYS AS tsvector on messages.body (0010)

### V2 additions (0008-0011)
ArtifactShare{id artifactId→artifacts(CASCADE) ownerId granteeId createdAt; UNIQUE(artifactId,granteeId); CHECK owner<>grantee}
BulletinType enum{ANNOUNCEMENT COUNTDOWN} CountdownStatus enum{PENDING COMPLETED OVERDUE INCOMPLETE}
Bulletin{id authorId type title body dueAt? pinned=false createdAt updatedAt}
CountdownAssignment{id bulletinId userId status=PENDING completedAt?; UNIQUE(bulletinId,userId)}
Conversation{id createdAt updatedAt}
ConversationMember{conversationId userId joinedAt lastReadAt?; PK(conversationId,userId)}
Message{id conversationId senderId body(<=4000) artifactRefId? createdAt editedAt?; search_vector GENERATED tsvector GIN-indexed}
LibrarySection{id name(<=100) description(<=500)? createdBy createdAt updatedAt}
LibraryArtifact{id sectionId→CASCADE artifactId→CASCADE addedBy addedAt; UNIQUE(sectionId,artifactId)}
LibrarySubscription{userId sectionId createdAt; PK(userId,sectionId)}

### Slice 5 (0012 — APPLIED)
relationship_type enum{BELONGS_TO RELATED_TO DERIVED_FROM REPLACES}
ArtifactRelationship{id fromId toId type createdBy createdAt; UNIQUE(fromId,toId,type); CHECK from<>to; idx on from_id+to_id}

### Slice 6 (0013-0014 — APPLIED)
User.phone column added (0013)
notification_type enum{ARTIFACT_SHARED MESSAGE_RECEIVED BULLETIN_POSTED ARTIFACT_PUBLISHED}
Notification{id userId→CASCADE type title body meta:JSONB is_read=false createdAt; idx(userId,is_read,createdAt DESC)}

## MODULES & SERVICES @src/modules/

### auth @modules/auth
authService: verifyCredentials(anti-timing dummy-hash) getUserById changePassword(verify→hash→tx{update+audit}) listAllUsers updateUser(⚠SelfRoleChangeError) hashPassword.
errs: InvalidCredentials UserSuspended UserNotFound InvalidCurrentPassword SelfRoleChange.

### archive @modules/archive
archiveService: verifyContentKeyReference(owner-or-shared-or-PUBLIC) SETS(createSet,updateSet[circular-ref-guard],softDeleteSet[recursive-cascade-tx],getSets,getSetDetail) ARTIFACTS(createArtifact,updateArtifact[vis-diff-audit],softDeleteArtifact,getArtifacts[FTS-search],getArtifactDetails[+allowShared]) VERSIONS(commitVersion,restoreVersion[x-append-only-copies-contentKey]).
shareService: shareArtifact(resolve-grantee→promote-vis-SHARED→tx{insert-share+audit+activity}) revokeShare(delete-row,revert-to-PRIVATE-if-no-grants) listShareGrants listSharedWithMe canReadSharedArtifact.
starService: toggleStar listStarred getStarredIds.
trashService: listTrash restoreFromTrash permanentDelete(+storage-GC).
ownershipService: transferOwnership.
storageService: getUploadUrl getDownloadUrl (local FS, NOT R2).
contentKey @utils/contentKey.ts: format=`archives/{userId}/{uuid}-{filename}`. assertContentKeyNamespace(path-traversal guard). extractUserId(key)→userId|null (parses for shared content-key verification).

### bulletin @modules/bulletin
bulletinService: listBulletins(+markOverdueAssignments best-effort sweep) createBulletin(tx: bulletin+assignments+audit+activity) getBulletin markComplete deleteBulletin(author-or-admin) pinBulletin(admin-only).

### messaging @modules/messaging
messagingService: getOrCreateConversation(1:1 by COUNT=2 member check) listConversations(+unread_count via last_read_at) getConversation(cursor-paginated,marks-read) sendMessage(validate-membership,tx{insert+bump-updated_at}) totalUnreadCount.

### library @modules/library
libraryService: listSections(COUNT artifact/subscriber,EXISTS is_subscribed) createSection(CTE-INSERT+JOIN) deleteSection(creator-or-admin) getSectionArtifacts publishArtifact(tx{visibility=PUBLIC+library_artifacts+audit}) unpublishArtifact(delete-row,revert-PRIVATE-if-last) subscribeSection unsubscribeSection getSubscriptions getArtifactSections.

### activity @modules/activity
activityService: emitActivityEvent(non-blocking,best-effort) getFeed(userId,limit) getRecentlyOpened recordOpen.
ActivityEventType includes: ARTIFACT_CREATED ARTIFACT_UPDATED SET_CREATED BULLETIN_POSTED COUNTDOWN_ASSIGNED COUNTDOWN_COMPLETED ARTIFACT_SHARED.

## STORAGE @src/modules/archive/services/storageService.ts
Local filesystem ONLY. Path from env LOCAL_STORAGE_PATH (defaults to workdesk/.local-storage/).
getUploadUrl(userId,filename,contentType) → {uploadUrl (POST to /api/storage/local/[...path]), contentKey}.
getDownloadUrl(contentKey) → verifyContentKeyReference → {downloadUrl (GET /api/storage/local/[...path])}.
/api/storage/local/[...path]: POST=write file, GET=stream file. Validates session+contentKey namespace on both.
# x NO Cloudflare R2. NO @aws-sdk/client-s3 dependency in active code. S3 refs removed.

## SESSION/AUTH-CORE @src/lib/session.ts
SessionData{userId email name role isLoggedIn} iron-session cookie "workdesk.session". httpOnly,secure=prod,sameSite=lax,maxAge~7d.
requireSession()→UnauthenticatedError. requireAdminSession()→+ForbiddenError.

## EDGE-PROXY @src/proxy.ts (NOT middleware.ts — next16 "proxy" convention)
stateless unsealData (read-only decrypt at edge). try/catch→{} on bad cookie.
PROTECTED_PREFIXES: dashboard archive library messaging bulletin settings graph-view.
ADMIN_ONLY: settings/admin. AUTH_ROUTES: login forgot-password → /dashboard if authed.
# ⚠ proxy guards PAGE routes only. EVERY api route must self-call requireSession.

## API-CONVENTIONS
envelope @src/types/common.ts: ApiResponse<T>{success,data?,error?{code,message,details?}}. ok(data) fail(code,msg,details).
pattern: requireSession→zod.safeParse→service→ok | catch{typed-err→status,else 500}.
status: 401=Unauthenticated 403=Forbidden/Suspended/InvalidContentKey 404=*NotFound 400=validation/circular/bad-pw 201=create.
api-client @src/lib/api-client.ts: api.get/post/put/delete/deleteWithBody. throws ApiError{code,message,status}.

## API-ROUTE-MAP @src/app/api/
auth/login POST | logout POST | session GET | change-password PUT | profile GET/PUT | forgot-password POST | reset-password POST
auth/admin/users GET/POST | auth/admin/users/[id] PUT | auth/admin/audit-logs GET
archive/sets GET/POST/PUT/DELETE | archive/artifacts GET/POST/PUT/DELETE | archive/ownership PUT
archive/artifacts/[id]/versions POST(commit) PUT(restore) | archive/artifacts/[id]/content GET(presigned-download)
archive/artifacts/[id]/share GET(list-grants) POST(grant) DELETE(revoke,body={granteeId})
archive/shared GET(list-shared-with-me) | archive/stars GET/POST/DELETE | archive/trash GET/PUT/DELETE
bulletin GET/POST | bulletin/[id] GET/PUT(pin)/DELETE | bulletin/[id]/complete POST
library/sections GET/POST | library/sections/[id] GET(artifacts)/DELETE(section)
library/sections/[id]/artifacts POST(publish)/DELETE(unpublish,body={artifactId})
library/sections/[id]/subscribe POST/DELETE | library/artifact-sections GET(?artifactId=)
messaging/conversations GET/POST | messaging/conversations/[id] GET | messaging/conversations/[id]/messages POST
messaging/unread GET({count}) | members GET(active-users-excl-self)
storage/upload GET | storage/download GET | storage/local/[...path] GET/POST | storage/usage GET
activity/feed GET | activity/recently-opened GET | activity/record-open POST

## FRONTEND PAGES @src/app/(app)/
dashboard/page.tsx — activity feed + starred artifacts + recent opens + bulletin/countdown widgets
archive/page.tsx — Explorer (sets+artifacts, grid/list, search, star, new set/artifact, upload)
archive/[id]/page.tsx — THREE-PANEL WORKSPACE: [200px left nav: back+Document/VersionHistory+history-list] | [36px vertical format toolbar] | [flex-1 canvas: large-title-input+frameless-Tiptap] | [260px metadata: type/visibility/owner/dates/versions/tags/description/actions]. Save draft + Commit in top bar. CommitModal for named versions. No "Edit info" modal — all metadata inline.
archive/shared/page.tsx — "Shared with me" list
archive/starred/page.tsx — Starred artifacts/sets
archive/trash/page.tsx — Soft-deleted items, restore + permanent-delete
bulletin/page.tsx — BulletinCard grid, create-bulletin-dialog, mark-complete, admin pin/delete
messaging/page.tsx — ConversationList aside + ThreadPane (Suspense-wrapped for useSearchParams)
library/page.tsx — Section cards (subscribe toggle, delete) + section detail (artifact list)
graph-view/page.tsx — Full react-flow graph (nodes=artifacts+sets+members, edges=hierarchy+relationships, tooltip, side panel, search, team-view toggle, legend)
profile/page.tsx — FULL SETTINGS PAGE 5-tab layout: Profile(name/email/role/status) | Security(change-pw+strength-meter) | Appearance(theme-selector+date-format) | Notifications(toggles+localStorage+desktop-permission) | Account(sign-out+danger-zone)
settings/page.tsx — Admin: user list, suspend/activate/role, audit log

## SIDEBAR @src/components/shell/sidebar.tsx
Nav: Dashboard | Bulletin | Messages(+unread-badge) | Library | Archive | Shared with me | Starred | Trash | Settings | Profile
unreadCount from useUnreadCount(30s refetchInterval).
Active-state: exact match OR prefix-match; deeperActive suppression prevents /archive and /archive/shared both appearing active simultaneously.

## UI PRIMITIVES @src/components/ui/
Button(primary/secondary/ghost/danger) Modal Confirm(external busy+error props) Field/Input/Textarea/Select
LoadingState EmptyState(title+hint+action) ErrorState states.tsx
StorageUsageBar VersionTimeline DiffViewer

## EDITOR COMPONENTS @src/components/archive/
RichTextEditor — FRAMELESS Tiptap editor. Props: initialContent onSave saving readOnly? onChange? onSaveDraftReady? onEditorReady?. Exports: RichTextEditor EditorToolbar CommitModal RichTextViewer.
EditorToolbar — vertical flex-col toolbar with lucide icons. Receives Editor instance from parent. onMouseDown preventDefault keeps ProseMirror selection. No .focus() in chains (fixes heading-applies-to-wrong-block bug).
CommitModal — dialog with optional changeSummary input. Called by page toolbar Commit button.
TagPicker — inline tag add/remove, saves via useUpdateArtifact on each change.

## GLOBALS.CSS ADDITIONS
ProseMirror prose styles (scoped .ProseMirror): h1/h2/h3 sizes, paragraphs, bold/italic/strike, inline-code, code-block, blockquote, hr, ul/ol/li, task-list with checkboxes, links, selection highlight.
Toggle animation: .toggle-track (200ms ease, ON=glow ring), .toggle-thumb (280ms cubic-bezier(0.34,1.56,0.64,1) spring + :active squash to 22px).

## KNOWN WATCH-ITEMS (⚠)
1. Storage is LOCAL-FS only. For prod deployment, a real object store (R2/S3/GCS) must be wired back in behind the storageService interface. contentKey format stays same.
2. Messaging has no real-time (no WebSocket). Polling at 15-30s intervals via TanStack Query. V3 adds socket.io.
3. Notifications table+service built (0014 applied). Frontend bell/inbox not yet wired to the notification row data — services emit rows but UI only shows static count badge.
4. Library deleteSection does not yet send LIBRARY_SECTION_DELETED notifications to affected artifact owners (backfill when notification inbox UI is built).
5. tags filter in-memory in getArtifacts — won't scale; move to pg jsonb-containment when search module lands.
6. proxy `req.cookies as any` cast — type-escape, watch on next-upgrade.
7. audit writeAuditLog swallows errors — audit-gaps invisible, acceptable per-x but monitor.
8. No rate-limiting, no CSRF token (relies sameSite=lax).
9. Knowledge Packs (is_pack flag on library_sections) not yet added — deferred to V3+.
10. EditorToolbar headings are block-level (ProseMirror behavior) — they apply to the block containing the cursor, not a text selection. This is correct but may surprise users expecting inline-style behavior.
