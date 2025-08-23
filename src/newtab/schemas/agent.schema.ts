import { z } from 'zod'

// Agent schema (full model)
export const AgentSchema = z.object({
  id: z.string().min(1),  // Unique identifier
  name: z.string().min(2).max(50),  // Display name
  description: z.string().max(200),  // Brief description
  goal: z.string().min(10),  // Primary objective
  steps: z.array(z.string()).default([]),  // Execution steps
  notes: z.array(z.string()).optional(),  // Additional notes
  tools: z.array(z.string()).default([]),  // Tool identifiers
  isPinned: z.boolean().default(false),  // Show on new tab
  lastUsed: z.number().int().nullable(),  // Last execution timestamp
  createdAt: z.number().int(),  // Creation timestamp
  updatedAt: z.number().int()  // Last update timestamp
})

export type Agent = z.infer<typeof AgentSchema>

// Form validation schema (stricter for user input)
export const AgentFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  description: z.string().max(200, 'Description too long').optional(),
  goal: z.string().min(10, 'Goal must be at least 10 characters'),
  steps: z.array(z.string().min(1, 'Step cannot be empty')).min(1, 'At least one step required'),
  notes: z.array(z.string()).optional()
})

export type AgentFormData = z.infer<typeof AgentFormSchema>

// Create agent input schema
export const CreateAgentSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  goal: z.string().min(10),
  steps: z.array(z.string().min(1)),
  notes: z.array(z.string()).optional()
})

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>