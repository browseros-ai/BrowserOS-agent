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
  goalCompletion: z.number().min(1).max(10),  // How well goal was achieved (1-10 scale)
  planCorrectness: z.number().min(1).max(10),  // Quality and efficiency of the plan (1-10 scale)
  errorFreeExecution: z.number().min(1).max(10),  // Error-free execution score (1-10 scale)
  contextEfficiency: z.number().min(1).max(10),  // Efficient context usage (1-10 scale)
  weightedTotal: z.number().min(1).max(10),  // Weighted average (1-10 scale)
  details: z.object({  // Scoring details
    toolCalls: z.number(),  // Total number of tool calls
    failedCalls: z.number(),  // Number of failed calls
    retries: z.number(),  // Number of retried calls
    totalDurationMs: z.number().optional(),  // Total execution duration in ms
    toolExecutionMs: z.number().optional(),  // Sum of tool execution durations in ms
    reasoning: z.string().optional()  // LLM reasoning
  })
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// Duration storage options
export const DurationStorageSchema = z.enum(["result", "context", "collector"]);
export type DurationStorage = z.infer<typeof DurationStorageSchema>;