import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { query, queryOne } from "@/lib/db";
import { ok, fail } from "@/types/common";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/archive/relationships
//
// Returns all artifacts the current user can see (own + shared + public) as
// graph nodes, plus every relationship edge between any two of those artifacts.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const userId = session.userId;

    // All artifacts the user can read (owner | shared | public)
    const nodes = await query<{
      id: string;
      title: string;
      type: string;
      visibility: string;
      set_id: string | null;
      set_name: string | null;
      owner_id: string;
      owner_name: string;
      tags: unknown;
    }>(`
      SELECT
        a.id, a.title, a.type, a.visibility, a.set_id,
        s.name AS set_name,
        u.id   AS owner_id,
        u.name AS owner_name,
        a.tags
      FROM artifacts a
      JOIN users u ON u.id = a.owner_id
      LEFT JOIN sets s ON s.id = a.set_id AND s.deleted_at IS NULL
      WHERE a.deleted_at IS NULL
        AND (
          a.owner_id = $1
          OR a.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1 FROM artifact_shares sh
            WHERE sh.artifact_id = a.id AND sh.grantee_id = $1
          )
        )
      ORDER BY a.created_at DESC
    `, [userId]);

    // All relationships where both ends are visible to the user
    const visibleIds = nodes.map((n) => n.id);
    let edges: { id: string; from_id: string; to_id: string; type: string; created_by: string }[] = [];
    if (visibleIds.length > 0) {
      edges = await query<{ id: string; from_id: string; to_id: string; type: string; created_by: string }>(`
        SELECT id, from_id, to_id, type, created_by
        FROM artifact_relationships
        WHERE from_id = ANY($1::uuid[])
          AND to_id   = ANY($1::uuid[])
      `, [visibleIds]);
    }

    return NextResponse.json(ok({ nodes, edges }));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; status?: number };
    if (e.code === "UNAUTHENTICATED") return NextResponse.json(fail(e.code, e.message ?? ""), { status: 401 });
    console.error("[GET /api/archive/relationships]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Failed to load graph data."), { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/archive/relationships — create a relationship between two artifacts
// ─────────────────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  fromId: z.string().uuid(),
  toId:   z.string().uuid(),
  type:   z.enum(["BELONGS_TO", "RELATED_TO", "DERIVED_FROM", "REPLACES"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body: unknown = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });
    }
    const { fromId, toId, type } = parsed.data;

    // User must own the from-artifact to create a relationship from it
    const from = await queryOne<{ owner_id: string }>(`SELECT owner_id FROM artifacts WHERE id = $1 AND deleted_at IS NULL`, [fromId]);
    if (!from) return NextResponse.json(fail("NOT_FOUND", "Artifact not found."), { status: 404 });
    if (from.owner_id !== session.userId && session.role !== "ADMIN") {
      return NextResponse.json(fail("FORBIDDEN", "You can only create relationships from artifacts you own."), { status: 403 });
    }

    const row = await queryOne<{ id: string; from_id: string; to_id: string; type: string; created_by: string; created_at: Date }>(`
      INSERT INTO artifact_relationships (from_id, to_id, type, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (from_id, to_id, type) DO UPDATE SET from_id = EXCLUDED.from_id
      RETURNING *
    `, [fromId, toId, type, session.userId]);

    return NextResponse.json(ok(row), { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "UNAUTHENTICATED") return NextResponse.json(fail(e.code, e.message ?? ""), { status: 401 });
    if (e.code === "FORBIDDEN")       return NextResponse.json(fail(e.code, e.message ?? ""), { status: 403 });
    console.error("[POST /api/archive/relationships]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Failed to create relationship."), { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/archive/relationships?id=<uuid>
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json(fail("VALIDATION_ERROR", "Missing id."), { status: 400 });

    const rel = await queryOne<{ id: string; created_by: string }>(`SELECT id, created_by FROM artifact_relationships WHERE id = $1`, [id]);
    if (!rel) return NextResponse.json(fail("NOT_FOUND", "Relationship not found."), { status: 404 });
    if (rel.created_by !== session.userId && session.role !== "ADMIN") {
      return NextResponse.json(fail("FORBIDDEN", "You can only delete relationships you created."), { status: 403 });
    }

    await query(`DELETE FROM artifact_relationships WHERE id = $1`, [id]);
    return NextResponse.json(ok({ deleted: true }));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "UNAUTHENTICATED") return NextResponse.json(fail(e.code, e.message ?? ""), { status: 401 });
    if (e.code === "FORBIDDEN")       return NextResponse.json(fail(e.code, e.message ?? ""), { status: 403 });
    console.error("[DELETE /api/archive/relationships]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Failed to delete relationship."), { status: 500 });
  }
}
