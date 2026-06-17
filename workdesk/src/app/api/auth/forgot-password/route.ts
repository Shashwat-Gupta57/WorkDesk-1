import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/modules/auth/services/authService";
import { ForgotPasswordSchema } from "@/modules/auth/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
//
// Accepts an email, generates a hashed reset token (1 h TTL), and returns the
// plain token in dev mode (logs it). In production a mailer would send the link.
//
// Always returns 200 regardless of whether the email exists — prevents
// user-enumeration attacks.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    const plainToken = await requestPasswordReset(parsed.data.email);

    if (plainToken && process.env.NODE_ENV !== "production") {
      console.log(`[forgot-password] reset token for ${parsed.data.email}: ${plainToken}`);
    }

    // Return the token in dev only — in production this would be sent via email.
    const devPayload = process.env.NODE_ENV !== "production" && plainToken
      ? { resetToken: plainToken }
      : undefined;

    return NextResponse.json(ok(devPayload ?? null), { status: 200 });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
