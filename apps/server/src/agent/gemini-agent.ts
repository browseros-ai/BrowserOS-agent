/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import {
  ApprovalMode,
  executeToolCall,
  type GeminiClient,
  Config as GeminiConfig,
  GeminiEventType,
  type MCPServerConfig,
  type ToolCallRequestInfo,
} from '@google/gemini-cli-core'
import type { Content, Part } from '@google/genai'
import type { BrowserContext } from '../api/types'
import { logger } from '../lib/logger'
import { Sentry } from '../lib/sentry'
import { allCdpTools } from '../tools/cdp-based/registry'
import { allControllerTools } from '../tools/controller-based/registry'
import { AgentExecutionError } from './errors'
import { buildSystemPrompt } from './prompt'
import { VercelAIContentGenerator } from './provider-adapter/index'
import type { HonoSSEStream } from './provider-adapter/types'
import { UIMessageStreamWriter } from './provider-adapter/ui-message-stream'
import type { ResolvedAgentConfig } from './types'

const CHAT_MODE_ALLOWED_TOOLS = new Set([
  'browser_get_active_tab',
  'browser_list_tabs',
  'browser_get_page_content',
  'browser_scroll_down',
  'browser_scroll_up',
  'browser_get_screenshot',
  'browser_get_interactive_elements',
  'browser_execute_javascript',
])

export interface ToolExecutionResult {
  parts: Part[]
  isError: boolean
  errorMessage?: string
}

export interface ToolExecutionHooks {
  onBeforeToolCall?: (
    toolName: string,
    args: unknown,
    browserContext?: BrowserContext,
  ) => Promise<void>

  onAfterToolCall?: (
    toolName: string,
    result: ToolExecutionResult,
    browserContext?: BrowserContext,
  ) => Promise<void>
}

export class GeminiAgent {
  private toolHooks?: ToolExecutionHooks

  private constructor(
    private client: GeminiClient,
    private geminiConfig: GeminiConfig,
    private contentGenerator: VercelAIContentGenerator,
    private conversationId: string,
  ) {}

  setToolHooks(hooks: ToolExecutionHooks): void {
    this.toolHooks = hooks
  }

  /**
   * Creates a GeminiAgent with pre-resolved config and MCP servers.
   * Config resolution and MCP building happens in ChatService (visible there).
   */
  static async create(
    config: ResolvedAgentConfig,
    mcpServers: Record<string, MCPServerConfig>,
  ): Promise<GeminiAgent> {
    // Build model string with upstream provider if available
    const modelString = config.upstreamProvider
      ? `${config.upstreamProvider}/${config.model}`
      : `${config.provider}/${config.model}`

    // Calculate compression threshold based on context window size
    const contextWindow =
      config.contextWindowSize ?? AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW

    // Hybrid compression: ensure minimum headroom while capping ratio for large contexts
    const headroomBasedRatio =
      (contextWindow - AGENT_LIMITS.COMPRESSION_MIN_HEADROOM) / contextWindow
    const compressionRatio = Math.min(
      AGENT_LIMITS.COMPRESSION_MAX_RATIO,
      Math.max(AGENT_LIMITS.COMPRESSION_MIN_RATIO, headroomBasedRatio),
    )
    const compressionThreshold =
      (compressionRatio * contextWindow) / AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW

    logger.info('Compression config', {
      contextWindow,
      compressionRatio,
      compressionThreshold,
      compressesAtTokens: Math.floor(compressionRatio * contextWindow),
    })

    logger.debug('MCP servers config', {
      serverCount: Object.keys(mcpServers).length,
      servers: Object.keys(mcpServers),
    })

    // Build excluded tools list - always exclude save_memory and google_web_search
    // Conditionally exclude screenshot tools if model doesn't support images
    // Exclude window management tools unless in eval mode
    // In chat mode, only allow read-only tools for page content extraction
    const excludedTools = ['save_memory', 'google_web_search']
    if (config.supportsImages === false) {
      excludedTools.push(
        'browser_get_screenshot',
        'browser_get_screenshot_pointer',
      )
      logger.info('Model does not support images, excluding screenshot tools')
    }
    // Chat mode: restrict to read-only tools only (no browser automation)
    if (config.chatMode === true) {
      const allToolNames = [
        ...allControllerTools.map((t) => t.name),
        ...allCdpTools.map((t) => t.name),
      ]
      const chatModeExcludedTools = allToolNames.filter(
        (name) => !CHAT_MODE_ALLOWED_TOOLS.has(name),
      )
      excludedTools.push(...chatModeExcludedTools)
      logger.info('Chat mode enabled, restricting to read-only tools', {
        allowedTools: Array.from(CHAT_MODE_ALLOWED_TOOLS),
      })
    }

    const geminiConfig = new GeminiConfig({
      sessionId: config.conversationId,
      targetDir: config.sessionExecutionDir,
      cwd: config.sessionExecutionDir,
      debugMode: false,
      model: modelString,
      excludeTools: excludedTools,
      compressionThreshold,
      mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
      // Server/headless mode: auto-approve tools, no IDE integration
      ideMode: false,
      approvalMode: ApprovalMode.YOLO,
      trustedFolder: true,
      interactive: false,
    })

    await geminiConfig.initialize()
    const contentGenerator = new VercelAIContentGenerator(config)

    ;(
      geminiConfig as unknown as { contentGenerator: VercelAIContentGenerator }
    ).contentGenerator = contentGenerator

    const client = geminiConfig.getGeminiClient()
    const excludeSections: string[] = []
    if (config.isScheduledTask) excludeSections.push('tab-grouping')

    client.getChat().setSystemInstruction(
      buildSystemPrompt({
        userSystemPrompt: config.userSystemPrompt,
        exclude: excludeSections,
      }),
    )
    await client.setTools()

    // Disable chat recording to prevent disk writes
    const recordingService = client.getChatRecordingService()
    if (recordingService) {
      ;(
        recordingService as unknown as { conversationFile: string | null }
      ).conversationFile = null
    }

    logger.info('GeminiAgent created', {
      conversationId: config.conversationId,
      provider: config.provider,
      model: config.model,
    })

    return new GeminiAgent(
      client,
      geminiConfig,
      contentGenerator,
      config.conversationId,
    )
  }

  private formatBrowserContext(browserContext?: BrowserContext): string {
    if (!browserContext?.activeTab && !browserContext?.selectedTabs?.length) {
      return ''
    }

    const formatTab = (tab: { id: number; url?: string; title?: string }) =>
      `Tab ${tab.id}${tab.title ? ` - "${tab.title}"` : ''}${tab.url ? ` (${tab.url})` : ''}`

    const contextLines: string[] = ['## Browser Context']

    if (browserContext.activeTab) {
      contextLines.push(
        `**User's Active Tab:** ${formatTab(browserContext.activeTab)}`,
      )
    }

    if (browserContext.selectedTabs?.length) {
      contextLines.push(
        `**User's Selected Tabs (${browserContext.selectedTabs.length}):**`,
      )
      browserContext.selectedTabs.forEach((tab, i) => {
        contextLines.push(`  ${i + 1}. ${formatTab(tab)}`)
      })
    }

    return `${contextLines.join('\n')}\n\n---\n\n`
  }

  private async executeToolWithTimeout(
    requestInfo: ToolCallRequestInfo,
    abortSignal: AbortSignal,
  ): Promise<{
    response: { error?: { message: string }; responseParts?: unknown[] }
  }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Tool "${requestInfo.name}" timed out after ${TIMEOUTS.TOOL_CALL / 1000}s`,
            ),
          ),
        TIMEOUTS.TOOL_CALL,
      )
    })

    return Promise.race([
      executeToolCall(this.geminiConfig, requestInfo, abortSignal),
      timeoutPromise,
    ])
  }

  private async handleToolExecution(
    requestInfo: ToolCallRequestInfo,
    abortSignal: AbortSignal,
  ): Promise<ToolExecutionResult> {
    try {
      const completedToolCall = await this.executeToolWithTimeout(
        requestInfo,
        abortSignal,
      )
      const toolResponse = completedToolCall.response

      if (toolResponse.error) {
        logger.warn('Tool execution error', {
          conversationId: this.conversationId,
          tool: requestInfo.name,
          error: toolResponse.error.message,
        })
        return {
          parts: [
            {
              functionResponse: {
                id: requestInfo.callId,
                name: requestInfo.name,
                response: { error: toolResponse.error.message },
              },
            } as Part,
          ],
          isError: true,
          errorMessage: toolResponse.error.message,
        }
      }

      if (toolResponse.responseParts && toolResponse.responseParts.length > 0) {
        return {
          parts: toolResponse.responseParts as Part[],
          isError: false,
        }
      }

      logger.warn('Tool returned empty response', {
        conversationId: this.conversationId,
        tool: requestInfo.name,
      })
      return {
        parts: [
          {
            functionResponse: {
              id: requestInfo.callId,
              name: requestInfo.name,
              response: { output: 'Tool executed but returned no output.' },
            },
          } as Part,
        ],
        isError: true,
        errorMessage: 'Tool executed but returned no output.',
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Tool execution failed', {
        conversationId: this.conversationId,
        tool: requestInfo.name,
        error: errorMessage,
      })
      return {
        parts: [
          {
            functionResponse: {
              id: requestInfo.callId,
              name: requestInfo.name,
              response: { error: errorMessage },
            },
          } as Part,
        ],
        isError: true,
        errorMessage,
      }
    }
  }

  private async processToolRequests(
    toolCallRequests: ToolCallRequestInfo[],
    abortSignal: AbortSignal,
    uiStream: UIMessageStreamWriter | null,
    browserContext?: BrowserContext,
  ): Promise<Part[]> {
    const toolResponseParts: Part[] = []

    for (const requestInfo of toolCallRequests) {
      if (abortSignal.aborted) break

      await this.toolHooks?.onBeforeToolCall?.(
        requestInfo.name,
        requestInfo.args,
        browserContext,
      )

      const result = await this.handleToolExecution(requestInfo, abortSignal)

      await this.toolHooks?.onAfterToolCall?.(
        requestInfo.name,
        result,
        browserContext,
      )

      toolResponseParts.push(...result.parts)

      if (uiStream) {
        if (result.isError) {
          await uiStream.writeToolError(
            requestInfo.callId,
            result.errorMessage || 'Unknown error',
          )
        } else {
          await uiStream.writeToolResult(requestInfo.callId, result.parts)
        }
      }
    }

    return toolResponseParts
  }

  getHistory(): Content[] {
    return this.client.getHistory()
  }

  async execute(
    message: string,
    honoStream: HonoSSEStream,
    signal?: AbortSignal,
    browserContext?: BrowserContext,
    previousConversation?: string,
  ): Promise<void> {
    const abortSignal = signal || new AbortController().signal
    const promptId = `${this.conversationId}-${Date.now()}`

    const contextPrefix = this.formatBrowserContext(browserContext)

    // User query
    const userQuery = `<USER_QUERY>
${message}
</USER_QUERY>`

    // Inject previous conversation if resuming (no server-side history)
    let fullMessage = userQuery
    const hasHistory = this.client.getHistory().length > 0
    if (previousConversation && !hasHistory) {
      fullMessage = `<previous_conversation>
The user is resuming a previous conversation. Here is the conversation history for context:

${previousConversation}
</previous_conversation>

Continue the conversation based on the above context. Here is the user's new message:

${userQuery}`
      logger.info('Injecting previous conversation for resume', {
        conversationId: this.conversationId,
        historyLength: previousConversation.length,
      })
    }

    let currentParts: Part[] = [{ text: contextPrefix + fullMessage }]
    let turnCount = 0

    const uiStream = honoStream
      ? new UIMessageStreamWriter(async (data) => {
          try {
            await honoStream.write(data)
          } catch {
            // Failed to write to stream
          }
        })
      : null

    this.contentGenerator.setUIStream(uiStream ?? undefined)
    if (uiStream) await uiStream.start()

    logger.info('Starting agent execution', {
      conversationId: this.conversationId,
      message: message.substring(0, 100),
      historyLength: this.client.getHistory().length,
      browserContextWindowId: browserContext?.windowId,
    })

    while (turnCount++ < AGENT_LIMITS.MAX_TURNS) {
      logger.debug(`Turn ${turnCount}`, {
        conversationId: this.conversationId,
      })

      const toolCallRequests: ToolCallRequestInfo[] = []
      const responseStream = this.client.sendMessageStream(
        currentParts,
        abortSignal,
        promptId,
      )

      for await (const event of responseStream) {
        if (abortSignal.aborted) break
        if (event.type === GeminiEventType.ToolCallRequest) {
          toolCallRequests.push(event.value as ToolCallRequestInfo)
        } else if (event.type === GeminiEventType.Error) {
          const errorValue = event.value as { error: Error }
          Sentry.captureException(errorValue.error)
          throw new AgentExecutionError(
            'Agent execution failed',
            errorValue.error,
          )
        }
      }

      if (abortSignal.aborted) {
        logger.info('Agent execution aborted', {
          conversationId: this.conversationId,
          turnCount,
        })
        break
      }

      if (toolCallRequests.length === 0) {
        logger.info('Agent execution complete', {
          conversationId: this.conversationId,
          totalTurns: turnCount,
        })
        break
      }

      logger.debug(`Executing ${toolCallRequests.length} tool(s)`, {
        conversationId: this.conversationId,
        tools: toolCallRequests.map((r) => r.name),
      })

      currentParts = await this.processToolRequests(
        toolCallRequests,
        abortSignal,
        uiStream,
        browserContext,
      )

      if (abortSignal.aborted) break
      if (uiStream) await uiStream.finishStep()
    }

    if (turnCount > AGENT_LIMITS.MAX_TURNS) {
      logger.warn('Max turns exceeded', {
        conversationId: this.conversationId,
        turnCount,
      })
    }

    if (uiStream) await uiStream.finish()
  }
}
