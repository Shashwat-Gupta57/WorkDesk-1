import { z } from "zod";

export const CreateSectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
});

export const PublishArtifactSchema = z.object({
  artifactId: z.string().uuid(),
});

export const UnpublishArtifactSchema = z.object({
  artifactId: z.string().uuid(),
});
