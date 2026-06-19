import { z } from "zod";

export const CreateRelationshipSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  type: z.enum(["BELONGS_TO", "RELATED_TO", "DERIVED_FROM", "REPLACES"]),
});

export const DeleteRelationshipSchema = z.object({
  relationshipId: z.string().uuid(),
});

export const ArtifactIdParamSchema = z.object({
  artifactId: z.string().uuid(),
});
