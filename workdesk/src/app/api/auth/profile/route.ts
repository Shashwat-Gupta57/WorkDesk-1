import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import {
  getUserById,
  updateProfile,
  UserNotFoundError,
  EmailAlreadyInUseError,
} from "@/modules/auth/services/authService";
import { UpdateProfileSchema } from "@/modules/auth/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile  — return full SafeUser for the current session
// PUT /api/auth/profile  — update name / email / theme
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const user = await getUserById(session.userId);
    return NextResponse.json(ok(user), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    console.error("[GET /api/auth/profile]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();

    const body: unknown = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()), { status: 400 });

    const user = await updateProfile(session.userId, parsed.data);
    return NextResponse.json(ok(user), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    if (err instanceof UserNotFoundError)
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    if (err instanceof EmailAlreadyInUseError)
      return NextResponse.json(fail(err.code, err.message), { status: 409 });
    console.error("[PUT /api/auth/profile]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
