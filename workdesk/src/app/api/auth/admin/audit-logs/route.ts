import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, UnauthenticatedError, ForbiddenError } from "@/lib/session";
import { listAuditLogs } from "@/modules/auth/services/authService";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/admin/audit-logs?limit=100
//
// Admin-only. Returns recent audit log entries joined with actor info.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminSession();

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 100;

    const logs = await listAuditLogs(limit);
    return NextResponse.json(ok(logs), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    if (err instanceof ForbiddenError)
      return NextResponse.json(fail(err.code, err.message), { status: 403 });
    console.error("[GET /api/auth/admin/audit-logs]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
