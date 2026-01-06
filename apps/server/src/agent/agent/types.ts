/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { LLMProvider } from '@browseros/shared/schemas/llm'
import { z } from 'zod'

import { CustomMcpServerSchema } from '../../http/types'

import { VercelAIConfigSchema } from './gemini-vercel-sdk-adapter/types'

export interface ProviderConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  upstreamProvider?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

export interface ResolvedAgentConfig {
  conversationId: string
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  upstreamProvider?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  contextWindowSize?: number
  userSystemPrompt?: string
  tempDir: string
}

export const AgentConfigSchema = VercelAIConfigSchema.extend({
  conversationId: z.string(),
  tempDir: z.string(),
  mcpServerUrl: z.string().optional(),
  contextWindowSize: z.number().optional(),
  browserosId: z.string().optional(),
  enabledMcpServers: z.array(z.string()).optional(),
  customMcpServers: z.array(CustomMcpServerSchema).optional(),
  userSystemPrompt: z.string().optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>
