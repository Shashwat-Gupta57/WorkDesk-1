import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getPresignedUploadUrl } from "@/lib/storage";
import { buildArchiveContentKey } from "@/modules/archive/utils/contentKey";
import { UploadQuerySchema } from "@/modules/archive/schemas";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/storage/upload
//
// Authenticates session, validates input, and returns a pre-signed URL to
// upload files directly to Cloudflare R2 bucket.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { searchParams } = req.nextUrl;

    const parsed = UploadQuerySchema.safeParse({
      contentType: searchParams.get("contentType"),
      filename: searchParams.get("filename") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid query parameters.", parsed.error.format()), {
        status: 400,
      });
    }

    const key = buildArchiveContentKey(session.userId, parsed.data.filename);
    const uploadUrl = await getPresignedUploadUrl(key, parsed.data.contentType);

    return NextResponse.json(
      ok({
        uploadUrl,
        contentKey: key,
      })
    );
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthenticatedError") {
      return NextResponse.json(fail("UNAUTHENTICATED", "Authentication required."), { status: 401 });
    }
    console.error("[StorageUpload] Failed to generate presigned upload ticket:", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "Internal server error occurred."), { status: 500 });
  }
}
