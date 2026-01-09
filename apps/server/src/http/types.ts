/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from 'zod'
import { VercelAIConfigSchema } from '../agent/agent/gemini-vercel-sdk-adapter/types'
import type { RateLimiter } from '../agent/rate-limiter/rate-limiter'
import type { McpContext } from '../common/mcp-context'
import type { Mutex } from '../common/mutex'
import type { ControllerContext } from '../controller-server/controller-context'
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
  Variables: AppVariables
}

/**
 * Request-scoped variables set by middleware.
 */
export interface AppVariables {
  validatedBody: unknown
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
})

export type RunGraphRequest = z.infer<typeof RunGraphRequestSchema>

// Workflow graph types (matching codegen-service)
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'nav'
  | 'act'
  | 'extract'
  | 'verify'
  | 'decision'
  | 'loop'
  | 'fork'
  | 'join'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  data: { label: string }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface GraphSession {
  id: string
  code: string
  graph: WorkflowGraph | null
  createdAt: Date
}

// Codegen service SSE event types (matching codegen-service)
export interface CodegenStartedEvent {
  event: 'started'
  data: {
    codeId: string
    instanceId: string
  }
}

export interface CodegenProgressEvent {
  event: 'progress'
  data: {
    message: string
    turn: number
  }
}

export interface CodegenCompleteEvent {
  event: 'complete'
  data: {
    codeId: string
    code: string
    graph: WorkflowGraph | null
    instanceId: string
  }
}

export interface CodegenErrorEvent {
  event: 'error'
  data: {
    error: string
    details?: string
  }
}

export type CodegenSSEEvent =
  | CodegenStartedEvent
  | CodegenProgressEvent
  | CodegenCompleteEvent
  | CodegenErrorEvent
