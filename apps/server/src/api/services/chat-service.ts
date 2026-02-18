/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import type { HonoSSEStream } from '../../agent/provider-adapter/types'
import type { SessionManager } from '../../agent/session'
import type {
  McpServerSpec,
  ProviderConfig,
  ResolvedAgentConfig,
} from '../../agent/types'
import { INLINED_ENV } from '../../env'
import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '../../lib/clients/gateway'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import { detectMcpTransport } from '../../lib/mcp-transport-detect'
import type { BrowserContext, ChatRequest } from '../types'

export interface ChatServiceDeps {
  sessionManager: SessionManager
  klavisClient: KlavisClient
  executionDir: string
  mcpServerUrl: string
  browserosId?: string
  agentRuntime: 'gemini' | 'vercel-tool-loop'
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

    const sessionExecutionDir = await this.resolveSessionDir(request)

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
      sessionExecutionDir,
      supportsImages: request.supportsImages,
      chatMode: request.mode === 'chat',
      isScheduledTask: request.isScheduledTask,
    }

    const isNewSession = !sessionManager.has(request.conversationId)
    const agent = await sessionManager.getOrCreate(agentConfig, mcpServers)
    await agent.execute(
      request.message,
      rawStream,
      abortSignal,
      request.browserContext,
      isNewSession ? request.previousConversation : undefined,
    )
  }

  private async resolveProviderConfig(
    request: ChatRequest,
  ): Promise<ProviderConfig> {
    if (request.provider === LLM_PROVIDERS.BROWSEROS) {
      const configUrl = INLINED_ENV.BROWSEROS_CONFIG_URL
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
  ): Promise<Record<string, McpServerSpec>> {
    const { klavisClient, mcpServerUrl, browserosId } = this.deps
    const servers: Record<string, McpServerSpec> = {}

    if (mcpServerUrl) {
      servers['browseros-mcp'] = {
        url: mcpServerUrl,
        transport: 'streamable-http',
        headers: {
          Accept: 'application/json, text/event-stream',
          'X-BrowserOS-Source':
            this.deps.agentRuntime === 'vercel-tool-loop'
              ? 'sdk-internal'
              : 'gemini-agent',
          ...(browserContext?.windowId != null && {
            'X-BrowserOS-Window-Id': String(browserContext.windowId),
          }),
        },
        trust: true,
      }
    }

    if (browserosId && browserContext?.enabledMcpServers?.length) {
      try {
        const result = await klavisClient.createStrata(
          browserosId,
          browserContext.enabledMcpServers,
        )
        servers['klavis-strata'] = {
          url: result.strataServerUrl,
          transport: 'streamable-http',
          trust: true,
        }
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
      const customServers = browserContext.customMcpServers
      const transports = await Promise.all(
        customServers.map((server) => detectMcpTransport(server.url)),
      )
      for (let i = 0; i < customServers.length; i++) {
        const server = customServers[i]
        const transport = transports[i]
        servers[`custom-${server.name}`] = {
          url: server.url,
          transport,
          trust: true,
        }
        logger.info('Added custom MCP server', {
          name: server.name,
          url: server.url,
          transport,
        })
      }
    }

    return servers
  }

  private async resolveSessionDir(request: ChatRequest): Promise<string> {
    let dir: string
    let userProvided: boolean

    if (request.userWorkingDir) {
      dir = request.userWorkingDir
      userProvided = true
    } else {
      // create new session dir for this conversationId
      dir = path.join(
        this.deps.executionDir,
        'sessions',
        request.conversationId,
      )
      userProvided = false
    }

    await mkdir(dir, { recursive: true })
    logger.info('Session directory resolved', { dir, userProvided })

    return dir
  }
}
