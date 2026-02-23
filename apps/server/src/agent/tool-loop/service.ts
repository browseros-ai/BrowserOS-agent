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
      const agent = await AiSdkAgent.create({
        resolvedConfig: agentConfig,
        browser: this.deps.browser,
        registry: this.deps.registry,
        browserContext: request.browserContext,
        klavisClient: this.deps.klavisClient,
        browserosId: this.deps.browserosId,
      })
      session = { agent }
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

    // Format and append the current user message
    const userContent = formatUserMessage(
      request.message,
      request.browserContext,
    )
    session.agent.appendUserMessage(userContent)

    // Stream the agent response
    return createAgentUIStreamResponse({
      agent: session.agent.toolLoopAgent,
      uiMessages: session.agent.messages,
      abortSignal,
      onFinish: ({ messages }: { messages: UIMessage[] }) => {
        if (session) {
          session.agent.messages = messages
        }
        logger.info('Agent execution complete', {
          conversationId: request.conversationId,
          totalMessages: messages.length,
        })
      },
    })
  }

  async deleteSession(
    conversationId: string,
  ): Promise<{ deleted: boolean; sessionCount: number }> {
    const deleted = await this.deps.sessionStore.delete(conversationId)
    return { deleted, sessionCount: this.deps.sessionStore.count() }
  }

  private async resolveSessionDir(request: ChatRequest): Promise<string> {
    const dir = request.userWorkingDir
      ? request.userWorkingDir
      : path.join(this.deps.executionDir, 'sessions', request.conversationId)
    await mkdir(dir, { recursive: true })
    return dir
  }
}
