import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import { query } from "@/lib/db";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/members
// Returns id + name + email for all ACTIVE users (excluding the caller).
// Used by any member to pick assignees, share recipients, etc.
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const members = await query<MemberSummary>(
      `SELECT id, name, email FROM users
       WHERE status = 'ACTIVE' AND id <> $1
       ORDER BY name`,
      [session.userId]
    );
    return NextResponse.json(ok(members));
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    console.error("[GET /api/members]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
