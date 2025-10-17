import { z } from "zod";

// Simple schema - server sends type and content
export const WSEventSchema = z.object({
  type: z.string(),  // Event type (connection, response, tool_use, completion, error)
  content: z.string().optional(),  // Message content (optional for some types like connection)
  data: z.any().optional()  // Additional data (e.g., sessionId for connection)
});

export type WSEvent = z.infer<typeof WSEventSchema>;

// Validation helper
export function validateWSEvent(data: unknown): WSEvent {
  return WSEventSchema.parse(data);
}
