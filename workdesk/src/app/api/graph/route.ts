import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { query } from "@/lib/db";
import { fail } from "@/types/common";

// GET /api/graph
// Returns flat nodes+edges for the D3 canvas floating view.
// Nodes: sets (kind="set") and artifacts (kind="artifact").
// Edges: set→parent_set ("set-parent"), artifact→set ("artifact-set").
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.userId;

    const [sets, artifacts] = await Promise.all([
      query<{ id: string; name: string; parent_id: string | null }>(
        `SELECT id, name, parent_id FROM sets WHERE owner_id = $1 AND deleted_at IS NULL`,
        [userId]
      ),
      query<{ id: string; title: string; type: string; set_id: string | null; visibility: string; set_name: string | null }>(
        `SELECT a.id, a.title, a.type, a.set_id, a.visibility, s.name AS set_name
         FROM artifacts a
         LEFT JOIN sets s ON s.id = a.set_id
         WHERE a.owner_id = $1 AND a.deleted_at IS NULL`,
        [userId]
      ),
    ]);

    const allSetIds = new Set(sets.map(s => s.id));

    const nodes = [
      ...sets.map(s => ({
        id: s.id,
        label: s.name,
        kind: "set" as const,
        parent_id: s.parent_id,
      })),
      ...artifacts.map(a => ({
        id: a.id,
        label: a.title,
        kind: "artifact" as const,
        artifact_type: a.type.toLowerCase(),
        set_id: a.set_id,
        visibility: a.visibility,
        set_name: a.set_name,
      })),
    ];

    const edges = [
      ...sets
        .filter(s => s.parent_id && allSetIds.has(s.parent_id))
        .map(s => ({ source: s.id, target: s.parent_id!, type: "set-parent" as const })),
      ...artifacts
        .filter(a => a.set_id && allSetIds.has(a.set_id))
        .map(a => ({ source: a.id, target: a.set_id!, type: "artifact-set" as const })),
    ];

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    if ((err as { name?: string }).name === "UnauthenticatedError")
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    console.error("[GET /api/graph]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
