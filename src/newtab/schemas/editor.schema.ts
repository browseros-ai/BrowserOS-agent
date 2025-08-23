import { z } from 'zod'

// Editor state schema
export const EditorStateSchema = z.object({
  mode: z.enum(['index', 'editor']),  // Current view mode
  activeAgentId: z.string().nullable(),  // Currently editing agent
  isDirty: z.boolean(),  // Has unsaved changes
  notification: z.string().optional(),  // Header notification message
  errors: z.record(z.string(), z.string()).default({})  // Field validation errors
})

export type EditorState = z.infer<typeof EditorStateSchema>

// Draft schema for localStorage
export const AgentDraftSchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  goal: z.string().default(''),
  steps: z.array(z.string()).default(['']),
  notes: z.array(z.string()).default([''])
})

export type AgentDraft = z.infer<typeof AgentDraftSchema>

// List editor item schema
export const ListItemSchema = z.object({
  value: z.string(),  // Item text
  index: z.number(),  // Position in list
  isFocused: z.boolean().default(false)  // Current focus state
})

export type ListItem = z.infer<typeof ListItemSchema>