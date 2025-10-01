import { z } from 'zod'

// Feedback type enum
export const FeedbackTypeSchema = z.enum(['thumbs_up', 'thumbs_down'])
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>

// Feedback source enum
export const FeedbackSourceSchema = z.enum(['agent', 'teachmode'])
export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>

// Feedback submission schema matching API interface
export const FeedbackSubmissionSchema = z.object({
  source: FeedbackSourceSchema,  // Source of feedback (agent, teachmode)
  type: FeedbackTypeSchema,  // thumbs_up or thumbs_down
  timestamp: z.date(),  // When feedback was submitted
  user_feedback: z.string().optional(),  // Optional text feedback
  data: z.record(z.any())  // Additional context data (userQuery, agentResponse, metadata, etc.)
})

export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>

// Feedback UI state schema
export const FeedbackUIStateSchema = z.object({
  isSubmitting: z.boolean(),  // Loading state during submission
  showThankYou: z.boolean(),  // Show thank you message
  showModal: z.boolean(),  // Show text input modal
  error: z.string().nullable()  // Error message if submission fails
})

export type FeedbackUIState = z.infer<typeof FeedbackUIStateSchema>
