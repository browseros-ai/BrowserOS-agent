import { z } from "zod";

// Tool execution metadata schema
export const ToolExecutionSchema = z.object({
  toolName: z.string(),  // Name of the tool
  duration: z.number(),  // Duration in milliseconds
  success: z.boolean(),  // Whether tool succeeded (ok: true/false)
  timestamp: z.number(),  // When tool was executed
  args: z.any().optional(),  // Tool arguments
  error: z.string().optional()  // Error message if failed
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

// Scoring result schema
export const ScoreResultSchema = z.object({
  goalCompletion: z.number().min(0).max(1),  // How well goal was achieved
  planCorrectness: z.number().min(0).max(1),  // Quality of the plan
  errorFreeExecution: z.number().min(0).max(1),  // Error-free execution ratio (renamed per NTN feedback)
  contextEfficiency: z.number().min(0).max(1),  // Efficient context usage
  weightedTotal: z.number().min(0).max(1),  // Weighted average
  details: z.object({  // Scoring details
    toolCalls: z.number(),  // Total number of tool calls
    failedCalls: z.number(),  // Number of failed calls
    retries: z.number(),  // Number of retried calls
    reasoning: z.string().optional()  // LLM reasoning
  })
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// Duration storage options
export const DurationStorageSchema = z.enum(["result", "context", "collector"]);
export type DurationStorage = z.infer<typeof DurationStorageSchema>;