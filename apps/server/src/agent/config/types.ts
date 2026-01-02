/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { LLMProvider } from '@browseros/shared/schemas/llm'
import type { CustomMcpServer } from '../../http/types.js'

/**
 * Provider configuration (merged with AWS credentials)
 */
export interface ProviderConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  // Azure
  resourceName?: string
  // AWS Bedrock
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

/**
 * Agent-specific settings
 */
export interface AgentSettings {
  contextWindowSize?: number
  userSystemPrompt?: string
}

/**
 * Infrastructure configuration
 */
export interface InfraConfig {
  tempDir: string
  mcpServerUrl: string
  browserosId?: string
}

/**
 * MCP server configuration
 */
export interface McpConfig {
  enabledMcpServers?: string[]
  customMcpServers?: CustomMcpServer[]
}

/**
 * Resolved config from BrowserOS provider
 */
export interface ResolvedProviderConfig {
  model: string
  apiKey: string
  baseUrl?: string
  upstreamProvider: string
}
