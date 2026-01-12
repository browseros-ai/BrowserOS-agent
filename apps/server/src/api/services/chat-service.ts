/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { MCPServerConfig } from '@google/gemini-cli-core'
import type { HonoSSEStream } from '../../agent/provider-adapter/types'
import type { SessionManager } from '../../agent/session'
import type { ProviderConfig, ResolvedAgentConfig } from '../../agent/types'
import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '../../lib/clients/gateway'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import type { BrowserContext, ChatRequest } from '../types'

interface McpHttpServerOptions {
  httpUrl: string
  headers?: Record<string, string>
  trust?: boolean
}

function createHttpMcpServerConfig(
  options: McpHttpServerOptions,
): MCPServerConfig {
  return new MCPServerConfig(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    options.httpUrl,
    options.headers,
    undefined,
    undefined,
    options.trust,
  )
}

export interface ChatServiceDeps {
  sessionManager: SessionManager
  klavisClient: KlavisClient
  tempDir: string
  mcpServerUrl: string
  browserosId?: string
}

export class ChatService {
  constructor(private deps: ChatServiceDeps) {}

  async processMessage(
    request: ChatRequest,
    rawStream: HonoSSEStream,
    abortSignal: AbortSignal,
  ): Promise<void> {
    const { sessionManager } = this.deps

    const providerConfig = await this.resolveProviderConfig(request)
    logger.debug('Provider config resolved', {
      provider: providerConfig.provider,
      model: providerConfig.model,
      hasUpstreamProvider: !!providerConfig.upstreamProvider,
    })

    const mcpServers = await this.buildMcpServers(request.browserContext)
    logger.debug('MCP servers built', {
      serverCount: Object.keys(mcpServers).length,
      servers: Object.keys(mcpServers),
    })

    const agentConfig: ResolvedAgentConfig = {
      conversationId: request.conversationId,
      provider: providerConfig.provider,
      model: providerConfig.model,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
      upstreamProvider: providerConfig.upstreamProvider,
      resourceName: providerConfig.resourceName,
      region: providerConfig.region,
      accessKeyId: providerConfig.accessKeyId,
      secretAccessKey: providerConfig.secretAccessKey,
      sessionToken: providerConfig.sessionToken,
      contextWindowSize: request.contextWindowSize,
      userSystemPrompt: request.userSystemPrompt,
      tempDir: this.deps.tempDir,
    }

    const agent = await sessionManager.getOrCreate(agentConfig, mcpServers)
    await agent.execute(
      request.message,
      rawStream,
      abortSignal,
      request.browserContext,
    )
  }

  private async resolveProviderConfig(
    request: ChatRequest,
  ): Promise<ProviderConfig> {
    if (request.provider === LLM_PROVIDERS.BROWSEROS) {
      const configUrl = process.env.BROWSEROS_CONFIG_URL
      if (!configUrl) {
        throw new Error(
          'BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider',
        )
      }

      logger.info('Fetching BrowserOS config', {
        configUrl,
        browserosId: this.deps.browserosId,
      })

      const browserosConfig = await fetchBrowserOSConfig(
        configUrl,
        this.deps.browserosId,
      )
      const llmConfig = getLLMConfigFromProvider(browserosConfig, 'default')

      logger.info('Using BrowserOS config', {
        model: llmConfig.modelName,
        baseUrl: llmConfig.baseUrl,
        upstreamProvider: llmConfig.providerType,
      })

      return {
        provider: request.provider,
        model: llmConfig.modelName,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        upstreamProvider: llmConfig.providerType,
      }
    }

    return {
      provider: request.provider,
      model: request.model,
      apiKey: request.apiKey,
      baseUrl: request.baseUrl,
      resourceName: request.resourceName,
      region: request.region,
      accessKeyId: request.accessKeyId,
      secretAccessKey: request.secretAccessKey,
      sessionToken: request.sessionToken,
    }
  }

  private async buildMcpServers(
    browserContext?: BrowserContext,
  ): Promise<Record<string, MCPServerConfig>> {
    const { klavisClient, mcpServerUrl, browserosId } = this.deps
    const servers: Record<string, MCPServerConfig> = {}

    if (mcpServerUrl) {
      servers['browseros-mcp'] = createHttpMcpServerConfig({
        httpUrl: mcpServerUrl,
        headers: {
          Accept: 'application/json, text/event-stream',
          'X-BrowserOS-Source': 'gemini-agent',
        },
        trust: true,
      })
    }

    if (browserosId && browserContext?.enabledMcpServers?.length) {
      try {
        const result = await klavisClient.createStrata(
          browserosId,
          browserContext.enabledMcpServers,
        )
        servers['klavis-strata'] = createHttpMcpServerConfig({
          httpUrl: result.strataServerUrl,
          trust: true,
        })
        logger.info('Added Klavis Strata MCP server', {
          browserosId: browserosId.slice(0, 12),
          servers: browserContext.enabledMcpServers,
        })
      } catch (error) {
        logger.error('Failed to create Klavis Strata MCP server', {
          browserosId: browserosId?.slice(0, 12),
          servers: browserContext.enabledMcpServers,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (browserContext?.customMcpServers?.length) {
      for (const server of browserContext.customMcpServers) {
        servers[`custom-${server.name}`] = createHttpMcpServerConfig({
          httpUrl: server.url,
          trust: true,
        })
        logger.info('Added custom MCP server', {
          name: server.name,
          url: server.url,
        })
      }
    }

    return servers
  }
}
