import { ArtifactType, Visibility } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Archive Module Interfaces & Payload Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SetSummary {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetDetail extends SetSummary {
  children: SetSummary[];
  artifacts: ArtifactSummary[];
}

export interface ArtifactSummary {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  type: ArtifactType;
  visibility: Visibility;
  ownerId: string;
  setId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionDetail {
  id: string;
  artifactId: string;
  versionNumber: number;
  contentKey: string;
  changeSummary: string | null;
  authorId: string;
  createdAt: Date;
}

export interface ArtifactDetail extends ArtifactSummary {
  versions: VersionDetail[];
}

export interface CreateSetPayload {
  name: string;
  parentId?: string | null;
}

export interface UpdateSetPayload {
  name?: string;
  parentId?: string | null;
}

export interface CreateArtifactPayload {
  title: string;
  description?: string | null;
  tags?: string[];
  type: ArtifactType;
  visibility?: Visibility;
  setId?: string | null;
  // If provided, commits an initial version along with the artifact
  initialFileKey?: string;
  changeSummary?: string;
}

export interface UpdateArtifactPayload {
  title?: string;
  description?: string | null;
  tags?: string[];
  visibility?: Visibility;
  setId?: string | null;
}

export interface CommitVersionPayload {
  contentKey: string;
  changeSummary?: string | null;
}

// ── Stars ────────────────────────────────────────────────────────────────────

export type StarTargetType = "artifact" | "set";

export interface StarSummary {
  id: string;
  userId: string;
  artifactId: string | null;
  setId: string | null;
  createdAt: Date;
}

export interface StarredLists {
  artifacts: ArtifactSummary[];
  sets: SetSummary[];
}

export interface ToggleStarPayload {
  targetType: StarTargetType;
  targetId: string;
}
