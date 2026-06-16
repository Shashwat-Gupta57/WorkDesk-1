import { db } from "@/lib/db";
import { AuditAction, ArtifactType, Visibility } from "@prisma/client";
import {
  SetSummary,
  SetDetail,
  ArtifactSummary,
  ArtifactDetail,
  VersionDetail,
  CreateSetPayload,
  UpdateSetPayload,
  CreateArtifactPayload,
  UpdateArtifactPayload,
  CommitVersionPayload,
} from "../types";
import { assertContentKeyNamespace, InvalidContentKeyError } from "../utils/contentKey";

export { InvalidContentKeyError };

// ─────────────────────────────────────────────────────────────────────────────
// Typed Archive Errors
// ─────────────────────────────────────────────────────────────────────────────

export class SetNotFoundError extends Error {
  readonly code = "SET_NOT_FOUND";
  constructor() {
    super("Folder not found.");
    this.name = "SetNotFoundError";
  }
}

export class ArtifactNotFoundError extends Error {
  readonly code = "ARTIFACT_NOT_FOUND";
  constructor() {
    super("Artifact not found.");
    this.name = "ArtifactNotFoundError";
  }
}

export class VersionNotFoundError extends Error {
  readonly code = "VERSION_NOT_FOUND";
  constructor() {
    super("Version snapshot not found.");
    this.name = "VersionNotFoundError";
  }
}

export class CircularReferenceError extends Error {
  readonly code = "CIRCULAR_REFERENCE";
  constructor(message = "A folder cannot be moved into its own subfolders.") {
    super(message);
    this.name = "CircularReferenceError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Key Reference Validation (R2 pointer ownership)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTags(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

/**
 * Ensures a content key is in the caller's namespace and referenced by one of
 * their artifact versions (prevents downloading uncommitted upload tickets).
 */
export async function verifyContentKeyReference(ownerId: string, contentKey: string): Promise<void> {
  assertContentKeyNamespace(ownerId, contentKey);

  const version = await db.version.findFirst({
    where: {
      contentKey,
      artifact: { ownerId, deletedAt: null },
    },
    select: { id: true },
  });

  if (!version) {
    throw new InvalidContentKeyError("Content key is not linked to any of your artifacts.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Audit Logger Helper
// ─────────────────────────────────────────────────────────────────────────────

async function writeAuditLog(
  action: AuditAction,
  actorId: string,
  targetId: string | null,
  details: Record<string, any>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        actorId,
        targetId: targetId ?? undefined,
        details: details as any,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit record:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Set (Directory Folder) Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createSet(ownerId: string, payload: CreateSetPayload): Promise<SetSummary> {
  if (payload.parentId) {
    const parent = await db.set.findFirst({
      where: { id: payload.parentId, ownerId, deletedAt: null },
    });
    if (!parent) {
      throw new SetNotFoundError();
    }
  }

  const set = await db.set.create({
    data: {
      name: payload.name,
      parentId: payload.parentId ?? null,
      ownerId,
    },
  });

  await writeAuditLog("SET_CREATED", ownerId, set.id, { name: set.name });

  return set;
}

export async function updateSet(
  ownerId: string,
  setId: string,
  payload: UpdateSetPayload
): Promise<SetSummary> {
  const existing = await db.set.findFirst({
    where: { id: setId, ownerId, deletedAt: null },
  });
  if (!existing) {
    throw new SetNotFoundError();
  }

  // Handle circular reference checks when moving folders
  if (payload.parentId !== undefined && payload.parentId !== existing.parentId) {
    if (payload.parentId === setId) {
      throw new CircularReferenceError("A folder cannot be its own parent.");
    }

    if (payload.parentId !== null) {
      // Confirm target parent exists
      const targetParent = await db.set.findFirst({
        where: { id: payload.parentId, ownerId, deletedAt: null },
      });
      if (!targetParent) {
        throw new SetNotFoundError();
      }

      // Check if targetParent is a descendant of the set we're updating
      let currentParentId: string | null = targetParent.parentId;
      while (currentParentId) {
        if (currentParentId === setId) {
          throw new CircularReferenceError();
        }
        const nextFolder = await db.set.findFirst({
          where: { id: currentParentId, ownerId, deletedAt: null },
          select: { parentId: true },
        });
        currentParentId = nextFolder ? nextFolder.parentId : null;
      }
    }
  }

  const updated = await db.set.update({
    where: { id: setId },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.parentId !== undefined && { parentId: payload.parentId }),
    },
  });

  await writeAuditLog("SET_UPDATED", ownerId, setId, {
    before: { name: existing.name, parentId: existing.parentId },
    after: { name: updated.name, parentId: updated.parentId },
  });

  return updated;
}

/**
 * softDeleteSet
 *
 * Performs cascading soft-delete of a folder. Updates deletedAt on the folder,
 * all its descendants (subfolders), and all artifacts contained inside them.
 */
export async function softDeleteSet(ownerId: string, setId: string): Promise<void> {
  const target = await db.set.findFirst({
    where: { id: setId, ownerId, deletedAt: null },
  });
  if (!target) {
    throw new SetNotFoundError();
  }

  // Recursive helper to fetch all subfolder IDs
  async function getDescendantSetIds(parentIds: string[]): Promise<string[]> {
    const children = await db.set.findMany({
      where: { parentId: { in: parentIds }, deletedAt: null },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) return [];
    return [...childIds, ...(await getDescendantSetIds(childIds))];
  }

  const descendantIds = await getDescendantSetIds([setId]);
  const allSetIds = [setId, ...descendantIds];

  await db.$transaction(async (tx) => {
    // Soft-delete sets
    await tx.set.updateMany({
      where: { id: { in: allSetIds } },
      data: { deletedAt: new Date() },
    });

    // Soft-delete all artifacts inside these sets
    await tx.artifact.updateMany({
      where: { setId: { in: allSetIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Write audit log
    await tx.auditLog.create({
      data: {
        action: "SET_DELETED",
        actorId: ownerId,
        targetId: setId,
        details: {
          deletedSetCount: allSetIds.length,
          cascadeDeletedSetIds: descendantIds,
        },
      },
    });
  });
}

export async function getSets(ownerId: string, parentId: string | null | "root"): Promise<SetSummary[]> {
  const parentFilter = parentId === "root" ? null : parentId;

  if (parentFilter !== null) {
    const parent = await db.set.findFirst({
      where: { id: parentFilter, ownerId, deletedAt: null },
    });
    if (!parent) {
      throw new SetNotFoundError();
    }
  }

  return db.set.findMany({
    where: {
      ownerId,
      deletedAt: null,
      parentId: parentFilter,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * getSetDetail
 *
 * Returns a folder with its immediate child sets and artifacts.
 * Does not recurse into nested subfolders (use parentId queries to navigate).
 */
export async function getSetDetail(ownerId: string, setId: string): Promise<SetDetail> {
  const set = await db.set.findFirst({
    where: { id: setId, ownerId, deletedAt: null },
  });
  if (!set) {
    throw new SetNotFoundError();
  }

  const [children, artifacts] = await Promise.all([
    db.set.findMany({
      where: { parentId: setId, ownerId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    db.artifact.findMany({
      where: { setId, ownerId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    ...set,
    children,
    artifacts: artifacts.map((art) => ({
      ...art,
      tags: normalizeTags(art.tags),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createArtifact(
  ownerId: string,
  payload: CreateArtifactPayload
): Promise<ArtifactDetail> {
  if (payload.setId) {
    const parentSet = await db.set.findFirst({
      where: { id: payload.setId, ownerId, deletedAt: null },
    });
    if (!parentSet) {
      throw new SetNotFoundError();
    }
  }

  const tags = payload.tags ?? [];

  if (payload.initialFileKey) {
    assertContentKeyNamespace(ownerId, payload.initialFileKey);
  }

  const created = await db.$transaction(async (tx) => {
    const artifact = await tx.artifact.create({
      data: {
        title: payload.title,
        description: payload.description,
        tags: tags as any,
        type: payload.type,
        visibility: payload.visibility ?? Visibility.PRIVATE,
        ownerId,
        setId: payload.setId ?? null,
      },
    });

    let version: any = null;
    if (payload.initialFileKey) {
      version = await tx.version.create({
        data: {
          artifactId: artifact.id,
          versionNumber: 1,
          contentKey: payload.initialFileKey,
          changeSummary: payload.changeSummary ?? "Initial version upload.",
          authorId: ownerId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "ARTIFACT_CREATED",
        actorId: ownerId,
        targetId: artifact.id,
        details: {
          title: artifact.title,
          type: artifact.type,
          hasInitialVersion: Boolean(payload.initialFileKey),
        },
      },
    });

    return {
      ...artifact,
      tags: tags,
      versions: version ? [version] : [],
    };
  });

  return created;
}

export async function updateArtifact(
  ownerId: string,
  artifactId: string,
  payload: UpdateArtifactPayload
): Promise<ArtifactSummary> {
  const existing = await db.artifact.findFirst({
    where: { id: artifactId, ownerId, deletedAt: null },
  });
  if (!existing) {
    throw new ArtifactNotFoundError();
  }

  if (payload.setId !== undefined && payload.setId !== null) {
    const parentSet = await db.set.findFirst({
      where: { id: payload.setId, ownerId, deletedAt: null },
    });
    if (!parentSet) {
      throw new SetNotFoundError();
    }
  }

  const tags = payload.tags ?? normalizeTags(existing.tags);

  const updated = await db.artifact.update({
    where: { id: artifactId },
    data: {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && { description: payload.description }),
      tags: tags as any,
      ...(payload.visibility !== undefined && { visibility: payload.visibility }),
      ...(payload.setId !== undefined && { setId: payload.setId }),
    },
  });

  // Log specific action if visibility was updated
  if (payload.visibility !== undefined && payload.visibility !== existing.visibility) {
    await writeAuditLog("ARTIFACT_VISIBILITY_CHANGED", ownerId, artifactId, {
      from: existing.visibility,
      to: payload.visibility,
    });
  }

  await writeAuditLog("ARTIFACT_UPDATED", ownerId, artifactId, {
    before: { title: existing.title, setId: existing.setId },
    after: { title: updated.title, setId: updated.setId },
  });

  return {
    ...updated,
    tags,
  };
}

export async function softDeleteArtifact(ownerId: string, artifactId: string): Promise<void> {
  const target = await db.artifact.findFirst({
    where: { id: artifactId, ownerId, deletedAt: null },
  });
  if (!target) {
    throw new ArtifactNotFoundError();
  }

  await db.$transaction(async (tx) => {
    await tx.artifact.update({
      where: { id: artifactId },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        action: "ARTIFACT_DELETED",
        actorId: ownerId,
        targetId: artifactId,
        details: { title: target.title },
      },
    });
  });
}

export async function getArtifacts(
  ownerId: string,
  setId: string | null | "root",
  tags?: string[],
  search?: string
): Promise<ArtifactSummary[]> {
  const setFilter = setId === "root" ? null : setId;

  const whereClause: any = {
    ownerId,
    deletedAt: null,
    ...(setId !== null && { setId: setFilter }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const artifacts = await db.artifact.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
  });

  const formatted = artifacts.map((art) => ({
    ...art,
    tags: normalizeTags(art.tags),
  }));

  // Perform tags filtering in memory
  if (tags && tags.length > 0) {
    return formatted.filter((art) => tags.every((t) => art.tags.includes(t)));
  }

  return formatted;
}

export async function getArtifactDetails(ownerId: string, artifactId: string): Promise<ArtifactDetail> {
  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, ownerId, deletedAt: null },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  return {
    ...artifact,
    tags: normalizeTags(artifact.tags),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Version Operations (Linear Append-Only Ledger)
// ─────────────────────────────────────────────────────────────────────────────

export async function commitVersion(
  authorId: string,
  artifactId: string,
  payload: CommitVersionPayload
): Promise<VersionDetail> {
  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, ownerId: authorId, deletedAt: null },
  });
  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  assertContentKeyNamespace(authorId, payload.contentKey);

  return db.$transaction(async (tx) => {
    const lastVersion = await tx.version.findFirst({
      where: { artifactId },
      orderBy: { versionNumber: "desc" },
    });

    const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const version = await tx.version.create({
      data: {
        artifactId,
        versionNumber: nextVersionNumber,
        contentKey: payload.contentKey,
        changeSummary: payload.changeSummary ?? `Committed version ${nextVersionNumber}`,
        authorId,
      },
    });

    await tx.artifact.update({
      where: { id: artifactId },
      data: { updatedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        action: "ARTIFACT_VERSION_COMMITTED",
        actorId: authorId,
        targetId: artifactId,
        details: {
          versionNumber: nextVersionNumber,
          contentKey: payload.contentKey,
        },
      },
    });

    return version;
  });
}

/**
 * restoreVersion
 *
 * Restores a historical version by copying its content pointer and creating
 * a new version node at the head of the linear history chain (immutable history).
 */
export async function restoreVersion(
  authorId: string,
  artifactId: string,
  versionNumber: number
): Promise<VersionDetail> {
  const artifact = await db.artifact.findFirst({
    where: { id: artifactId, ownerId: authorId, deletedAt: null },
  });
  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  const targetVersion = await db.version.findFirst({
    where: { artifactId, versionNumber },
  });
  if (!targetVersion) {
    throw new VersionNotFoundError();
  }

  return db.$transaction(async (tx) => {
    const lastVersion = await tx.version.findFirst({
      where: { artifactId },
      orderBy: { versionNumber: "desc" },
    });

    const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const version = await tx.version.create({
      data: {
        artifactId,
        versionNumber: nextVersionNumber,
        contentKey: targetVersion.contentKey,
        changeSummary: `Restored version ${versionNumber}.`,
        authorId,
      },
    });

    await tx.artifact.update({
      where: { id: artifactId },
      data: { updatedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        action: "ARTIFACT_VERSION_RESTORED",
        actorId: authorId,
        targetId: artifactId,
        details: {
          restoredFromVersion: versionNumber,
          newVersionNumber: nextVersionNumber,
          contentKey: targetVersion.contentKey,
        },
      },
    });

    return version;
  });
}
