# WorkDesk

WorkDesk is the central knowledge platform of **Flex Studios** — permanent institutional memory for the organisation. It lets members create, organise, version, archive, search, and publish work while preserving ownership and full history.

Built as a web platform (PWA). Not an AI product — no built-in assistant, no auto-generated content.

---

## Project Layout

```
WorkDesk/
├── Docs/           Product & technical requirements (PRD v1–v5, TRD, V2 plan)
├── UI/             Stitch design mockups (HTML + PNG per screen) — reference only
├── workdesk/       The Next.js application (everything that runs)
└── mindmap.md      Internal dense context map for the AI assistant
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, React Server Components) |
| UI | React 19, TailwindCSS 4, Tiptap (rich-text editor) |
| Data fetching | TanStack Query v5 |
| Database | PostgreSQL via `pg` (node-postgres) — raw SQL, no ORM |
| Auth | iron-session 8 (sealed cookies), bcryptjs |
| Validation | Zod 4 |
| Storage | Local filesystem (dev); swap storageService for S3/R2 in prod |
| Deployment target | Vercel + hosted Postgres |

> **No Prisma.** It was removed due to version conflicts. The data layer is hand-written SQL with helpers in `src/lib/db.ts`.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally

### Setup

```bash
# 1. Install dependencies
cd workdesk
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL and SESSION_SECRET at minimum

# 3. Apply all migrations
npm run migrate

# 4. Seed the admin user
npm run seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in your `.env.local`.

### Available Commands

All commands run from the `workdesk/` directory.

```bash
npm run dev       # Start dev server (hot reload)
npm run build     # Production build (also runs TypeScript check)
npm run start     # Serve the production build
npm run lint      # ESLint
npm run migrate   # Apply pending SQL migrations
npm run seed      # Seed admin user (idempotent)
```

---

## Environment Variables

Copy `.env.example` to `.env.local`. Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie encryption key — minimum 32 characters |
| `SEED_ADMIN_EMAIL` | Admin account email (used by `npm run seed`) |
| `SEED_ADMIN_PASSWORD` | Admin account password |
| `SEED_ADMIN_NAME` | Admin display name |
| `NEXT_PUBLIC_BASE_URL` | Base URL for local file storage URLs |
| `NODE_ENV` | `development` or `production` |

> **Storage note:** File uploads use the local filesystem in dev (`uploads/` directory). For production, replace `src/lib/storage.ts` with an S3/R2-backed implementation — the public interface (`getPresignedUploadUrl` / `getPresignedDownloadUrl`) stays the same.

---

## Build Phases

| Phase | Status | Scope |
|---|---|---|
| **V1 — Knowledge Archive Foundation** | ✅ Complete | Auth, folders (Sets), documents (Artifacts), immutable versioning, file storage, FTS search, trash, stars, PWA, activity feed, dashboard, admin tools, rich-text editor, version diff |
| **V2 — Collaboration & Library** | ✅ Complete | Artifact sharing, bulletin board, 1:1 messaging, library sections & publishing, artifact relationships, graph view, in-app notifications |
| **V3 — Collaboration Workspace** | 📋 Planned | DMs/groups, comments, mentions, review states, real-time (socket.io), bulk operations |
| **V4 — Operations Hub** | 📋 Planned | Mail hub (Gmail/Outlook), tool dock, Discord share |
| **V5 — Ecosystem** | 📋 Planned | GDrive/GitHub/Figma/Canva imports, developer API + webhooks, backups |

---

## Architecture Principles

These are enforced throughout the codebase (from the TRD):

- **Reference-based sharing** — files are never duplicated. Sharing = a pointer row. Ownership stays with the creator.
- **Immutable history** — versions are append-only. A "restore" creates a new version pointing at the old content key.
- **Ownership preservation** — the creator is always the primary owner. A member leaving must never cause knowledge loss.
- **Modular** — each feature module owns `types.ts`, `schemas.ts`, `services/`, and its hooks/components.
- **Row-level access control** — every query scopes by `ownerId` + `deletedAt IS NULL`, extended by share grants and public visibility as appropriate.

---

## Documentation

Per-feature documentation lives in `workdesk/docs/`:

| Document | Contents |
|---|---|
| [V1 Archive](workdesk/docs/archive-manual-tests.md) | Manual test plan for sets, artifacts, versions, storage |
| [V1 Archive Rollback](workdesk/docs/archive-rollback.md) | Rollback procedures for V1 archive features |
| [V2 Slice 1 — Sharing](workdesk/docs/v2-slice1-sharing.md) | Artifact sharing, SHARED read path |
| [V2 Slice 2 — Bulletin](workdesk/docs/v2-slice2-bulletin.md) | Bulletin board, countdown tasks |
| [V2 Slice 3 — Messaging](workdesk/docs/v2-slice3-messaging.md) | Internal 1:1 messaging |
| [V2 Slice 4 — Library](workdesk/docs/v2-slice4-library.md) | Library sections, artifact publishing |
| [V2 Slice 5 — Graph](workdesk/docs/v2-slice5-graph.md) | Artifact relationships, graph view |
| [V2 Slice 6 — Notifications](workdesk/docs/v2-slice6-notifications.md) | In-app notification inbox |
| [UI Redesign — Editor & Settings](workdesk/docs/ui-redesign-editor-settings.md) | Three-panel editor, settings page, prose styles, toggle animation |

---

## Data Model (summary)

| Model | Description |
|---|---|
| **User** | Email, passwordHash, name, role (`MEMBER`/`ADMIN`), status (`ACTIVE`/`SUSPENDED`) |
| **Set** | A folder. Self-nesting via `parentId`. Owned. Soft-deletable. |
| **Artifact** | A document. Has `type`, `visibility`, JSON `tags`. Optionally in a Set. Soft-deletable. |
| **Version** | Immutable snapshot of an Artifact. `contentKey` points at a stored file. |
| **ArtifactShare** | Per-user share grant. Enables SHARED visibility read path. |
| **Bulletin** | Org-wide announcement or countdown task. |
| **CountdownAssignment** | Per-user assignment on a countdown bulletin. |
| **Conversation / Message** | 1:1 internal messaging with optional artifact references. |
| **LibrarySection** | Named grouping of published artifacts. |
| **LibraryArtifact** | Join row: section ↔ artifact (reference only, never a copy). |
| **LibrarySubscription** | User follows a section. |
| **ArtifactRelationship** | Typed edge between two artifacts (`BELONGS_TO` / `RELATED_TO` / `DERIVED_FROM` / `REPLACES`). |
| **Notification** | In-app inbox row scoped to one recipient. Types: `ARTIFACT_SHARED`, `MESSAGE_RECEIVED`, `BULLETIN_POSTED`, `ARTIFACT_PUBLISHED`. |
| **AuditLog** | Append-only record of critical actions. |
| **ActivityEvent** | User-scoped feed events (creates, shares, bulletins, etc.). |
