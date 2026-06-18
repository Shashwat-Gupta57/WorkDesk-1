-- Artifact relationships (V2 Slice 5)
CREATE TYPE relationship_type AS ENUM ('BELONGS_TO', 'RELATED_TO', 'DERIVED_FROM', 'REPLACES');

CREATE TABLE artifact_relationships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  to_id       UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  type        relationship_type NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id, type),
  CHECK (from_id <> to_id)
);

CREATE INDEX artifact_relationships_from_idx ON artifact_relationships (from_id);
CREATE INDEX artifact_relationships_to_idx   ON artifact_relationships (to_id);
