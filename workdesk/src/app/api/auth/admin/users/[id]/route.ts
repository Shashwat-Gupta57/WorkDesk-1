import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminSession,
  UnauthenticatedError,
  ForbiddenError,
} from "@/lib/session";
import {
  updateUser,
  UserNotFoundError,
  SelfRoleChangeError,
} from "@/modules/auth/services/authService";
import { UpdateUserSchema, UserIdParamSchema } from "@/modules/auth/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/admin/users/[id]
//
// Allows an ADMIN to change a user's status (ACTIVE | SUSPENDED) or
// role (MEMBER | ADMIN).
//
// - Path param [id] is validated as UUID before any DB call.
// - Body validated with Zod (at least one field required).
// - authService.updateUser enforces SelfRoleChange guard + writes audit log.
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const sessionData = await requireAdminSession();

    // Validate the path parameter.
    const resolvedParams = await params;
    const paramParsed = UserIdParamSchema.safeParse(resolvedParams);
    if (!paramParsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Invalid user ID.", paramParsed.error.flatten()),
        { status: 400 }
      );
    }

    const { id: targetUserId } = paramParsed.data;

    // Validate the request body.
    const body: unknown = await req.json();
    const bodyParsed = UpdateUserSchema.safeParse(body);
    if (!bodyParsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Invalid input.", bodyParsed.error.flatten()),
        { status: 400 }
      );
    }

    const updated = await updateUser(
      sessionData.userId,
      targetUserId,
      bodyParsed.data
    );

    return NextResponse.json(ok(updated), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(fail(err.code, err.message), { status: 403 });
    }
    if (err instanceof SelfRoleChangeError) {
      return NextResponse.json(fail(err.code, err.message), { status: 400 });
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json(fail(err.code, err.message), { status: 404 });
    }

    console.error("[PUT /api/auth/admin/users/[id]]", err);
    return NextResponse.json(
      fail("INTERNAL_ERROR", "An unexpected error occurred."),
      { status: 500 }
    );
  }
}
