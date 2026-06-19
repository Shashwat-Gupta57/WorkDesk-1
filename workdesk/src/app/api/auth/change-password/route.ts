import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import {
  changePassword,
  getUserById,
  UserNotFoundError,
  InvalidCurrentPasswordError,
} from "@/modules/auth/services/authService";
import { ChangePasswordSchema } from "@/modules/auth/schemas";
import { sendPasswordChangedConfirmation } from "@/lib/email";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
//
// Allows an authenticated user to update their own password.
// - Session required (401 if missing).
// - Zod validates all three fields and cross-field rules before any DB call.
// - authService.changePassword verifies current password, hashes new one,
//   and writes both the update and audit log inside a single transaction.
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionData = await requireSession();

    const body: unknown = await req.json();
    const parsed = ChangePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    await changePassword(sessionData.userId, currentPassword, newPassword);

    getUserById(sessionData.userId)
      .then(u => sendPasswordChangedConfirmation(u.email))
      .catch(e => console.error("[change-password] confirmation email failed:", e));

    return NextResponse.json(
      ok({ message: "Password updated successfully." }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    }
    if (err instanceof InvalidCurrentPasswordError) {
      return NextResponse.json(fail(err.code, err.message), { status: 400 });
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }

    console.error("[PUT /api/auth/change-password]", err);
    return NextResponse.json(
      fail("INTERNAL_ERROR", "An unexpected error occurred."),
      { status: 500 }
    );
  }
}
