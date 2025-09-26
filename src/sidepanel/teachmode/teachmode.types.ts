import { z } from 'zod'

// Recording state type
export const TeachModeStateSchema = z.enum([
  'idle',
  'recording',
  'processing',
  'ready',
  'executing',
  'summary'
])
export type TeachModeState = z.infer<typeof TeachModeStateSchema>

// Captured event schema
export const CapturedEventSchema = z.object({
  id: z.string(),  // Unique event ID
  timestamp: z.number(),  // When event occurred
  stepNumber: z.number(),  // Step sequence number
  action: z.object({
    type: z.enum(['click', 'type', 'navigate', 'scroll', 'keyDown']),  // Action type
    description: z.string(),  // Human-readable description
    element: z.string().optional(),  // Element info
    url: z.string().optional()  // URL if navigation
  }),
  voiceAnnotation: z.string().optional(),  // Voice transcription
  screenshot: z.string().optional()  // Base64 thumbnail
})
export type CapturedEvent = z.infer<typeof CapturedEventSchema>

// Recording schema
export const TeachModeRecordingSchema = z.object({
  id: z.string(),  // Unique recording ID
  name: z.string(),  // Workflow name
  description: z.string(),  // Brief description
  intent: z.string(),  // Original user intent
  steps: z.array(CapturedEventSchema),  // Captured steps
  duration: z.number(),  // Recording duration in seconds
  createdAt: z.number(),  // Creation timestamp
  lastRunAt: z.number().optional(),  // Last execution timestamp
  runCount: z.number(),  // Number of executions
  successCount: z.number(),  // Successful runs
  failureCount: z.number(),  // Failed runs
  icon: z.string()  // Emoji icon for visual
})
export type TeachModeRecording = z.infer<typeof TeachModeRecordingSchema>

// Execution progress schema
export const ExecutionProgressSchema = z.object({
  recordingId: z.string(),  // Recording being executed
  currentStep: z.number(),  // Current step index
  totalSteps: z.number(),  // Total number of steps
  status: z.enum(['running', 'paused', 'completed', 'failed']),  // Execution status
  startedAt: z.number(),  // Start timestamp
  currentMessage: z.string().optional(),  // Current step message/description
  completedSteps: z.array(z.object({
    stepNumber: z.number(),
    success: z.boolean(),
    duration: z.number(),
    message: z.string().optional()
  }))  // Completed step details
})
export type ExecutionProgress = z.infer<typeof ExecutionProgressSchema>

// Summary result schema
export const ExecutionSummarySchema = z.object({
  recordingId: z.string(),  // Recording that was executed
  recordingName: z.string(),  // Recording name
  success: z.boolean(),  // Overall success
  duration: z.number(),  // Total duration in seconds
  stepsCompleted: z.number(),  // Number of completed steps
  totalSteps: z.number(),  // Total steps
  results: z.array(z.string()),  // Result messages
  failedAtStep: z.number().optional(),  // Step where it failed
  errorMessage: z.string().optional()  // Error details
})
export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>