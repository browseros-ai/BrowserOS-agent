import type { LanguageModelV3 } from '@ai-sdk/provider'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import {
  stepCountIs,
  ToolLoopAgent,
  type ToolSet,
  type UIMessage,
  wrapLanguageModel,
} from 'ai'
import type { Browser } from '../browser/browser'
import { getSkillsDir } from '../lib/browseros-dir'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'
import { isSoulBootstrap, readSoul } from '../lib/soul'
import { buildSkillsCatalog } from '../skills/catalog'
import { loadSkills } from '../skills/loader'
import { buildFilesystemToolSet } from '../tools/filesystem/build-toolset'
import { buildMemoryToolSet } from '../tools/memory/build-toolset'
import type { ToolRegistry } from '../tools/tool-registry'
import { CHAT_MODE_ALLOWED_TOOLS } from './chat-mode'
import { createCompactionPrepareStep } from './compaction'
import { createContextOverflowMiddleware } from './context-overflow-middleware'
import { buildMcpServerSpecs, createMcpClients } from './mcp-builder'
import { buildSystemPrompt } from './prompt'
import { createLanguageModel } from './provider-factory'
import { createDelegateTaskTool } from './sub-agent'
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
    const contextWindow =
      config.resolvedConfig.contextWindowSize ??
      AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW

    // Build language model with overflow protection middleware
    const rawModel = createLanguageModel(config.resolvedConfig)
    const model =
      (rawModel as any).specificationVersion === 'v3'
        ? wrapLanguageModel({
            model: rawModel as LanguageModelV3,
            middleware: createContextOverflowMiddleware(contextWindow),
          })
        : rawModel

    // Build browser tools from the unified tool registry
    const allBrowserTools = buildBrowserToolSet(config.registry, config.browser)
    const browserTools = config.resolvedConfig.chatMode
      ? Object.fromEntries(
          Object.entries(allBrowserTools).filter(([name]) =>
            CHAT_MODE_ALLOWED_TOOLS.has(name),
          ),
        )
      : allBrowserTools
    if (config.resolvedConfig.chatMode) {
      logger.info('Chat mode enabled, restricting to read-only browser tools', {
        allowedTools: Array.from(CHAT_MODE_ALLOWED_TOOLS),
      })
    }

    // Build external MCP server specs (Klavis, custom) and connect clients
    const specs = await buildMcpServerSpecs({
      browserContext: config.browserContext,
      klavisClient: config.klavisClient,
      browserosId: config.browserosId,
    })
    const { clients, tools: externalMcpTools } = await createMcpClients(specs)

    // Add filesystem tools (Pi coding agent) — skip in chat mode (read-only)
    const filesystemTools = config.resolvedConfig.chatMode
      ? {}
      : buildFilesystemToolSet(config.resolvedConfig.sessionExecutionDir)
    const memoryTools = config.resolvedConfig.chatMode
      ? {}
      : buildMemoryToolSet()
    const tools: ToolSet = {
      ...browserTools,
      ...externalMcpTools,
      ...filesystemTools,
      ...memoryTools,
    }

    // Build system prompt with optional section exclusions
    // Tool definitions are already injected by the AI SDK via tool schemas,
    // so skip the redundant tool-reference section.
    const excludeSections: string[] = ['tool-reference']
    if (config.resolvedConfig.isScheduledTask) {
      excludeSections.push('tab-grouping')
    }
    const soulContent = await readSoul()
    const isBootstrap = await isSoulBootstrap()

    // Load skills catalog for prompt injection
    const skills = await loadSkills(getSkillsDir())
    const skillsCatalog =
      skills.length > 0 ? buildSkillsCatalog(skills) : undefined

    const instructions = buildSystemPrompt({
      userSystemPrompt: config.resolvedConfig.userSystemPrompt,
      exclude: excludeSections,
      isScheduledTask: config.resolvedConfig.isScheduledTask,
      scheduledTaskWindowId: config.browserContext?.windowId,
      workspaceDir: config.resolvedConfig.sessionExecutionDir,
      soulContent,
      isSoulBootstrap: isBootstrap,
      chatMode: config.resolvedConfig.chatMode,
      skillsCatalog,
    })

    // Add sub-agent delegation tool — exact replica of parent, fresh context
    if (!config.resolvedConfig.chatMode) {
      tools.delegate_task = createDelegateTaskTool({
        model,
        instructions,
        parentTools: tools,
        contextWindow,
      })
    }

    // Configure compaction for context window management
    const prepareStep = createCompactionPrepareStep({
      contextWindow,
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
