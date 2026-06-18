import { z } from "zod";

export const SendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  artifactRefId: z.string().uuid().optional().nullable(),
});

export const StartConversationSchema = z.object({
  otherUserId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  artifactRefId: z.string().uuid().optional().nullable(),
});

export const ListMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
