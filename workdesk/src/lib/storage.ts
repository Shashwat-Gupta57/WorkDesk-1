import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare R2 Client & Storage Utilities
//
// Access to R2 is provided via S3-compatible APIs.
// credentials: Access tokens sourced from env variables.
// endpoint: Regional account endpoint on cloudflare storage.
// ─────────────────────────────────────────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "placeholder-account-id";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "placeholder-access-key-id";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "placeholder-secret-access-key";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "workdesk";

// Configure S3Client targeting Cloudflare R2 Storage.
export const r2Client = new S3Client({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  region: "auto",
});

/**
 * getPresignedUploadUrl
 *
 * Generates a signed PUT URL permitting temporary direct upload from client to R2 bucket.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

/**
 * getPresignedDownloadUrl
 *
 * Generates a signed GET URL to fetch private objects securely from the R2 bucket.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
