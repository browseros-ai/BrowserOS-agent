import { z } from 'zod'

// Message envelope for upsert-based updates
export const MessageSchema = z.object({
  msgId: z.string(),  // Stable ID for message (e.g., "msg_think_1", "msg_tool_result_2")
  content: z.string(),  // Full markdown content
  role: z.enum(['thinking', 'user', 'assistant', 'error', 'narration']),  // Message role (added narration)
  ts: z.number(),  // Timestamp in milliseconds
})

export type Message = z.infer<typeof MessageSchema>

// Execution status
export const ExecutionStatusSchema = z.object({
  status: z.enum(['running', 'done', 'cancelled', 'error']),  // Current execution state
  ts: z.number(),  // Timestamp when status changed
  message: z.string().optional(),  // Optional message (e.g., error details)
})

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

// Human input request/response schemas
export const HumanInputRequestSchema = z.object({
  requestId: z.string(),  // Unique request identifier
  prompt: z.string(),  // The prompt to show to the human
})

export type HumanInputRequest = z.infer<typeof HumanInputRequestSchema>

export const HumanInputResponseSchema = z.object({
  requestId: z.string(),  // Matching request identifier
  action: z.enum(['done', 'abort']),  // User's action choice
})

export type HumanInputResponse = z.infer<typeof HumanInputResponseSchema>

// Pub-sub event types
export const PubSubEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    payload: MessageSchema
  }),
  z.object({
    type: z.literal('execution-status'),
    payload: ExecutionStatusSchema
  }),
  z.object({
    type: z.literal('human-input-request'),
    payload: HumanInputRequestSchema
  }),
  z.object({
    type: z.literal('human-input-response'),
    payload: HumanInputResponseSchema
  }),
])

export type PubSubEvent = z.infer<typeof PubSubEventSchema>

// Subscription callback
export type SubscriptionCallback = (event: PubSubEvent) => void

// Subscription handle for unsubscribing
export interface Subscription {
  unsubscribe: () => void
}
