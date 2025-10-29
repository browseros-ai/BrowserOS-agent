import { z } from "zod"

// Structured output format with success/failure indicator
export const ToolOutputStructuredSchema = z.object({
  ok: z.boolean(),  // Success/failure indicator
  output: z.string(),  // Human-readable result or error message
})

export type ToolOutputStructured = z.infer<typeof ToolOutputStructuredSchema>

// Tool output is always structured format
export type ToolOutput = ToolOutputStructured

// Helper functions to create tool outputs
export function toolSuccess(message: string): ToolOutput {
  return { ok: true, output: message }
}

export function toolError(message: string): ToolOutput {
  return { ok: false, output: message }
}