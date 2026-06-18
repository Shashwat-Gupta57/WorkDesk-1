// ─────────────────────────────────────────────────────────────────────────────
// Storage backend — local filesystem only.
//
// Files land at: <project-root>/uploads/{contentKey}
// e.g.           uploads/archives/{userId}/{uuid}-filename.pdf
//
// Upload URL:   PUT  /api/storage/local/{...key}
// Download URL: GET  /api/storage/local/{...key}
//
// Public surface:
//   getPresignedUploadUrl(key, contentType) → URL the client PUTs bytes to
//   getPresignedDownloadUrl(key)            → URL the client GETs bytes from
// ─────────────────────────────────────────────────────────────────────────────

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export async function getPresignedUploadUrl(
  key: string,
  _contentType: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return `${baseUrl()}/api/storage/local/${key}`;
}

export async function getPresignedDownloadUrl(
  key: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return `${baseUrl()}/api/storage/local/${key}`;
}
