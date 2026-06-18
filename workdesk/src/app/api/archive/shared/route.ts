import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import { ok, fail } from "@/types/common";
import { listSharedWithMe } from "@/modules/sharing/services/shareService";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/archive/shared
// Returns artifacts that other users have shared with the current user.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const items = await listSharedWithMe(session.userId);
    return NextResponse.json(ok(items), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    console.error("[GET /api/archive/shared]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
