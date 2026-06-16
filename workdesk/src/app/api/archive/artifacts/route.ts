import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import {
  createArtifact,
  updateArtifact,
  softDeleteArtifact,
  getArtifacts,
  getArtifactDetails,
  ArtifactNotFoundError,
  SetNotFoundError,
  InvalidContentKeyError,
} from "@/modules/archive/services/archiveService";
import { CreateArtifactSchema, UpdateArtifactSchema, IdParamSchema } from "@/modules/archive/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/archive/artifacts
//
// If `id` parameter is present, retrieves the full details of a specific artifact.
// Otherwise, lists active artifacts filtered by setId, search text, or tags.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    if (id) {
      const idParsed = IdParamSchema.safeParse({ id });
      if (!idParsed.success) {
        return NextResponse.json(fail("BAD_REQUEST", "Invalid ID format."), { status: 400 });
      }
      const artifact = await getArtifactDetails(session.userId, idParsed.data.id);
      return NextResponse.json(ok(artifact));
    }

    const setId = searchParams.get("setId") || null;
    const search = searchParams.get("search") || undefined;
    const tagsParam = searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    // Validate setId if provided and not "root"
    if (setId && setId !== "root") {
      const parsed = IdParamSchema.safeParse({ id: setId });
      if (!parsed.success) {
        return NextResponse.json(fail("BAD_REQUEST", "Invalid setId format."), { status: 400 });
      }
    }

    const artifacts = await getArtifacts(session.userId, setId, tags, search);
    return NextResponse.json(ok(artifacts));
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthenticatedError") {
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    }
    if (err instanceof ArtifactNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }
    console.error("[GET /api/archive/artifacts] Error:", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error occurred."), { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/archive/artifacts
//
// Creates a new artifact metadata entry. Includes version initialization if initialFileKey is set.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body = await req.json();

    const parsed = CreateArtifactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input data.", parsed.error.format()), {
        status: 400,
      });
    }

    const artifact = await createArtifact(session.userId, parsed.data);
    return NextResponse.json(ok(artifact), { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthenticatedError") {
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    }
    if (err instanceof SetNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }
    if (err instanceof InvalidContentKeyError) {
      return NextResponse.json(fail(err.code, err.message), { status: 403 });
    }
    console.error("[POST /api/archive/artifacts] Error:", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error occurred."), { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/archive/artifacts
//
// Updates artifact metadata properties (title, description, tags, visibility, setId).
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    const idParsed = IdParamSchema.safeParse({ id });
    if (!idParsed.success) {
      return NextResponse.json(fail("BAD_REQUEST", "Artifact ID is required and must be a valid UUID."), {
        status: 400,
      });
    }

    const body = await req.json();
    const parsed = UpdateArtifactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input data.", parsed.error.format()), {
        status: 400,
      });
    }

    const artifact = await updateArtifact(session.userId, idParsed.data.id, parsed.data);
    return NextResponse.json(ok(artifact));
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthenticatedError") {
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    }
    if (err instanceof ArtifactNotFoundError || err instanceof SetNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }
    console.error("[PUT /api/archive/artifacts] Error:", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error occurred."), { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/archive/artifacts
//
// Soft-deletes a single artifact. Version indices are preserved in history.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    const idParsed = IdParamSchema.safeParse({ id });
    if (!idParsed.success) {
      return NextResponse.json(fail("BAD_REQUEST", "Artifact ID is required and must be a valid UUID."), {
        status: 400,
      });
    }

    await softDeleteArtifact(session.userId, idParsed.data.id);
    return NextResponse.json(ok({ message: "Artifact soft-deleted successfully." }));
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthenticatedError") {
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    }
    if (err instanceof ArtifactNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }
    console.error("[DELETE /api/archive/artifacts] Error:", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error occurred."), { status: 500 });
  }
}
