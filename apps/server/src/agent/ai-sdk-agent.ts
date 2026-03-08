import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import { stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import type { Browser } from '../browser/browser'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'
import { captureExceptionOnce } from '../lib/sentry-utils'
import { isSoulBootstrap, readSoul } from '../lib/soul'
import { buildFilesystemToolSet } from '../tools/filesystem/build-toolset'
import { buildMemoryToolSet } from '../tools/memory/build-toolset'
import type { ToolRegistry } from '../tools/tool-registry'
import { CHAT_MODE_ALLOWED_TOOLS } from './chat-mode'
import { createCompactionPrepareStep } from './compaction'
import { buildMcpServerSpecs, createMcpClients } from './mcp-builder'
import { buildSystemPrompt } from './prompt'
import { createLanguageModel } from './provider-factory'
import { buildBrowserToolSet } from './tool-adapter'
import type { ResolvedAgentConfig } from './types'

export interface AiSdkAgentConfig {
  resolvedConfig: ResolvedAgentConfig
  browser: Browser
  registry: ToolRegistry
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
    try {
      const model = createLanguageModel(config.resolvedConfig)
      const allBrowserTools = buildBrowserToolSet(
        config.registry,
        config.browser,
      )
      const browserTools = config.resolvedConfig.chatMode
        ? Object.fromEntries(
            Object.entries(allBrowserTools).filter(([name]) =>
              CHAT_MODE_ALLOWED_TOOLS.has(name),
            ),
          )
        : allBrowserTools
      if (config.resolvedConfig.chatMode) {
        logger.info(
          'Chat mode enabled, restricting to read-only browser tools',
          {
            allowedTools: Array.from(CHAT_MODE_ALLOWED_TOOLS),
          },
        )
      }

      const specs = await buildMcpServerSpecs({
        browserContext: config.browserContext,
        klavisClient: config.klavisClient,
        browserosId: config.browserosId,
      })
      const { clients, tools: externalMcpTools } = await createMcpClients(specs)

      const filesystemTools = config.resolvedConfig.chatMode
        ? {}
        : buildFilesystemToolSet(config.resolvedConfig.sessionExecutionDir)
      const memoryTools = config.resolvedConfig.chatMode
        ? {}
        : buildMemoryToolSet()
      const tools = {
        ...browserTools,
        ...externalMcpTools,
        ...filesystemTools,
        ...memoryTools,
      }

      const excludeSections: string[] = ['tool-reference']
      if (config.resolvedConfig.isScheduledTask) {
        excludeSections.push('tab-grouping')
      }
      const soulContent = await readSoul()
      const isBootstrap = await isSoulBootstrap()
      const instructions = buildSystemPrompt({
        userSystemPrompt: config.resolvedConfig.userSystemPrompt,
        exclude: excludeSections,
        isScheduledTask: config.resolvedConfig.isScheduledTask,
        scheduledTaskWindowId: config.browserContext?.windowId,
        workspaceDir: config.resolvedConfig.sessionExecutionDir,
        soulContent,
        isSoulBootstrap: isBootstrap,
        chatMode: config.resolvedConfig.chatMode,
      })

      const contextWindow =
        config.resolvedConfig.contextWindowSize ??
        AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW
      const prepareStep = createCompactionPrepareStep({
        contextWindow,
      })

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
    } catch (error) {
      captureExceptionOnce(error, {
        tags: {
          component: 'ai-sdk-agent',
          phase: 'create',
          provider: config.resolvedConfig.provider,
          model: config.resolvedConfig.model,
          chat_mode: config.resolvedConfig.chatMode,
          is_scheduled_task: config.resolvedConfig.isScheduledTask,
        },
        contexts: {
          agent: {
            conversationId: config.resolvedConfig.conversationId,
            windowId: config.browserContext?.windowId,
            enabledMcpServerCount:
              config.browserContext?.enabledMcpServers?.length ?? 0,
            customMcpServerCount:
              config.browserContext?.customMcpServers?.length ?? 0,
          },
        },
      })
      throw error
    }
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
