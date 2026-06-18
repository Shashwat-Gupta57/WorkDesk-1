import crypto from "crypto";

const ARCHIVE_KEY_PREFIX = "archives";

export class InvalidContentKeyError extends Error {
  readonly code = "INVALID_CONTENT_KEY";
  constructor(message = "Content key is invalid or not owned by this user.") {
    super(message);
    this.name = "InvalidContentKeyError";
  }
}

/**
 * Builds a namespaced R2 object key for archive uploads.
 * Format: archives/{userId}/{uuid}-{sanitizedFilename}
 */
export function buildArchiveContentKey(userId: string, filename: string): string {
  const uuid = crypto.randomUUID();
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${ARCHIVE_KEY_PREFIX}/${userId}/${uuid}-${cleanFilename}`;
}

/**
 * Extracts the userId segment from a namespaced content key.
 * Format: archives/{userId}/{uuid}-{filename}
 * Returns null if the key doesn't match the expected format.
 */
export function extractUserId(contentKey: string): string | null {
  if (!contentKey || contentKey.includes("..") || contentKey.includes("//")) return null;
  const parts = contentKey.split("/");
  if (parts.length < 3 || parts[0] !== ARCHIVE_KEY_PREFIX) return null;
  return parts[1];
}

/**
 * Validates that a content key belongs to the requesting user's namespace
 * and does not contain path-traversal segments.
 */
export function assertContentKeyNamespace(userId: string, contentKey: string): void {
  if (!contentKey || contentKey.includes("..") || contentKey.includes("//")) {
    throw new InvalidContentKeyError("Content key format is invalid.");
  }

  const expectedPrefix = `${ARCHIVE_KEY_PREFIX}/${userId}/`;
  if (!contentKey.startsWith(expectedPrefix)) {
    throw new InvalidContentKeyError();
  }
}
