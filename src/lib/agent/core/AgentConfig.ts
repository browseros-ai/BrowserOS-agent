import { z } from 'zod'

export const AgentConfigSchema = z.object({
  name: z.string(),  // Agent identifier
  description: z.string(),  // What this agent does
  model: z.string().optional(),  // Model override
  temperature: z.number().min(0).max(2).optional(),  // Temperature override
  maxIterations: z.number().positive().default(10),  // Loop safety limit
  verbose: z.boolean().default(false),  // Debug logging
  streamResponse: z.boolean().default(true)  // Enable streaming
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const AgentInstructionsSchema = z.object({
  systemPrompt: z.string(),  // Base system instructions
  promptTemplateUrl: z.string().optional()  // Optional prompt file URL
})

export type AgentInstructions = z.infer<typeof AgentInstructionsSchema>

export const AgentResultSchema = z.object({
  success: z.boolean(),  // Whether the task completed successfully
  output: z.unknown(),  // The final output/result
  iterations: z.number(),  // Number of iterations used
  toolCalls: z.array(z.object({  // Tool calls made during execution
    toolName: z.string(),
    parameters: z.unknown(),
    result: z.unknown()
  })),
  error: z.string().optional()  // Error message if failed
})

export type AgentResult = z.infer<typeof AgentResultSchema>