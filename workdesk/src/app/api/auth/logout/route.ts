import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ok } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
//
// Destroys the iron-session cookie unconditionally.
// Always returns 200 — idempotent by design (logging out twice is safe).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  session.destroy();
  return NextResponse.json(ok({ message: "Logged out successfully." }), {
    status: 200,
  });
}
