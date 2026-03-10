import { type McpServerConfig, query } from '@anthropic-ai/claude-agent-sdk'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type { UIMessage } from 'ai'
import type { Browser } from '../browser/browser'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'
import { isSoulBootstrap, readSoul } from '../lib/soul'
import { buildFilesystemToolSet } from '../tools/filesystem/build-toolset'
import { buildMemoryToolSet } from '../tools/memory/build-toolset'
import type { ToolRegistry } from '../tools/tool-registry'
import type { AgentInterface } from './agent-interface'
import { CHAT_MODE_ALLOWED_TOOLS } from './chat-mode'
import { createClaudeStreamResponse } from './claude-stream-adapter'
import {
  createBrowserMcpServer,
  createToolSetMcpServer,
} from './claude-tool-adapter'
import { buildMcpServerSpecs } from './mcp-builder'
import { buildSystemPrompt } from './prompt'
import type { ResolvedAgentConfig } from './types'

export interface ClaudeAgentConfig {
  resolvedConfig: ResolvedAgentConfig
  browser: Browser
  registry: ToolRegistry
  browserContext?: BrowserContext
  klavisClient?: KlavisClient
  browserosId?: string
}

export class ClaudeAgent implements AgentInterface {
  private _messages: UIMessage[] = []

  private constructor(
    private mcpServers: Record<string, McpServerConfig>,
    private externalMcpClients: Array<{ close(): Promise<void> }>,
    private instructions: string,
    private model: string,
    private apiKey: string | undefined,
    private conversationId: string,
    private chatMode: boolean,
    private allowedToolNames: string[],
  ) {}

  static async create(cfg: ClaudeAgentConfig): Promise<ClaudeAgent> {
    const { resolvedConfig, browser, registry } = cfg

    // Build in-process MCP servers for browser tools
    const allBrowserTools = registry.all()
    const filteredRegistry = resolvedConfig.chatMode
      ? {
          all: () =>
            allBrowserTools.filter((t) => CHAT_MODE_ALLOWED_TOOLS.has(t.name)),
          get: (name: string) =>
            allBrowserTools.find(
              (t) => t.name === name && CHAT_MODE_ALLOWED_TOOLS.has(name),
            ),
          names: () =>
            allBrowserTools
              .filter((t) => CHAT_MODE_ALLOWED_TOOLS.has(t.name))
              .map((t) => t.name),
        }
      : registry

    const browserMcp = createBrowserMcpServer(
      filteredRegistry as ToolRegistry,
      browser,
    )

    // Filesystem & memory tools (skip in chat mode)
    const mcpServers: Record<string, McpServerConfig> = {
      'browser-tools': browserMcp,
    }
    const allowedToolNames: string[] = [...filteredRegistry.names()]

    if (!resolvedConfig.chatMode) {
      const fsMcp = createToolSetMcpServer(
        buildFilesystemToolSet(resolvedConfig.sessionExecutionDir),
        'filesystem-tools',
      )
      mcpServers['filesystem-tools'] = fsMcp
      allowedToolNames.push(
        'filesystem_read',
        'filesystem_write',
        'filesystem_edit',
        'filesystem_bash',
        'filesystem_grep',
        'filesystem_find',
        'filesystem_ls',
      )

      const memMcp = createToolSetMcpServer(
        buildMemoryToolSet(),
        'memory-tools',
      )
      mcpServers['memory-tools'] = memMcp
      allowedToolNames.push(
        'memory_search',
        'memory_write',
        'memory_read_core',
        'memory_save_core',
        'soul_read',
        'soul_update',
      )
    }

    // External MCP servers (Klavis, custom) — pass as remote servers
    const externalMcpClients: Array<{ close(): Promise<void> }> = []
    const specs = await buildMcpServerSpecs({
      browserContext: cfg.browserContext,
      klavisClient: cfg.klavisClient,
      browserosId: cfg.browserosId,
    })
    for (const spec of specs) {
      mcpServers[spec.name] = {
        type: spec.transport === 'sse' ? 'sse' : 'http',
        url: spec.url,
        ...(spec.headers && { headers: spec.headers }),
      } as McpServerConfig
    }

    // Build system prompt
    const excludeSections: string[] = ['tool-reference']
    if (resolvedConfig.isScheduledTask) {
      excludeSections.push('tab-grouping')
    }
    const soulContent = await readSoul()
    const isBootstrap = await isSoulBootstrap()
    const instructions = buildSystemPrompt({
      userSystemPrompt: resolvedConfig.userSystemPrompt,
      exclude: excludeSections,
      isScheduledTask: resolvedConfig.isScheduledTask,
      scheduledTaskWindowId: cfg.browserContext?.windowId,
      workspaceDir: resolvedConfig.sessionExecutionDir,
      soulContent,
      isSoulBootstrap: isBootstrap,
      chatMode: resolvedConfig.chatMode,
    })

    if (resolvedConfig.chatMode) {
      logger.info('Chat mode enabled, restricting to read-only browser tools', {
        allowedTools: Array.from(CHAT_MODE_ALLOWED_TOOLS),
      })
    }

    logger.info('Claude Agent session created', {
      conversationId: resolvedConfig.conversationId,
      model: resolvedConfig.model,
      toolCount: allowedToolNames.length,
      mcpServerCount: Object.keys(mcpServers).length,
    })

    return new ClaudeAgent(
      mcpServers,
      externalMcpClients,
      instructions,
      resolvedConfig.model,
      resolvedConfig.apiKey,
      resolvedConfig.conversationId,
      resolvedConfig.chatMode ?? false,
      allowedToolNames,
    )
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

  processMessage(
    abortSignal: AbortSignal,
    onComplete?: () => Promise<void>,
  ): Response {
    const lastMessage = this._messages[this._messages.length - 1]
    const userText =
      lastMessage?.role === 'user'
        ? lastMessage.parts
            .filter(
              (p): p is { type: 'text'; text: string } => p.type === 'text',
            )
            .map((p) => p.text)
            .join('\n')
        : ''

    // Build conversation context from previous messages
    const contextLines: string[] = []
    for (const msg of this._messages.slice(0, -1)) {
      const text = msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
      if (text) {
        contextLines.push(`[${msg.role}]: ${text}`)
      }
    }

    const prompt =
      contextLines.length > 0
        ? `Previous conversation:\n${contextLines.join('\n')}\n\nCurrent message:\n${userText}`
        : userText

    const env: Record<string, string | undefined> = { ...process.env }
    if (this.apiKey) {
      env.ANTHROPIC_API_KEY = this.apiKey
    }

    const abortController = new AbortController()
    abortSignal.addEventListener('abort', () => abortController.abort(), {
      once: true,
    })

    const queryStream = query({
      prompt,
      options: {
        abortController,
        model: this.model,
        systemPrompt: this.instructions,
        tools: [],
        mcpServers: this.mcpServers,
        allowedTools: this.allowedToolNames,
        maxTurns: AGENT_LIMITS.MAX_TURNS,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        persistSession: false,
        env,
        settingSources: [],
      },
    })

    const onFinish = async (responseText: string) => {
      if (responseText) {
        this._messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          parts: [{ type: 'text', text: responseText }],
        })
      }
      logger.info('Claude Agent execution complete', {
        conversationId: this.conversationId,
        totalMessages: this._messages.length,
      })
      await onComplete?.()
    }

    return createClaudeStreamResponse(queryStream, abortSignal, onFinish)
  }

  async dispose(): Promise<void> {
    for (const client of this.externalMcpClients) {
      await client.close().catch(() => {})
    }
    logger.info('Claude Agent disposed', {
      conversationId: this.conversationId,
    })
  }
}
