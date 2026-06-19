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

// Return a RELATIVE URL so the client PUTs/GETs to the same origin it loaded
// the app from. Hardcoding http://localhost:3000 breaks when the app is opened
// via 127.0.0.1, a LAN IP, or a tunneled host: the PUT becomes cross-origin and
// the browser blocks it (surfacing as a "network" upload failure).
export async function getPresignedUploadUrl(
  key: string,
  _contentType: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return `/api/storage/local/${key}`;
}

export async function getPresignedDownloadUrl(
  key: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return `/api/storage/local/${key}`;
}
