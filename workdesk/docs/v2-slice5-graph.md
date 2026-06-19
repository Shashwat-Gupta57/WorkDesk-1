# V2 Slice 5 — Artifact Relationships & Graph View

## What Was Built

An interactive knowledge graph that visualises your entire archive as a top-down tree. Artifact owners can link documents with typed relationships (Belongs To, Related To, Derived From, Replaces). The graph is colour-coded by node type, supports hover tooltips with name and tags, double-click navigation, a side panel for single-click preview, and a Team View toggle that reframes the hierarchy under each team member.

**Migration:** `0012_relationships.sql`
**Dependencies added:** `@xyflow/react`
**Commit:** `feat(v2-slice-5): relationships + graph view`

---

## Design Decisions

### Visual system

| Node type | Fill | Border | Icon |
|---|---|---|---|
| Member (team view) | `#2d1f4e` | `#bc8cff` | 👤 |
| Parent set | `#0f2942` | `#58a6ff` | 📁 |
| Subset | `#0e2235` | `#388bfd` | 📂 |
| TEXT artifact | `#0f2a1a` | `#3fb950` | 📝 |
| PDF artifact | `#2d1515` | `#f85149` | 📄 |
| IMAGE artifact | `#2a1f00` | `#d29922` | 🖼️ |
| DOCX artifact | `#0d2035` | `#79c0ff` | 📃 |
| PPTX artifact | `#2a1600` | `#ffa657` | 📊 |
| ZIP artifact | `#1a1a1a` | `#8b949e` | 🗜️ |
| OTHER artifact | `#1c1c1c` | `#6e7681` | 📎 |

Relationship edges are dashed purple (`#bc8cff`) with an arrowhead and animated dash-flow. Hierarchy edges are solid `#30363d`.

### Animation philosophy

**One orchestrated entrance:** nodes draw in top-down with staggered `graphNodeIn` keyframe animation — `delay = depth × 80ms`. Deeper nodes appear after their parents, making the tree feel like it's being revealed rather than dumped on screen. Hover adds a subtle scale+glow. The side panel slides in from the right. No ambient animation when idle.

### Layout algorithm

A custom top-down breadth-first tree layout (`src/components/graph/layout.ts`):
- Post-order leaf assignment: each leaf gets an x position in sequence; parents centre over their children's span.
- Vertical bands: `depth × (NODE_HEIGHT + V_GAP)`, so every level is a distinct horizontal band.
- Self-contained — no external dagre dependency.

---

## Schema

```sql
CREATE TYPE relationship_type AS ENUM ('BELONGS_TO', 'RELATED_TO', 'DERIVED_FROM', 'REPLACES');

CREATE TABLE artifact_relationships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  to_id       UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  type        relationship_type NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id, type),
  CHECK (from_id <> to_id)
);

CREATE INDEX artifact_relationships_from_idx ON artifact_relationships (from_id);
CREATE INDEX artifact_relationships_to_idx   ON artifact_relationships (to_id);
```

---

## Backend

### `relationshipService.ts` (`src/modules/relationships/services/`)

| Function | Behaviour |
|---|---|
| `createRelationship(userId, fromId, toId, type)` | Validates both artifacts are accessible (own/shared/public). Prevents self-loops and duplicates. Inserts via CTE and returns full row with titles and creator name. |
| `deleteRelationship(userId, userRole, relationshipId)` | Relationship creator, from-artifact owner, or ADMIN may delete. |
| `getRelationships(userId, artifactId)` | Returns all edges where `from_id = artifactId` OR `to_id = artifactId`, filtering to only accessible artifacts. |
| `getGraphData(userId, teamView)` | Builds `GraphData { nodes, edges }`. Personal view: own sets + accessible artifacts + relationship edges. Team view: adds member-root nodes and includes sets/artifacts from other members with PUBLIC artifacts. |

### Access model for graph

A user sees a node in the graph if they:
1. Own the artifact, or
2. Have a share grant for the artifact, or
3. The artifact has `visibility = 'PUBLIC'`

Non-accessible artifacts are never included, so the graph is always scoped to what the user can actually open.

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/archive/relationships` | POST | Create relationship (`{ fromId, toId, type }`) |
| `/api/archive/relationships` | DELETE | Delete relationship (`{ relationshipId }` in body) |
| `/api/archive/artifacts/[id]/relationships` | GET | List all relationships for an artifact |
| `/api/archive/graph` | GET | Full graph data (`?teamView=true`) |

---

## Frontend

### Graph page (`src/app/(app)/graph/page.tsx`)

Full-height canvas with a floating toolbar centred at the top.

**Toolbar controls:**
- **Search** — filters visible nodes by label. Non-matching nodes dim to 25% opacity, matching nodes stay full brightness.
- **Team view toggle** — switches the hierarchy from personal (sets → subsets → artifacts) to team-scoped (member → sets → subsets → artifacts). Only members whose PUBLIC artifacts you can see appear as roots.
- **Clear** button (appears when search is active).

**Canvas features:**
- React Flow with `smoothstep` edges, `MiniMap`, `Controls` (zoom/pan/fit), dot grid background.
- `fitView` on initial load centres and scales to fit all nodes.
- **Hover tooltip:** name, type/owner, tags, PUBLIC badge. Appears on mouse-enter, disappears on mouse-leave.
- **Single click → side panel:** slides in from the right with node details (type, owner, visibility, tags) and action buttons.
  - "Open Workspace" (artifacts) or "Open in Archive" (sets/members) — navigates.
  - "Download" — only shown for PUBLIC artifacts the user does not own. Navigates to the artifact workspace where the download flow completes.
- **Double click → navigate:** artifacts route to `/archive/[id]`; sets route to `/archive`.

**Colour-coded MiniMap:** each node type gets the same border colour as its node, making the minimap a readable overview of the knowledge structure.

**Legend** (bottom-left, glassmorphism card): maps all node colours to their type labels.

### Node components (`src/components/graph/graph-nodes.tsx`)

Three custom React Flow node types:
- `MemberNode` — circular avatar with 👤 icon (team view only).
- `SetNode` — rounded rectangle, larger shadow for parent sets vs subsets.
- `ArtifactNode` — compact rectangle with type-specific colour + PUBLIC badge overlay when applicable.

All use invisible `Handle` components at top/bottom for edge connection.

### Layout engine (`src/components/graph/layout.ts`)

Converts `GraphData` (flat node list + edge list) into positioned React Flow nodes with staggered animation delays. Pure function — no side effects.

### RelationshipsPanel (`src/components/archive/relationships-panel.tsx`)

Lives in the artifact workspace's right properties sidebar.

- Lists all relationships (inbound ← and outbound →) with type badge, other artifact title (links to its workspace), and creator name.
- "+ Add" button opens a modal to paste a target artifact UUID and choose a relationship type.
- Each row has a remove (✕) button with a confirmation dialog.
- Relationship type badges are colour-coded (blue/green/amber/red) matching their semantic weight.

### Animations added (`src/app/globals.css`)

| Keyframe | Used by | Effect |
|---|---|---|
| `graphNodeIn` | Every graph node | Fade + scale-up, staggered by depth |
| `tooltipIn` | Hover tooltip | Fast fade + tiny translateY |
| `panelSlideIn` | Side panel | Slide in from right |
| `pageIn` | All app pages | Gentle fade + translateY on route load |

---

## Manual Test Plan

**Prerequisites:** At least one user with sets and artifacts. Run `npm run migrate` first (migration 0012 must be applied).

### Personal graph view

1. Log in → navigate to **Graph** via the sidebar.
2. The graph renders your sets as blue parent nodes. Subsets appear below as slightly smaller blue nodes. Artifacts hang as colour-coded leaves.
3. Hover a node → tooltip appears with its name, type, owner, and tags.
4. Single-click a node → side panel slides in from the right. Verify name, type, visibility, and tags match the artifact's workspace.
5. Click "Open Workspace" in the side panel → navigates to `/archive/[id]`.
6. Double-click a node directly → same navigation without the side panel.
7. Search for an artifact by partial name → non-matching nodes dim. Clear search → all nodes return to full opacity.

### Add a relationship

8. Open any artifact workspace → Properties sidebar → **Relationships** section.
9. Click **+ Add** → choose "Related to" → paste another artifact's UUID (copy from its workspace URL) → click Add.
10. The relationship appears in the list as "→ Related to [other title]".
11. Navigate to **Graph** → a dashed purple edge with arrowhead now connects the two artifacts.

### Remove a relationship

12. In the RelationshipsPanel, hover the relationship row → ✕ appears → click it.
13. Confirm removal. The row disappears. Graph no longer shows the edge.

### Team view

14. Ensure at least one other member has a PUBLIC artifact (publish one from the Library flow).
15. In the Graph, enable **Team view** toggle.
16. The hierarchy gains member-root nodes (purple circles). Each member's sets appear beneath them.
17. Click a PUBLIC artifact from another member → side panel shows "Download" button.
18. Click Download → navigates to that artifact's workspace where download completes.

### MiniMap

19. Pan to an area with many nodes. The MiniMap (bottom-right) shows the full graph with colour-coded dots. Click/drag on the MiniMap to navigate.

### Edge cases

| Scenario | Expected |
|---|---|
| Self-relationship (fromId == toId) | 400 — cannot relate to itself |
| Duplicate relationship (same from/to/type) | 409 — already exists |
| Relate to inaccessible artifact | 404 — not accessible |
| Delete another user's relationship (non-owner, non-admin) | 403 — forbidden |
| Graph with no data | Empty state with link to Archive |

---

## Rollback

1. Drop relationship data: `DELETE FROM artifact_relationships;`
2. Drop table and enum:
   ```sql
   DROP TABLE artifact_relationships;
   DROP TYPE relationship_type;
   ```
3. Remove `@xyflow/react` from `package.json`: `npm uninstall @xyflow/react`
4. Remove `/graph` page and `/api/archive/graph`, `/api/archive/relationships`, `/api/archive/artifacts/[id]/relationships` routes.
5. Remove `RelationshipsPanel` import from the artifact workspace.
6. Remove "Graph" nav entry from sidebar.
7. Remove `/graph` from `PROTECTED_PREFIXES` in `src/proxy.ts`.
8. Remove graph animation keyframes from `globals.css`.
