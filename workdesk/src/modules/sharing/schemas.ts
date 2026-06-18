import { z } from "zod";

export const ShareArtifactSchema = z.object({
  granteeEmail: z.string().email("Must be a valid email address.").toLowerCase().trim(),
});

export const RevokeShareSchema = z.object({
  granteeId: z.string().uuid("Must be a valid user ID."),
});
