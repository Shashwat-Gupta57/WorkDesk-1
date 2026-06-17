import { NextRequest, NextResponse } from "next/server";
import { resetPassword, InvalidResetTokenError } from "@/modules/auth/services/authService";
import { ResetPasswordSchema } from "@/modules/auth/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
//
// Validates the plain reset token + new password, then commits the new hash.
// Token is single-use and expires after 1 hour.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    await resetPassword(parsed.data.token, parsed.data.newPassword);
    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    if (err instanceof InvalidResetTokenError)
      return NextResponse.json(fail(err.code, err.message), { status: 400 });
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
