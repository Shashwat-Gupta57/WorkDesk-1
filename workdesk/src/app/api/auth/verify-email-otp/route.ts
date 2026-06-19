import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailOtp, OtpInvalidError } from "@/modules/auth/services/otpService";
import { ok, fail } from "@/types/common";

const Schema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6),
});

// POST /api/auth/verify-email-otp
// Verifies the 6-digit OTP for a given email. Returns 200 on success.
// The caller should proceed to create the account immediately after.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = Schema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", body.error.flatten()), { status: 400 });

    await verifyEmailOtp(body.data.email, body.data.otp);
    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    if (err instanceof OtpInvalidError)
      return NextResponse.json(fail(err.code, err.message), { status: 400 });
    console.error("[POST /api/auth/verify-email-otp]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
