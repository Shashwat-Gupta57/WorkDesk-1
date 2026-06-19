import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { ok, fail } from "@/types/common";
import { CreateRelationshipSchema, DeleteRelationshipSchema } from "@/modules/relationships/schemas";
import {
  createRelationship,
  deleteRelationship,
  RelationshipNotFoundError,
  ArtifactNotAccessibleError,
  DuplicateRelationshipError,
  SelfRelationshipError,
  ForbiddenError,
} from "@/modules/relationships/services/relationshipService";

// POST /api/archive/relationships — create a relationship between two artifacts
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = CreateRelationshipSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    const { fromId, toId, type } = parsed.data;
    const rel = await createRelationship(session.userId, fromId, toId, type);
    return NextResponse.json(ok(rel), { status: 201 });
  } catch (err) {
    if (err instanceof SelfRelationshipError) return NextResponse.json(fail(err.code, err.message), { status: 400 });
    if (err instanceof ArtifactNotAccessibleError) return NextResponse.json(fail(err.code, err.message), { status: 404 });
    if (err instanceof DuplicateRelationshipError) return NextResponse.json(fail(err.code, err.message), { status: 409 });
    if (err instanceof ForbiddenError) return NextResponse.json(fail(err.code, err.message), { status: 403 });
    if ((err as { name?: string }).name === "UnauthenticatedError") return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    console.error("[POST /api/archive/relationships]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

// DELETE /api/archive/relationships — delete a relationship
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = DeleteRelationshipSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    await deleteRelationship(session.userId, session.role, parsed.data.relationshipId);
    return NextResponse.json(ok(null));
  } catch (err) {
    if (err instanceof RelationshipNotFoundError) return NextResponse.json(fail(err.code, err.message), { status: 404 });
    if (err instanceof ForbiddenError) return NextResponse.json(fail(err.code, err.message), { status: 403 });
    if ((err as { name?: string }).name === "UnauthenticatedError") return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    console.error("[DELETE /api/archive/relationships]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
