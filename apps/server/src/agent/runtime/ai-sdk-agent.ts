import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import { stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import { buildSystemPrompt } from '../prompt'
import type { ResolvedAgentConfig } from '../types'
import { createCompactionPrepareStep } from './compaction'
import { buildMcpServerSpecs, createMcpClients } from './mcp-builder'
import { createLanguageModel } from './provider-factory'

export interface AiSdkAgentConfig {
  resolvedConfig: ResolvedAgentConfig
  mcpServerUrl: string
  browserContext?: BrowserContext
  klavisClient?: KlavisClient
  browserosId?: string
}

export class AiSdkAgent {
  private constructor(
    private _agent: ToolLoopAgent,
    private _messages: UIMessage[],
    private _mcpClients: Array<{ close(): Promise<void> }>,
    private conversationId: string,
  ) {}

  static async create(config: AiSdkAgentConfig): Promise<AiSdkAgent> {
    // Build language model from provider config
    const model = createLanguageModel(config.resolvedConfig)

    // Build MCP server specs and connect clients
    const specs = await buildMcpServerSpecs({
      mcpServerUrl: config.mcpServerUrl,
      browserContext: config.browserContext,
      klavisClient: config.klavisClient,
      browserosId: config.browserosId,
    })
    const { clients, tools } = await createMcpClients(specs)

    // Build system prompt with optional section exclusions
    const excludeSections: string[] = []
    if (config.resolvedConfig.isScheduledTask) {
      excludeSections.push('tab-grouping')
    }
    const instructions = buildSystemPrompt({
      userSystemPrompt: config.resolvedConfig.userSystemPrompt,
      exclude: excludeSections,
    })

    // Configure compaction for context window management
    const contextWindow =
      config.resolvedConfig.contextWindowSize ??
      AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW
    const prepareStep = createCompactionPrepareStep({
      contextWindow,
      compactionThreshold: 0.6,
      toolOutputMaxChars: 15_000,
    })

    // Create the ToolLoopAgent
    const agent = new ToolLoopAgent({
      model,
      instructions,
      tools,
      stopWhen: [stepCountIs(AGENT_LIMITS.MAX_TURNS)],
      prepareStep,
    })

    logger.info('Agent session created (v2)', {
      conversationId: config.resolvedConfig.conversationId,
      provider: config.resolvedConfig.provider,
      model: config.resolvedConfig.model,
      toolCount: Object.keys(tools).length,
    })

    return new AiSdkAgent(
      agent,
      [],
      clients,
      config.resolvedConfig.conversationId,
    )
  }

  get toolLoopAgent(): ToolLoopAgent {
    return this._agent
  }

  get messages(): UIMessage[] {
    return this._messages
  }

  set messages(msgs: UIMessage[]) {
    this._messages = msgs
  }

  appendUserMessage(content: string): void {
    this._messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: content }],
    })
  }

  async dispose(): Promise<void> {
    for (const client of this._mcpClients) {
      await client.close().catch(() => {})
    }
    logger.info('Agent disposed', { conversationId: this.conversationId })
  }
}
