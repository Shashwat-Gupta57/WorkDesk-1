import { z } from "zod";

export const CreateBulletinSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ANNOUNCEMENT"),
    title: z.string().min(1).max(255),
    body: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    type: z.literal("COUNTDOWN"),
    title: z.string().min(1).max(255),
    body: z.string().max(2000).optional().nullable(),
    dueAt: z.string().datetime({ message: "dueAt must be an ISO-8601 datetime string." }),
    assigneeIds: z.array(z.string().uuid()).min(1, "At least one assignee is required."),
  }),
]);
export type CreateBulletinInput = z.infer<typeof CreateBulletinSchema>;

export const ListBulletinsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
