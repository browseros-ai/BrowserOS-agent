/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import {
  executeToolCall,
  type GeminiClient,
  Config as GeminiConfig,
  GeminiEventType,
  type MCPServerConfig,
  type ToolCallRequestInfo,
} from '@google/gemini-cli-core'
import type { Content, Part } from '@google/genai'
import { logger } from '../../common/index'
import { Sentry } from '../../common/sentry/instrument'
import type { BrowserContext } from '../../http/types'
import { AgentExecutionError } from '../errors'
import { buildSystemPrompt } from './gemini-agent.prompt'
import { VercelAIContentGenerator } from './gemini-vercel-sdk-adapter/index'
import type { HonoSSEStream } from './gemini-vercel-sdk-adapter/types'
import { UIMessageStreamWriter } from './gemini-vercel-sdk-adapter/ui-message-stream'
import type { ResolvedAgentConfig } from './types'

export class GeminiAgent {
  private constructor(
    private client: GeminiClient,
    private geminiConfig: GeminiConfig,
    private contentGenerator: VercelAIContentGenerator,
    private conversationId: string,
  ) {}

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

    const geminiConfig = new GeminiConfig({
      sessionId: config.conversationId,
      targetDir: config.tempDir,
      cwd: config.tempDir,
      debugMode: false,
      model: modelString,
      excludeTools: [
        'run_shell_command',
        'write_file',
        'replace',
        'save_memory',
        'google_web_search',
      ],
      compressionThreshold,
      mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
    })

    await geminiConfig.initialize()
    const contentGenerator = new VercelAIContentGenerator(config)

    ;(
      geminiConfig as unknown as { contentGenerator: VercelAIContentGenerator }
    ).contentGenerator = contentGenerator

    const client = geminiConfig.getGeminiClient()
    client
      .getChat()
      .setSystemInstruction(buildSystemPrompt(config.userSystemPrompt))
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

  getHistory(): Content[] {
    return this.client.getHistory()
  }

  async execute(
    message: string,
    honoStream: HonoSSEStream,
    signal?: AbortSignal,
    browserContext?: BrowserContext,
  ): Promise<void> {
    const abortSignal = signal || new AbortController().signal
    const promptId = `${this.conversationId}-${Date.now()}`

    // Prepend browser context to the message if provided
    let messageWithContext = message
    if (browserContext?.activeTab || browserContext?.selectedTabs?.length) {
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

      messageWithContext = `${contextLines.join('\n')}\n\n---\n\n${message}`
    }

    let currentParts: Part[] = [{ text: messageWithContext }]
    let turnCount = 0

    // Create single UIMessageStreamWriter to manage entire stream lifecycle
    const uiStream = honoStream
      ? new UIMessageStreamWriter(async (data) => {
          try {
            await honoStream.write(data)
          } catch {
            // Failed to write to stream
          }
        })
      : null

    // Pass shared writer to content generator for LLM streaming
    this.contentGenerator.setUIStream(uiStream ?? undefined)

    if (uiStream) {
      await uiStream.start()
    }

    logger.info('Starting agent execution', {
      conversationId: this.conversationId,
      message: message.substring(0, 100),
      historyLength: this.client.getHistory().length,
      browserContextWindowId: browserContext?.windowId,
    })

    while (true) {
      turnCount++
      logger.debug(`Turn ${turnCount}`, { conversationId: this.conversationId })

      if (turnCount > AGENT_LIMITS.MAX_TURNS) {
        logger.warn('Max turns exceeded', {
          conversationId: this.conversationId,
          turnCount,
        })
        break
      }

      const toolCallRequests: ToolCallRequestInfo[] = []

      const responseStream = this.client.sendMessageStream(
        currentParts,
        abortSignal,
        promptId,
      )

      for await (const event of responseStream) {
        if (abortSignal.aborted) {
          break
        }

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
        // Other events are handled by the content generator
      }

      // Check abort after processing stream
      if (abortSignal.aborted) {
        logger.info('Agent execution aborted', {
          conversationId: this.conversationId,
          turnCount,
        })
        break
      }

      if (toolCallRequests.length > 0) {
        logger.debug(`Executing ${toolCallRequests.length} tool(s)`, {
          conversationId: this.conversationId,
          tools: toolCallRequests.map((r) => r.name),
        })

        const toolResponseParts: Part[] = []

        for (const requestInfo of toolCallRequests) {
          // Check abort before each tool execution
          if (abortSignal.aborted) {
            break
          }

          // Inject windowId into ALL browser tools for multi-window/multi-profile routing
          // The server uses windowId to route requests to the correct extension instance
          if (
            browserContext?.windowId &&
            requestInfo.name.startsWith('browser_')
          ) {
            logger.debug('Injecting windowId into tool args', {
              tool: requestInfo.name,
              windowId: browserContext.windowId,
            })
            requestInfo.args = {
              ...requestInfo.args,
              windowId: browserContext.windowId,
            }
          }

          try {
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

            const completedToolCall = await Promise.race([
              executeToolCall(this.geminiConfig, requestInfo, abortSignal),
              timeoutPromise,
            ])

            const toolResponse = completedToolCall.response

            if (toolResponse.error) {
              logger.warn('Tool execution error', {
                conversationId: this.conversationId,
                tool: requestInfo.name,
                error: toolResponse.error.message,
              })
              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: requestInfo.name,
                  response: { error: toolResponse.error.message },
                },
              } as Part)
              if (uiStream) {
                await uiStream.writeToolError(
                  requestInfo.callId,
                  toolResponse.error.message,
                )
              }
            } else if (
              toolResponse.responseParts &&
              toolResponse.responseParts.length > 0
            ) {
              toolResponseParts.push(...(toolResponse.responseParts as Part[]))
              if (uiStream) {
                await uiStream.writeToolResult(
                  requestInfo.callId,
                  toolResponse.responseParts,
                )
              }
            } else {
              logger.warn('Tool returned empty response', {
                conversationId: this.conversationId,
                tool: requestInfo.name,
              })
              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: requestInfo.name,
                  response: { output: 'Tool executed but returned no output.' },
                },
              } as Part)
              if (uiStream) {
                await uiStream.writeToolError(
                  requestInfo.callId,
                  'Tool executed but returned no output.',
                )
              }
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            logger.error('Tool execution failed', {
              conversationId: this.conversationId,
              tool: requestInfo.name,
              error: errorMessage,
            })

            toolResponseParts.push({
              functionResponse: {
                id: requestInfo.callId,
                name: requestInfo.name,
                response: { error: errorMessage },
              },
            } as Part)
            if (uiStream) {
              await uiStream.writeToolError(requestInfo.callId, errorMessage)
            }
          }
        }

        // Check if aborted during tool execution
        if (abortSignal.aborted) {
          break
        }

        // Finish the step after all tool outputs are written
        if (uiStream) {
          await uiStream.finishStep()
        }

        currentParts = toolResponseParts
      } else {
        logger.info('Agent execution complete', {
          conversationId: this.conversationId,
          totalTurns: turnCount,
        })
        break
      }
    }

    // Finish the UI stream after all turns complete
    if (uiStream) {
      await uiStream.finish()
    }
  }
}
