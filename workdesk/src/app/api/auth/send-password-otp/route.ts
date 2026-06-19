import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import { sendPasswordChangeCode, OtpRateLimitError } from "@/modules/auth/services/otpService";
import { getUserById, UserNotFoundError } from "@/modules/auth/services/authService";
import { ok, fail } from "@/types/common";

// POST /api/auth/send-password-otp
// Sends a 6-digit OTP to the session user's email for password-change verification.
export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const user    = await getUserById(session.userId);

    await sendPasswordChangeCode(user.id, user.email);
    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    if (err instanceof UserNotFoundError)
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    if (err instanceof OtpRateLimitError)
      return NextResponse.json(fail(err.code, err.message), { status: 429 });
    console.error("[POST /api/auth/send-password-otp]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
