import { z } from "zod";

// ==============================================
// Shared Agent Types - Common types used across agents
// ==============================================

/**
 * Schema for agent step metadata
 */

export const TaskOutputSchema = z.object({
  success: z.boolean(),
  messages: z.array(z.any()),
  duration: z.number(),
  timestamp: z.string(),
  cancelled: z.boolean(),
});

export const TaskMedataSchema = z.object({
  id: z.string(), // Unique identifier for the step
  instruction: z.string(), // User instruction/query
  output: TaskOutputSchema, // Reference the schema directly
});

export type TaskMetadata = z.infer<typeof TaskMedataSchema>;
export type TaskOutput = z.infer<typeof TaskOutputSchema>;
