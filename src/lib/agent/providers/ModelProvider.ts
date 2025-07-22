import { z } from 'zod'
import { Message } from '../history/Message'
import { ToolDefinition } from '../tools/base/ToolConfig'

export const ModelRequestSchema = z.object({
  messages: z.array(z.any()),  // Array of messages (Message type)
  tools: z.array(z.any()).optional(),  // Available tools
  temperature: z.number().min(0).max(2).optional(),  // Temperature setting
  model: z.string().optional(),  // Model override
  stream: z.boolean().default(true),  // Enable streaming
  maxTokens: z.number().optional()  // Max tokens limit
})

export type ModelRequest = z.infer<typeof ModelRequestSchema>

export const ModelResponseSchema = z.object({
  content: z.string(),  // Response content
  toolCalls: z.array(z.object({  // Tool calls requested by model
    id: z.string(),
    name: z.string(),
    parameters: z.unknown()
  })).optional(),
  finishReason: z.enum(['stop', 'tool_calls', 'max_tokens', 'error']).optional(),  // Why response ended
  usage: z.object({  // Token usage
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number()
  }).optional()
})

export type ModelResponse = z.infer<typeof ModelResponseSchema>

export const StreamChunkSchema = z.object({
  type: z.enum(['content', 'tool_call', 'error', 'end']),  // Chunk type
  content: z.string().optional(),  // Text content
  toolCall: z.object({  // Tool call data
    id: z.string(),
    name: z.string(),
    parameters: z.unknown()
  }).optional(),
  error: z.string().optional()  // Error message
})

export type StreamChunk = z.infer<typeof StreamChunkSchema>

export interface ModelProvider {
  // Get a complete response (non-streaming)
  getResponse(request: ModelRequest): Promise<ModelResponse>
  
  // Get a streaming response
  getStreamResponse(request: ModelRequest): AsyncIterable<StreamChunk>
  
  // Check if provider is available
  isAvailable(): Promise<boolean>
  
  // Get provider name
  getName(): string
}