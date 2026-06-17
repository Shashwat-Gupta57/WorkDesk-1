import { api, ApiError } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Direct-to-R2 upload flow.
//
//   1. Ask the server for a presigned PUT URL + namespaced contentKey.
//   2. PUT the raw file bytes straight to R2 (server never proxies the bytes).
//   3. Return the contentKey, which the caller commits as an artifact version.
//
// NOTE: requires real R2_* env vars on the server. With placeholder creds the
// presigned URL is returned but the PUT in step 2 will fail (no real bucket).
// ─────────────────────────────────────────────────────────────────────────────

interface UploadTicket {
  uploadUrl: string;
  contentKey: string;
  local?: boolean;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export async function uploadFile(file: File): Promise<string> {
  // Step 1 — presigned ticket.
  let ticket: UploadTicket;
  try {
    ticket = await api.get<UploadTicket>("/api/storage/upload", {
      params: {
        contentType: file.type || "application/octet-stream",
        filename: file.name,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) throw new UploadError(err.message);
    throw new UploadError("Could not obtain an upload ticket.");
  }

  // Step 2 — PUT bytes to the upload URL.
  // When local=true the URL is a same-origin API route that requires the session
  // cookie. For R2 presigned URLs credentials must NOT be sent.
  let res: Response;
  try {
    res = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
      ...(ticket.local ? { credentials: "include" } : {}),
    });
  } catch {
    throw new UploadError(
      "Upload to storage failed (network). Is object storage configured?"
    );
  }

  if (!res.ok) {
    throw new UploadError(`Upload to storage failed (HTTP ${res.status}).`);
  }

  // Step 3 — caller commits this key as a version.
  return ticket.contentKey;
}
