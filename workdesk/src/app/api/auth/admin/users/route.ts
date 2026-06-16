import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, UnauthenticatedError, ForbiddenError } from "@/lib/session";
import { listAllUsers } from "@/modules/auth/services/authService";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/admin/users
//
// Returns all workspace users as UserSummary[].
// Restricted to ADMIN role — enforced via requireAdminSession().
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminSession();

    const users = await listAllUsers();
    return NextResponse.json(ok(users), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(fail(err.code, err.message), { status: 403 });
    }

    console.error("[GET /api/auth/admin/users]", err);
    return NextResponse.json(
      fail("INTERNAL_ERROR", "An unexpected error occurred."),
      { status: 500 }
    );
  }
}
