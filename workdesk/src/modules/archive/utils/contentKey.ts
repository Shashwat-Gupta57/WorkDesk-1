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
