export type RelationshipType = "BELONGS_TO" | "RELATED_TO" | "DERIVED_FROM" | "REPLACES";

export interface ArtifactRelationship {
  id: string;
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  type: RelationshipType;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

// ── Graph data shapes (used by the graph view page) ──────────────────────────

export type GraphNodeType =
  | "member"      // team member root (team view)
  | "set"         // parent set
  | "subset"      // nested set
  | "artifact";   // leaf artifact

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  artifactType?: string;   // ArtifactType value when type === "artifact"
  visibility?: string;     // Visibility value when type === "artifact"
  tags?: string[];
  ownerId?: string;
  ownerName?: string;
  parentId?: string | null;
  depth: number;           // 0 = root, 1 = set, 2 = subset, etc.
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edgeType: "hierarchy" | "relationship";
  relationshipType?: RelationshipType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
