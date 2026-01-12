/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { z } from 'zod'
import { VercelAIConfigSchema } from '../agent/provider-adapter/types'
import type { McpContext } from '../browser/cdp/context'
import type { ControllerContext } from '../browser/extension/context'
import type { Mutex } from '../lib/mutex'
import type { RateLimiter } from '../lib/rate-limiter/rate-limiter'
import type { ToolDefinition } from '../tools/types/tool-definition'

// Chat request schemas (moved from agent/http/types.ts)
export const TabSchema = z.object({
  id: z.number(),
  url: z.string().optional(),
  title: z.string().optional(),
})

export type Tab = z.infer<typeof TabSchema>

export const CustomMcpServerSchema = z.object({
  name: z.string(),
  url: z.string().url(),
})

export type CustomMcpServer = z.infer<typeof CustomMcpServerSchema>

export const BrowserContextSchema = z.object({
  windowId: z.number().optional(),
  activeTab: TabSchema.optional(),
  selectedTabs: z.array(TabSchema).optional(),
  tabs: z.array(TabSchema).optional(),
  enabledMcpServers: z.array(z.string()).optional(),
  customMcpServers: z.array(CustomMcpServerSchema).optional(),
})

export type BrowserContext = z.infer<typeof BrowserContextSchema>

export const ChatRequestSchema = VercelAIConfigSchema.extend({
  conversationId: z.string().uuid(),
  message: z.string().min(1, 'Message cannot be empty'),
  contextWindowSize: z.number().optional(),
  browserContext: BrowserContextSchema.optional(),
  userSystemPrompt: z.string().optional(),
  isScheduledTask: z.boolean().optional().default(false),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

/**
 * Hono environment bindings for Bun.serve integration.
 * The server binding is required for security checks (isLocalhostRequest).
 */
export type Env = {
  Bindings: {
    server: ReturnType<typeof Bun.serve>
  }
}

/**
 * Configuration for the consolidated HTTP server.
 * This server handles all routes: health, klavis, chat, mcp, provider
 */
export interface HttpServerConfig {
  // Server basics
  port: number
  host?: string

  // For MCP routes - server will create McpServer internally
  version: string
  tools: ToolDefinition[]
  cdpContext: McpContext | null
  controllerContext: ControllerContext
  toolMutex: Mutex
  allowRemote: boolean

  // For Chat/Klavis routes
  browserosId?: string
  tempDir?: string
  rateLimiter?: RateLimiter

  // For Graph routes
  codegenServiceUrl?: string
}

// Graph request schemas
export const CreateGraphRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
})

export type CreateGraphRequest = z.infer<typeof CreateGraphRequestSchema>

export const UpdateGraphRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
})

export type UpdateGraphRequest = z.infer<typeof UpdateGraphRequestSchema>

// Run graph request - similar to ChatRequest, needs provider config for Agent SDK
export const RunGraphRequestSchema = VercelAIConfigSchema.extend({
  browserContext: BrowserContextSchema.optional(),
}).refine(
  (data) =>
    !data.provider || data.provider === LLM_PROVIDERS.BROWSEROS || !!data.model,
  { message: 'model is required for non-browseros providers', path: ['model'] },
)

export type RunGraphRequest = z.infer<typeof RunGraphRequestSchema>

// Workflow graph schemas (matching codegen-service)
export const WorkflowNodeTypeSchema = z.enum([
  'start',
  'end',
  'nav',
  'act',
  'extract',
  'verify',
  'decision',
  'loop',
  'fork',
  'join',
])

export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: WorkflowNodeTypeSchema,
  data: z.object({ label: z.string() }),
})

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
})

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>

export interface GraphSession {
  id: string
  code: string
  graph: WorkflowGraph | null
  createdAt: Date
}

// Codegen service response schema for GET /api/code/:id
export const CodegenGetResponseSchema = z.object({
  code: z.string(),
  graph: WorkflowGraphSchema.nullable(),
  createdAt: z.string().optional(),
})

export type CodegenGetResponse = z.infer<typeof CodegenGetResponseSchema>

// Codegen service SSE event schemas
export const CodegenStartedEventSchema = z.object({
  event: z.literal('started'),
  data: z.object({
    codeId: z.string(),
    instanceId: z.string(),
  }),
})

export type CodegenStartedEvent = z.infer<typeof CodegenStartedEventSchema>

export const CodegenProgressEventSchema = z.object({
  event: z.literal('progress'),
  data: z.object({
    message: z.string(),
    turn: z.number(),
  }),
})

export type CodegenProgressEvent = z.infer<typeof CodegenProgressEventSchema>

export const CodegenCompleteEventSchema = z.object({
  event: z.literal('complete'),
  data: z.object({
    codeId: z.string(),
    code: z.string(),
    graph: WorkflowGraphSchema.nullable(),
    instanceId: z.string(),
  }),
})

export type CodegenCompleteEvent = z.infer<typeof CodegenCompleteEventSchema>

export const CodegenErrorEventSchema = z.object({
  event: z.literal('error'),
  data: z.object({
    error: z.string(),
    details: z.string().optional(),
  }),
})

export type CodegenErrorEvent = z.infer<typeof CodegenErrorEventSchema>

export const CodegenSSEEventSchema = z.discriminatedUnion('event', [
  CodegenStartedEventSchema,
  CodegenProgressEventSchema,
  CodegenCompleteEventSchema,
  CodegenErrorEventSchema,
])

export type CodegenSSEEvent = z.infer<typeof CodegenSSEEventSchema>
