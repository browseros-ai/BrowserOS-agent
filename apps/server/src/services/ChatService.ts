/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { HonoSSEStream } from '../agent/agent/gemini-vercel-sdk-adapter/types.js'
import { AIProvider } from '../agent/agent/gemini-vercel-sdk-adapter/types.js'
import { AgentConfigBuilder } from '../agent/config/AgentConfigBuilder.js'
import type { BrowserOSConfigResolver } from '../agent/config/BrowserOSConfigResolver.js'
import { McpConfigBuilder } from '../agent/config/McpConfigBuilder.js'
import type { ResolvedProviderConfig } from '../agent/config/types.js'
import type { SessionManager } from '../agent/session/SessionManager.js'
import type { Logger } from '../common/index.js'
import type { BrowserContext, ChatRequest } from '../http/types.js'

export interface ChatServiceDeps {
  logger: Logger
  sessionManager: SessionManager
  configResolver: BrowserOSConfigResolver
  tempDir: string
  mcpServerUrl: string
}

export class ChatService {
  private readonly logger: Logger
  private readonly sessionManager: SessionManager
  private readonly configResolver: BrowserOSConfigResolver
  private readonly tempDir: string
  private readonly mcpServerUrl: string

  constructor(deps: ChatServiceDeps) {
    this.logger = deps.logger
    this.sessionManager = deps.sessionManager
    this.configResolver = deps.configResolver
    this.tempDir = deps.tempDir
    this.mcpServerUrl = deps.mcpServerUrl
  }

  async processMessage(
    request: ChatRequest,
    rawStream: HonoSSEStream,
    abortSignal: AbortSignal,
    browserContext?: BrowserContext,
  ): Promise<void> {
    // Resolve provider config if BROWSEROS
    let providerOverrides: ResolvedProviderConfig | undefined
    if (request.provider === AIProvider.BROWSEROS) {
      providerOverrides = await this.configResolver.resolve(
        browserContext?.windowId?.toString(),
      )
    }

    // Build agent config
    const configBuilder = AgentConfigBuilder.forConversation(
      request.conversationId,
    )
      .withProvider({
        provider: request.provider,
        model: request.model,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        region: request.region,
        resourceName: request.resourceName,
        accessKeyId: request.accessKeyId,
        secretAccessKey: request.secretAccessKey,
        sessionToken: request.sessionToken,
      })
      .withAgentSettings({
        contextWindowSize: request.contextWindowSize,
        userSystemPrompt: request.userSystemPrompt,
      })
      .withInfrastructure({
        tempDir: this.tempDir,
        mcpServerUrl: this.mcpServerUrl,
        browserosId: browserContext?.windowId?.toString(),
      })
      .withMcp({
        enabledMcpServers: browserContext?.enabledMcpServers,
        customMcpServers: browserContext?.customMcpServers,
      })

    if (providerOverrides) {
      configBuilder.withProviderOverrides(providerOverrides)
    }

    const config = configBuilder.build()

    // Build MCP servers config
    const mcpBuilder = new McpConfigBuilder(this.logger)

    if (this.mcpServerUrl) {
      mcpBuilder.withBrowserOSServer(this.mcpServerUrl)
    }

    if (browserContext?.windowId && browserContext?.enabledMcpServers?.length) {
      await mcpBuilder.withKlavisStrata(
        browserContext.windowId.toString(),
        browserContext.enabledMcpServers,
      )
    }

    if (browserContext?.customMcpServers?.length) {
      mcpBuilder.withCustomServers(browserContext.customMcpServers)
    }

    const mcpServers = mcpBuilder.build()

    // Get or create agent and execute
    const agent = await this.sessionManager.getOrCreate(config, mcpServers)

    await agent.execute(request.message, rawStream, abortSignal, browserContext)
  }
}
