// ─────────────────────────────────────────────────────────────────────────────
// Storage backend — Cloudflare R2 (production) or local filesystem (dev).
//
// Switch: set USE_LOCAL_STORAGE=true in .env.local to use local-fs.
// To restore R2: remove USE_LOCAL_STORAGE (or set it to anything else) and the
// two local-storage route handlers under api/storage/local/.
//
// Public surface (unchanged by either backend):
//   getPresignedUploadUrl(key, contentType) → URL the client PUTs bytes to
//   getPresignedDownloadUrl(key)            → URL the client GETs bytes from
// ─────────────────────────────────────────────────────────────────────────────

const USE_LOCAL = process.env.USE_LOCAL_STORAGE === "true";

// ── R2 backend ───────────────────────────────────────────────────────────────

async function r2UploadUrl(key: string, contentType: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME ?? "workdesk",
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

async function r2DownloadUrl(key: string): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME ?? "workdesk",
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

function getR2Client() {
  // Lazy import keeps the R2 client out of the bundle when using local storage.
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    endpoint: `https://${process.env.R2_ACCOUNT_ID ?? "placeholder"}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "placeholder",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "placeholder",
    },
    region: "auto",
  });
}

// ── Local-filesystem backend ──────────────────────────────────────────────────
// Files land at:  <project-root>/uploads/{contentKey}
// e.g.            uploads/archives/{userId}/{uuid}-filename.pdf
//
// Upload URL:   PUT  /api/storage/local/{...key}  (route: api/storage/local/[...path])
// Download URL: GET  /api/storage/local/{...key}  (same route, different method)
//
// The client in upload.ts already does a raw fetch PUT to whatever URL is
// returned here, so local-PUT handler ↔ upload.ts are already compatible.

function localUploadUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/storage/local/${key}`;
}

function localDownloadUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/storage/local/${key}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return USE_LOCAL ? localUploadUrl(key) : r2UploadUrl(key, contentType);
}

export async function getPresignedDownloadUrl(
  key: string,
  _expiresInSeconds = 3600
): Promise<string> {
  return USE_LOCAL ? localDownloadUrl(key) : r2DownloadUrl(key);
}
