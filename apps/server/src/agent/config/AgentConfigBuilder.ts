/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AgentConfig } from '../agent/types.js'
import type {
  AgentSettings,
  InfraConfig,
  McpConfig,
  ProviderConfig,
  ResolvedProviderConfig,
} from './types.js'

/**
 * Fluent builder for constructing AgentConfig with grouped concerns
 */
export class AgentConfigBuilder {
  private conversationId?: string
  private providerConfig?: ProviderConfig
  private providerOverrides?: ResolvedProviderConfig
  private agentSettings: AgentSettings = {}
  private infraConfig?: InfraConfig
  private mcpConfig: McpConfig = {}

  static forConversation(conversationId: string): AgentConfigBuilder {
    const builder = new AgentConfigBuilder()
    builder.conversationId = conversationId
    return builder
  }

  withProvider(config: ProviderConfig): this {
    this.providerConfig = config
    return this
  }

  withProviderOverrides(overrides: ResolvedProviderConfig): this {
    this.providerOverrides = overrides
    return this
  }

  withAgentSettings(settings: AgentSettings): this {
    this.agentSettings = settings
    return this
  }

  withInfrastructure(infra: InfraConfig): this {
    this.infraConfig = infra
    return this
  }

  withMcp(mcp: McpConfig): this {
    this.mcpConfig = mcp
    return this
  }

  build(): AgentConfig {
    this.validate()

    // Safe to use after validate() guarantees these exist
    const provider = this.providerConfig as ProviderConfig
    const infra = this.infraConfig as InfraConfig
    const overrides = this.providerOverrides
    const conversationId = this.conversationId as string

    return {
      conversationId,
      // Provider config (with overrides if present)
      provider: provider.provider,
      model: overrides?.model ?? provider.model,
      apiKey: overrides?.apiKey ?? provider.apiKey,
      baseUrl: overrides?.baseUrl ?? provider.baseUrl,
      upstreamProvider: overrides?.upstreamProvider,
      // AWS/Azure credentials
      resourceName: provider.resourceName,
      region: provider.region,
      accessKeyId: provider.accessKeyId,
      secretAccessKey: provider.secretAccessKey,
      sessionToken: provider.sessionToken,
      // Agent settings
      contextWindowSize: this.agentSettings.contextWindowSize,
      userSystemPrompt: this.agentSettings.userSystemPrompt,
      // Infrastructure
      tempDir: infra.tempDir,
      mcpServerUrl: infra.mcpServerUrl,
      browserosId: infra.browserosId,
      // MCP
      enabledMcpServers: this.mcpConfig.enabledMcpServers,
      customMcpServers: this.mcpConfig.customMcpServers,
    }
  }

  private validate(): void {
    if (!this.conversationId) {
      throw new Error('AgentConfigBuilder: conversationId is required')
    }
    if (!this.providerConfig) {
      throw new Error('AgentConfigBuilder: provider config is required')
    }
    if (!this.providerConfig.provider) {
      throw new Error('AgentConfigBuilder: provider is required')
    }
    if (!this.providerConfig.model) {
      throw new Error('AgentConfigBuilder: model is required')
    }
    if (!this.infraConfig) {
      throw new Error('AgentConfigBuilder: infrastructure config is required')
    }
    if (!this.infraConfig.tempDir) {
      throw new Error('AgentConfigBuilder: tempDir is required')
    }
    if (!this.infraConfig.mcpServerUrl) {
      throw new Error('AgentConfigBuilder: mcpServerUrl is required')
    }
  }
}
