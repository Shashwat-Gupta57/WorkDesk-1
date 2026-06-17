import { query, queryOne } from "@/lib/db";
import type { StarSummary, StarredLists, StarTargetType } from "../types";
import type { ArtifactSummary, SetSummary } from "../types";
import { ArtifactType, Visibility } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Star Service
//
// Stars are a user-private toggle on any artifact or set they own.
// Table: stars (id, user_id, artifact_id XOR set_id, created_at)
// ─────────────────────────────────────────────────────────────────────────────

interface StarRow {
  id: string;
  user_id: string;
  artifact_id: string | null;
  set_id: string | null;
  created_at: Date;
}

interface ArtifactRow {
  id: string;
  title: string;
  description: string | null;
  tags: unknown;
  type: ArtifactType;
  visibility: Visibility;
  owner_id: string;
  set_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SetRow {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

export class StarTargetNotFoundError extends Error {
  readonly code = "STAR_TARGET_NOT_FOUND";
  constructor() {
    super("The item you tried to star does not exist or you don't own it.");
    this.name = "StarTargetNotFoundError";
  }
}

export class AlreadyStarredError extends Error {
  readonly code = "ALREADY_STARRED";
  constructor() {
    super("You have already starred this item.");
    this.name = "AlreadyStarredError";
  }
}

export class NotStarredError extends Error {
  readonly code = "NOT_STARRED";
  constructor() {
    super("This item is not starred.");
    this.name = "NotStarredError";
  }
}

function toStarSummary(row: StarRow): StarSummary {
  return {
    id: row.id,
    userId: row.user_id,
    artifactId: row.artifact_id,
    setId: row.set_id,
    createdAt: row.created_at,
  };
}

function normalizeTags(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

function toArtifactSummary(row: ArtifactRow): ArtifactSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: normalizeTags(row.tags),
    type: row.type,
    visibility: row.visibility,
    ownerId: row.owner_id,
    setId: row.set_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSetSummary(row: SetRow): SetSummary {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Star ─────────────────────────────────────────────────────────────────────

export async function starTarget(
  userId: string,
  targetType: StarTargetType,
  targetId: string
): Promise<StarSummary> {
  // Verify the target exists and belongs to this user.
  if (targetType === "artifact") {
    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM artifacts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [targetId, userId]
    );
    if (!exists) throw new StarTargetNotFoundError();

    // Check for duplicate (unique constraint would also catch it, but give a clean error).
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM stars WHERE user_id = $1 AND artifact_id = $2`,
      [userId, targetId]
    );
    if (existing) throw new AlreadyStarredError();

    const row = await queryOne<StarRow>(
      `INSERT INTO stars (user_id, artifact_id) VALUES ($1, $2) RETURNING *`,
      [userId, targetId]
    );
    return toStarSummary(row!);
  } else {
    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM sets WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [targetId, userId]
    );
    if (!exists) throw new StarTargetNotFoundError();

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM stars WHERE user_id = $1 AND set_id = $2`,
      [userId, targetId]
    );
    if (existing) throw new AlreadyStarredError();

    const row = await queryOne<StarRow>(
      `INSERT INTO stars (user_id, set_id) VALUES ($1, $2) RETURNING *`,
      [userId, targetId]
    );
    return toStarSummary(row!);
  }
}

// ── Unstar ───────────────────────────────────────────────────────────────────

export async function unstarTarget(
  userId: string,
  targetType: StarTargetType,
  targetId: string
): Promise<void> {
  let deleted: { id: string } | null;
  if (targetType === "artifact") {
    deleted = await queryOne<{ id: string }>(
      `DELETE FROM stars WHERE user_id = $1 AND artifact_id = $2 RETURNING id`,
      [userId, targetId]
    );
  } else {
    deleted = await queryOne<{ id: string }>(
      `DELETE FROM stars WHERE user_id = $1 AND set_id = $2 RETURNING id`,
      [userId, targetId]
    );
  }
  if (!deleted) throw new NotStarredError();
}

// ── List starred ─────────────────────────────────────────────────────────────

export async function listStarred(userId: string): Promise<StarredLists> {
  const [artifactRows, setRows] = await Promise.all([
    query<ArtifactRow>(
      `SELECT a.*
       FROM artifacts a
       JOIN stars s ON s.artifact_id = a.id
       WHERE s.user_id = $1 AND a.deleted_at IS NULL
       ORDER BY s.created_at DESC`,
      [userId]
    ),
    query<SetRow>(
      `SELECT st.*
       FROM sets st
       JOIN stars s ON s.set_id = st.id
       WHERE s.user_id = $1 AND st.deleted_at IS NULL
       ORDER BY s.created_at DESC`,
      [userId]
    ),
  ]);

  return {
    artifacts: artifactRows.map(toArtifactSummary),
    sets: setRows.map(toSetSummary),
  };
}

// ── Get starred IDs (used to annotate lists with isStarred) ──────────────────

export async function getStarredIds(userId: string): Promise<{ artifactIds: Set<string>; setIds: Set<string> }> {
  const rows = await query<{ artifact_id: string | null; set_id: string | null }>(
    `SELECT artifact_id, set_id FROM stars WHERE user_id = $1`,
    [userId]
  );
  const artifactIds = new Set(rows.map((r) => r.artifact_id).filter(Boolean) as string[]);
  const setIds = new Set(rows.map((r) => r.set_id).filter(Boolean) as string[]);
  return { artifactIds, setIds };
}
