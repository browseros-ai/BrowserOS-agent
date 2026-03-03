import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createAgentUIStreamResponse, type UIMessage } from 'ai'
import type { ChatRequest } from '../../api/types'
import type { Browser } from '../../browser/browser'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { resolveLLMConfig } from '../../lib/clients/llm/config'
import { logger } from '../../lib/logger'
import type { ToolRegistry } from '../../tools/tool-registry'
import type { ResolvedAgentConfig } from '../types'
import { AiSdkAgent } from './ai-sdk-agent'
import { formatUserMessage } from './format-message'
import type { SessionStore } from './session-store'

export interface ChatV2ServiceDeps {
  sessionStore: SessionStore
  klavisClient: KlavisClient
  executionDir: string
  browser: Browser
  registry: ToolRegistry
  browserosId?: string
}

export class ChatV2Service {
  constructor(private deps: ChatV2ServiceDeps) {}

  async processMessage(
    request: ChatRequest,
    abortSignal: AbortSignal,
  ): Promise<Response> {
    const { sessionStore } = this.deps

    // Resolve LLM provider config (handles BROWSEROS gateway lookup)
    const llmConfig = await resolveLLMConfig(request, this.deps.browserosId)

    // Resolve session working directory
    const sessionExecutionDir = await this.resolveSessionDir(request)

    // Build full agent config
    const agentConfig: ResolvedAgentConfig = {
      conversationId: request.conversationId,
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      upstreamProvider: llmConfig.upstreamProvider,
      resourceName: llmConfig.resourceName,
      region: llmConfig.region,
      accessKeyId: llmConfig.accessKeyId,
      secretAccessKey: llmConfig.secretAccessKey,
      sessionToken: llmConfig.sessionToken,
      contextWindowSize: request.contextWindowSize,
      userSystemPrompt: request.userSystemPrompt,
      sessionExecutionDir,
      supportsImages: request.supportsImages,
      chatMode: request.mode === 'chat',
      isScheduledTask: request.isScheduledTask,
    }

    // Get or create agent session
    const isNewSession = !sessionStore.has(request.conversationId)
    let session = sessionStore.get(request.conversationId)
    const mcpServerKey = this.buildMcpServerKey(request)

    // Recreate session if MCP servers changed (e.g. user connected a new app)
    if (session && session.mcpServerKey !== mcpServerKey) {
      logger.info('MCP servers changed, recreating agent session', {
        conversationId: request.conversationId,
        previousKey: session.mcpServerKey,
        newKey: mcpServerKey,
      })
      const previousMessages = session.agent.messages
      await session.agent.dispose()

      const agent = await AiSdkAgent.create({
        resolvedConfig: agentConfig,
        browser: this.deps.browser,
        registry: this.deps.registry,
        browserContext: request.browserContext,
        klavisClient: this.deps.klavisClient,
        browserosId: this.deps.browserosId,
      })
      agent.messages = previousMessages
      session = {
        agent,
        hiddenWindowId: session.hiddenWindowId,
        browserContext: request.browserContext,
        mcpServerKey,
      }
      sessionStore.set(request.conversationId, session)
    }

    if (!session) {
      // For scheduled tasks, create a hidden window so automation
      // doesn't interfere with the user's visible browser.
      let hiddenWindowId: number | undefined
      let browserContext = request.browserContext
      if (request.isScheduledTask) {
        try {
          const win = await this.deps.browser.createWindow({ hidden: true })
          hiddenWindowId = win.windowId
          const pageId = await this.deps.browser.newPage('about:blank', {
            windowId: hiddenWindowId,
          })
          browserContext = {
            ...browserContext,
            windowId: hiddenWindowId,
            activeTab: {
              id: pageId,
              pageId,
              url: 'about:blank',
              title: 'Scheduled Task',
            },
          }
          logger.info('Created hidden window for scheduled task', {
            conversationId: request.conversationId,
            windowId: hiddenWindowId,
            pageId,
          })
        } catch (error) {
          logger.warn('Failed to create hidden window, using default', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const agent = await AiSdkAgent.create({
        resolvedConfig: agentConfig,
        browser: this.deps.browser,
        registry: this.deps.registry,
        browserContext,
        klavisClient: this.deps.klavisClient,
        browserosId: this.deps.browserosId,
      })
      session = { agent, hiddenWindowId, browserContext, mcpServerKey }
      sessionStore.set(request.conversationId, session)
    }

    // Inject previous conversation as history for resumed sessions
    if (isNewSession && request.previousConversation?.length) {
      for (const msg of request.previousConversation) {
        session.agent.messages.push({
          id: crypto.randomUUID(),
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          parts: [{ type: 'text', text: msg.content }],
        })
      }
      logger.info('Injected previous conversation history', {
        conversationId: request.conversationId,
        messageCount: request.previousConversation.length,
      })
    }

    // Scheduled tasks use the session's browser context (hidden window with
    // correct pageId/windowId). Normal messages use the request's browser
    // context so that freshly selected tabs are always included.
    const messageContext = request.isScheduledTask
      ? (session.browserContext ?? request.browserContext)
      : request.browserContext
    const userContent = formatUserMessage(request.message, messageContext)
    session.agent.appendUserMessage(userContent)

    // Stream the agent response
    return createAgentUIStreamResponse({
      agent: session.agent.toolLoopAgent,
      uiMessages: session.agent.messages,
      abortSignal,
      onFinish: async ({ messages }: { messages: UIMessage[] }) => {
        if (session) {
          session.agent.messages = messages
        }
        logger.info('Agent execution complete', {
          conversationId: request.conversationId,
          totalMessages: messages.length,
        })

        if (session?.hiddenWindowId) {
          const windowId = session.hiddenWindowId
          session.hiddenWindowId = undefined
          this.closeHiddenWindow(windowId, request.conversationId)
        }
      },
    })
  }

  async deleteSession(
    conversationId: string,
  ): Promise<{ deleted: boolean; sessionCount: number }> {
    const session = this.deps.sessionStore.get(conversationId)
    if (session?.hiddenWindowId) {
      const windowId = session.hiddenWindowId
      session.hiddenWindowId = undefined
      this.closeHiddenWindow(windowId, conversationId)
    }
    const deleted = await this.deps.sessionStore.delete(conversationId)
    return { deleted, sessionCount: this.deps.sessionStore.count() }
  }

  private closeHiddenWindow(windowId: number, conversationId: string): void {
    this.deps.browser.closeWindow(windowId).catch((error) => {
      logger.warn('Failed to close hidden window', {
        windowId,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  private buildMcpServerKey(request: ChatRequest): string {
    const managed =
      request.browserContext?.enabledMcpServers?.slice().sort() ?? []
    const custom =
      request.browserContext?.customMcpServers
        ?.map((s) => `${s.name}:${s.url}`)
        .sort() ?? []
    return [...managed, ...custom].join(',')
  }

  private async resolveSessionDir(request: ChatRequest): Promise<string> {
    const dir = request.userWorkingDir
      ? request.userWorkingDir
      : path.join(this.deps.executionDir, 'sessions', request.conversationId)
    await mkdir(dir, { recursive: true })
    return dir
  }
}
