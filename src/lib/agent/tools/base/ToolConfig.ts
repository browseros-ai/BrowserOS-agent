import { z } from 'zod'

export const ToolDefinitionSchema = z.object({
  name: z.string(),  // Tool identifier
  description: z.string(),  // For LLM understanding
  parameters: z.instanceof(z.ZodSchema),  // Zod schema for params
  requiresApproval: z.boolean().default(false)  // HITL support
})

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

export const ToolResultSchema = z.object({
  success: z.boolean(),  // Whether execution succeeded
  result: z.unknown(),  // The actual result
  error: z.string().optional(),  // Error message if failed
  metadata: z.record(z.unknown()).optional()  // Additional metadata
})

export type ToolResult = z.infer<typeof ToolResultSchema>

export const ToolCallRequestSchema = z.object({
  toolName: z.string(),  // Tool to invoke
  parameters: z.unknown(),  // Parameters to pass
  toolCallId: z.string()  // Unique ID for this call
})

export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>