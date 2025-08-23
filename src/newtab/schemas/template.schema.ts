import { z } from 'zod'

export const TemplateSchema = z.object({
  id: z.string(),  // Template identifier
  name: z.string(),  // Display name
  description: z.string().default(''),  // Short description
  goal: z.string(),  // Goal paragraph
  steps: z.array(z.string()),  // Steps list
  notes: z.array(z.string()).default([])  // Notes list
})

export type Template = z.infer<typeof TemplateSchema>

// Templates collection schema
export const TemplatesSchema = z.array(TemplateSchema)