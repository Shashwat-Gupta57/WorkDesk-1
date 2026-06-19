import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmailVerification } from "@/modules/auth/services/otpService";
import { OtpRateLimitError } from "@/modules/auth/services/otpService";
import { ok, fail } from "@/types/common";

const Schema = z.object({ email: z.string().email() });

// POST /api/auth/send-email-otp
// Sends a 6-digit OTP to the given email for pre-signup verification.
// Always returns 200 so email existence is not revealed.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = Schema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", body.error.flatten()), { status: 400 });

    await sendEmailVerification(body.data.email);
    return NextResponse.json(ok(null), { status: 200 });
  } catch (err) {
    if (err instanceof OtpRateLimitError)
      return NextResponse.json(fail(err.code, err.message), { status: 429 });
    console.error("[POST /api/auth/send-email-otp]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
