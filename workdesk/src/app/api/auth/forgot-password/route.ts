import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/modules/auth/services/authService";
import { ForgotPasswordSchema } from "@/modules/auth/schemas";
import { sendPasswordResetEmail } from "@/lib/email";
import { ok, fail } from "@/types/common";

// POST /api/auth/forgot-password
// Generates a 1-hour reset token and emails a reset link to the user.
// Always returns 200 — never reveals whether the email exists.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    const { email } = parsed.data;
    const plainToken = await requestPasswordReset(email);

    if (plainToken) {
      sendPasswordResetEmail(email, plainToken).catch(err =>
        console.error("[forgot-password] email send failed:", err)
      );
    }

    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
