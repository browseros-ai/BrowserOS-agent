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
      session = { agent, hiddenWindowId, browserContext }
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

    // For scheduled tasks, use the hidden window's browser context so the model
    // knows the correct pageId and windowId to operate in.
    const messageContext = session.browserContext ?? request.browserContext
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

  private async resolveSessionDir(request: ChatRequest): Promise<string> {
    const dir = request.userWorkingDir
      ? request.userWorkingDir
      : path.join(this.deps.executionDir, 'sessions', request.conversationId)
    await mkdir(dir, { recursive: true })
    return dir
  }
}
