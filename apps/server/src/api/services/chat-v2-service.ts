import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createAgentUIStreamResponse, type UIMessage } from 'ai'
import { AiSdkAgent } from '../../agent/tool-loop/ai-sdk-agent'
import { formatUserMessage } from '../../agent/tool-loop/format-message'
import type { SessionStore } from '../../agent/tool-loop/session-store'
import type { ResolvedAgentConfig } from '../../agent/types'
import type { Browser } from '../../browser/browser'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { resolveLLMConfig } from '../../lib/clients/llm/config'
import { logger } from '../../lib/logger'
import type { ToolRegistry } from '../../tools/tool-registry'
import type { BrowserContext, ChatRequest } from '../types'

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

    const llmConfig = await resolveLLMConfig(request, this.deps.browserosId)

    const sessionExecutionDir = await this.resolveSessionDir(request)

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

    const isNewSession = !sessionStore.has(request.conversationId)
    let session = sessionStore.get(request.conversationId)

    if (!session) {
      let hiddenWindowId: number | undefined
      let browserContext = await this.resolvePageIds(request.browserContext)
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

    const messageContext = request.isScheduledTask
      ? (session.browserContext ?? request.browserContext)
      : request.browserContext
    const resolvedMessageContext = await this.resolvePageIds(messageContext)
    const userContent = formatUserMessage(
      request.message,
      resolvedMessageContext,
    )
    session.agent.appendUserMessage(userContent)

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

  // Browser context arrives with Chrome tab IDs, but tools expect internal page IDs.
  // Resolve the mapping upfront so the agent's first navigation doesn't fail.
  private async resolvePageIds(
    browserContext?: BrowserContext,
  ): Promise<BrowserContext | undefined> {
    if (!browserContext) return undefined

    const tabIds: number[] = []
    if (browserContext.activeTab) tabIds.push(browserContext.activeTab.id)
    if (browserContext.selectedTabs) {
      for (const tab of browserContext.selectedTabs) tabIds.push(tab.id)
    }
    if (browserContext.tabs) {
      for (const tab of browserContext.tabs) tabIds.push(tab.id)
    }

    if (tabIds.length === 0) return browserContext

    const tabToPage = await this.deps.browser.resolveTabIds(tabIds)

    const addPageId = (tab: { id: number; url?: string; title?: string }) => ({
      ...tab,
      pageId: tabToPage.get(tab.id),
    })

    logger.debug('Resolved tab IDs to page IDs', {
      mapping: Object.fromEntries(tabToPage),
    })

    return {
      ...browserContext,
      activeTab: browserContext.activeTab
        ? addPageId(browserContext.activeTab)
        : undefined,
      selectedTabs: browserContext.selectedTabs?.map(addPageId),
      tabs: browserContext.tabs?.map(addPageId),
    }
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
