# CLAUDE.md

Guidance for Claude Code and human contributors working in this repository.

## What WorkDesk Is

WorkDesk is the central knowledge platform of **Flex Studios** — its permanent
institutional memory. It lets members create, organize, version, archive, search, and
publish organizational work while preserving ownership and full history. It is a web
platform (PWA), not an AI product (explicit non-goal: no built-in AI assistant, no
auto-generated content, no replacing external tools).

The product is being built in versioned phases:

- **V1 — Knowledge Archive Foundation** (current focus): auth, folders (Sets), documents
  (Artifacts), immutable versioning, file storage, search, trash.
- **V2 — Collaboration & Library**: messaging, reference-based sharing, public library,
  bulletin/countdowns, relationships, graph view, notifications.
- **V3 — Collaboration Workspace**: DMs, comments, mentions, review states, bulk ops.
- **V4 — Operations Hub**: bulletin, mail hub (Gmail/Outlook), tool dock, Discord share.
- **V5 — Ecosystem**: GDrive/GitHub/Figma/Canva imports, developer API + webhooks, backups.

## Repository Layout

```
WorkDesk/
├── Docs/        Product & technical requirements (PRD v1–v5, TRD) — source of truth for scope
├── UI/          Stitch-generated design mockups (HTML + PNG per screen). REFERENCE ONLY,
│                not wired into the app. Defines the dark-only visual system.
├── workdesk/    The actual Next.js codebase (everything below is relative to here)
└── mindmap.md   Claude's private, dense context map (not human-oriented documentation)
```

### Inside `workdesk/`

```
src/
├── app/
│   ├── api/                Route handlers (the backend)
│   │   ├── auth/           login, logout, session, change-password, admin/users
│   │   ├── archive/        sets, artifacts, artifacts/[id]/versions
│   │   └── storage/        upload (presigned PUT), download (presigned GET)
│   ├── layout.tsx          Root layout (still default scaffold)
│   └── page.tsx            Home page (still Next.js boilerplate — frontend not built yet)
├── lib/
│   ├── db.ts               pg Pool singleton + query/queryOne/transaction helpers (raw SQL)
│   ├── enums.ts            hand-rolled domain enums (replaces @prisma/client)
│   ├── session.ts          iron-session config, requireSession / requireAdminSession
│   └── storage.ts          Cloudflare R2 (S3-compatible) client + presigned URL helpers
├── modules/                Feature modules — each owns its services/schemas/types
│   ├── auth/               types, zod schemas, authService
│   └── archive/            types, zod schemas, archiveService, utils/contentKey
├── types/common.ts         ApiResponse envelope + ok()/fail() helpers
└── proxy.ts                Edge route protection (Next.js 16 "proxy" convention)
migrations/                 Forward-only .sql migrations (0001_baseline.sql = full schema)
scripts/
├── migrate.ts              Applies pending migrations, tracks them in a _migrations table
└── seed.ts                 Seeds the initial admin user from env vars (pg, idempotent)
docs/                       Per-feature manual-test + rollback docs (required by the TRD)
```

> **Implementation status:** the **backend** for Auth and Archive is fully built. Everything
> else from the PRDs (Library, Messaging, Bulletin, Mail Hub, Graph View, Notifications,
> Trash purge, search index, sharing, dashboard) and the **entire frontend** are not yet
> implemented. `page.tsx` is still the create-next-app boilerplate.

## Tech Stack

- **Next.js 16** (App Router, React Server Components) + **React 19** + **TypeScript** (strict, no `any`)
- **TailwindCSS 4** + (planned) shadcn/ui, TanStack Query
- **PostgreSQL** accessed directly via **`pg` (node-postgres)** with hand-written SQL — **no ORM**.
  (Prisma was removed due to version conflicts in this environment.) The data layer lives in
  `src/lib/db.ts` (`query` / `queryOne` / `transaction` helpers); domain enums are hand-rolled
  in `src/lib/enums.ts`. Schema is plain `.sql` in `migrations/`, applied by `scripts/migrate.ts`.
- **iron-session** for sealed cookie sessions; **bcryptjs** for password hashing
- **zod** for all server-side validation
- **Cloudflare R2** (via `@aws-sdk/client-s3`) for file/version object storage
- Deployment target: **Vercel** + hosted Postgres + R2

> ⚠️ **Next.js 16 is not the version most models were trained on.** Per `workdesk/AGENTS.md`,
> read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js-specific
> code, and heed deprecation notices. Notably, edge route protection lives in `src/proxy.ts`
> (the "proxy" convention), not `middleware.ts`.

## Commands

Run all commands from the `workdesk/` directory.

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # run production build
npm run lint         # eslint

npm run migrate      # apply pending .sql migrations from migrations/ (forward-only)
npm run seed         # seed the admin user (needs SEED_ADMIN_* env vars; run after migrate)
```

## Environment

Copy `.env.example` to `.env.local` for local dev (never commit it). Required keys:
`DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `SEED_ADMIN_EMAIL/PASSWORD/NAME`,
`R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME`, `NODE_ENV`.

## Architecture & Conventions

These principles come from the TRD and are enforced throughout the codebase. Preserve them.

- **Reference-based sharing** — files are never duplicated across modules. Sharing transfers
  a reference; ownership stays with the original artifact.
- **Immutable history** — versions are append-only. No version is ever overwritten. A
  "restore" creates a *new* version that points at the old content key (see
  `restoreVersion`).
- **Ownership preservation** — the creator is the primary owner; the org keeps permanent
  archival rights; only admins can transfer ownership. A member leaving must never cause
  knowledge loss.
- **Modular** — each feature module owns its own `types.ts`, `schemas.ts`, and
  `services/`. Keep coupling minimal; no duplicated business logic.

### Request flow (every route handler follows this)

1. `requireSession()` / `requireAdminSession()` — authenticate/authorize (throws typed errors).
2. Validate input with a **zod** schema (`safeParse` on body or query).
3. Call a **service** function (all DB logic lives in `modules/*/services`, never in handlers).
4. Return the shared envelope via `ok(data)` / `fail(code, message, details)`.
5. `catch` maps typed errors to HTTP status codes; anything else → 500 + `console.error`.

### Other rules

- **Auth scoping is row-level.** Archive queries always filter by `ownerId` + `deletedAt: null`.
  There is no separate authz layer yet, and no shared/public read path exists — keep this in
  mind when adding sharing or the library.
- **Multi-write operations use the `transaction(tx => …)` helper** (e.g. create-artifact-with-version,
  password change, version commit/restore, cascading soft-delete).
- **Audit logging never blocks an operation.** `writeAuditLog` swallows its own errors by design.
- **File uploads go directly to R2** via presigned PUT URLs — the server never proxies bytes.
  Flow: request an upload ticket → client `PUT`s to R2 → commit a version with the returned
  `contentKey`. Content keys are namespaced `archives/{userId}/{uuid}-{filename}` and validated
  against path traversal and cross-user access.
- **TypeScript strict, no `any`.** Server-side validation is mandatory.
- **Every feature must ship with manual-test + rollback docs** in `workdesk/docs/` (TRD requirement).

## Data Model (summary)

- **User** — email, passwordHash, name, role (`MEMBER`/`ADMIN`), status (`ACTIVE`/`SUSPENDED`), theme.
- **Set** — a folder; self-nesting via `parentId`; owned; soft-deletable.
- **Artifact** — a document; has `type`, `visibility` (`PRIVATE`/`SHARED`/`PUBLIC`), JSON `tags`;
  optionally lives in a Set; soft-deletable.
- **Version** — immutable snapshot of an Artifact; `versionNumber` unique per artifact;
  `contentKey` points at an R2 object.
- **AuditLog** — append-only record of critical actions (actor, optional target, JSON details).

(Several `AuditAction` enum values and the `SHARED`/`PUBLIC` visibility states are defined in
the schema but not yet emitted/used — they are placeholders for upcoming V2+ features.)

## Working in This Repo

- Treat `Docs/` (PRD/TRD) as the authoritative scope. When a feature is ambiguous, the TRD's
  architecture principles win.
- The `UI/` mockups define the intended look (dark-only: bg `#0D1117`, accent `#58A6FF`,
  Inter font, Linear/Notion/Obsidian/GitHub feel) but are not implementation — build the real
  frontend against them, don't import them.
- Most of the product is still unbuilt. When adding a module, mirror the existing
  `modules/auth` and `modules/archive` structure and the request-flow conventions above.
