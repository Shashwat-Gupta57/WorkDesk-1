import { z } from "zod";

const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/octet-stream",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Set Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateSetSchema = z.object({
  name: z
    .string({ message: "Name is required." })
    .min(1, "Name cannot be empty.")
    .max(100, "Name must be at most 100 characters.")
    .trim(),
  parentId: z.string().uuid("Parent ID must be a valid UUID.").nullable().optional(),
});

export const UpdateSetSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name cannot be empty.")
      .max(100, "Name must be at most 100 characters.")
      .trim()
      .optional(),
    parentId: z.string().uuid("Parent ID must be a valid UUID.").nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.parentId !== undefined, {
    message: "At least one field (name or parentId) must be provided.",
  });

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateArtifactSchema = z.object({
  title: z
    .string({ message: "Title is required." })
    .min(1, "Title cannot be empty.")
    .max(255, "Title must be at most 255 characters.")
    .trim(),
  description: z.string().max(1000, "Description must be at most 1000 characters.").nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20, "At most 20 tags are allowed.").optional(),
  type: z.enum(["TEXT", "PDF", "DOCX", "PPTX", "IMAGE", "ZIP", "OTHER"], {
    message: "Invalid artifact type.",
  }),
  visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional(),
  setId: z.string().uuid("Set ID must be a valid UUID.").nullable().optional(),
  initialFileKey: z.string().min(1, "File key cannot be empty.").optional(),
  changeSummary: z.string().max(255).optional(),
});

export const UpdateArtifactSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title cannot be empty.")
      .max(255, "Title must be at most 255 characters.")
      .trim()
      .optional(),
    description: z.string().max(1000, "Description must be at most 1000 characters.").nullable().optional(),
    tags: z.array(z.string().min(1).max(50)).max(20, "At most 20 tags are allowed.").optional(),
    visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional(),
    setId: z.string().uuid("Set ID must be a valid UUID.").nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.tags !== undefined ||
      data.visibility !== undefined ||
      data.setId !== undefined,
    { message: "At least one metadata field must be provided." }
  );

// ─────────────────────────────────────────────────────────────────────────────
// Version Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CommitVersionSchema = z.object({
  contentKey: z.string({ message: "File content key is required." }).min(1, "Content key cannot be empty."),
  changeSummary: z.string().max(255, "Change summary must be at most 255 characters.").nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Generic Path Parameter UUID Validations
// ─────────────────────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({
  id: z.string().uuid("ID must be a valid UUID."),
});

export const RestoreVersionSchema = z.object({
  versionNumber: z.number().int().positive("Version number must be a positive integer."),
});

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ListSetsQuerySchema = z.object({
  parentId: z.union([z.literal("root"), z.string().uuid()]).optional().default("root"),
});

export const SetDetailQuerySchema = z.object({
  id: z.string().uuid("Set ID must be a valid UUID."),
});

export const ListArtifactsQuerySchema = z.object({
  setId: z.union([z.literal("root"), z.string().uuid()]).nullable().optional(),
  search: z.string().max(255).optional(),
  tags: z.string().max(500).optional(),
});

export const UploadQuerySchema = z.object({
  contentType: z
    .string({ message: "contentType is required." })
    .min(1, "contentType cannot be empty.")
    .refine((value) => ALLOWED_UPLOAD_CONTENT_TYPES.includes(value as (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number]), {
      message: "Unsupported content type.",
    }),
  filename: z
    .string()
    .max(255, "Filename must be at most 255 characters.")
    .optional()
    .default("unnamed-file"),
});

export const DownloadQuerySchema = z.object({
  contentKey: z.string({ message: "contentKey is required." }).min(1, "contentKey cannot be empty."),
});
