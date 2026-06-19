import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import { verifyPasswordChangeCode, OtpInvalidError } from "@/modules/auth/services/otpService";
import { setPasswordDirectly, getUserById } from "@/modules/auth/services/authService";
import { sendPasswordChangedConfirmation } from "@/lib/email";
import { ok, fail } from "@/types/common";

const Schema = z.object({
  otp:             z.string().length(6),
  newPassword:     z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match.",
  path:    ["confirmPassword"],
});

// POST /api/auth/verify-password-otp
// Verifies OTP then sets the new password. Called from settings when user
// chose "change via OTP" instead of "change via current password".
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();

    const body = Schema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", body.error.flatten()), { status: 400 });

    // 1. Verify OTP (marks it used)
    await verifyPasswordChangeCode(session.userId, body.data.otp);

    // 2. Set new password
    await setPasswordDirectly(session.userId, body.data.newPassword);

    // 3. Send confirmation email (fire-and-forget — don't fail the response)
    getUserById(session.userId)
      .then(u => sendPasswordChangedConfirmation(u.email))
      .catch(e => console.error("[verify-password-otp] confirmation email failed:", e));

    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    if (err instanceof OtpInvalidError)
      return NextResponse.json(fail(err.code, err.message), { status: 400 });
    console.error("[POST /api/auth/verify-password-otp]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
