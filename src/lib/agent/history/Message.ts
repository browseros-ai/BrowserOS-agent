import { z } from 'zod'

export const ToolCallSchema = z.object({
  id: z.string(),  // Unique tool call ID
  name: z.string(),  // Tool name
  parameters: z.unknown()  // Tool parameters
})

export type ToolCall = z.infer<typeof ToolCallSchema>

export const MessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('system'),
    content: z.string()
  }),
  z.object({
    role: z.literal('user'),
    content: z.string()
  }),
  z.object({
    role: z.literal('assistant'),
    content: z.string(),
    toolCalls: z.array(ToolCallSchema).optional()
  }),
  z.object({
    role: z.literal('tool'),
    toolCallId: z.string(),
    name: z.string(),
    content: z.string()
  })
])

export type Message = z.infer<typeof MessageSchema>

export const ConversationSchema = z.object({
  messages: z.array(MessageSchema),  // All messages in the conversation
  metadata: z.record(z.unknown()).optional()  // Optional metadata
})

export type Conversation = z.infer<typeof ConversationSchema>