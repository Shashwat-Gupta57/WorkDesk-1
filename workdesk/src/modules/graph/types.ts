// ─────────────────────────────────────────────────────────────────────────────
// Graph Module Types (V2 Slice 5)
// ─────────────────────────────────────────────────────────────────────────────

export type RelationshipType = "BELONGS_TO" | "RELATED_TO" | "DERIVED_FROM" | "REPLACES";

export interface GraphArtifactNode {
  id: string;
  title: string;
  type: string;
  visibility: string;
  set_id: string | null;
  set_name: string | null;
  owner_id: string;
  owner_name: string;
  tags: string[];
}

export interface GraphRelationshipEdge {
  id: string;
  from_id: string;
  to_id: string;
  type: RelationshipType;
  created_by: string;
}

export interface GraphData {
  nodes: GraphArtifactNode[];
  edges: GraphRelationshipEdge[];
}

export interface CreateRelationshipPayload {
  fromId: string;
  toId: string;
  type: RelationshipType;
}
