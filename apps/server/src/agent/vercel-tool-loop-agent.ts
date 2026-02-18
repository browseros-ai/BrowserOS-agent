/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import {
  createAgentUIStreamResponse,
  dynamicTool,
  jsonSchema,
  stepCountIs,
  ToolLoopAgent,
  type UIMessage,
} from 'ai'
import type { BrowserContext } from '../api/types'
import { callMcpTool, listMcpTools } from '../api/utils/mcp-client'
import { createLLMProvider } from '../lib/clients/llm/provider'
import { logger } from '../lib/logger'
import { allCdpTools } from '../tools/cdp-based/registry'
import { allControllerTools } from '../tools/controller-based/registry'
import { buildSystemPrompt } from './prompt'
import type { HonoSSEStream } from './provider-adapter/types'
import type { McpServerSpec, ResolvedAgentConfig } from './types'

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

interface ToolExecutionState {
  windowId?: number
}

export class VercelToolLoopAgent {
  private history: UIMessage[] = []

  private constructor(
    private agent: ToolLoopAgent,
    private state: ToolExecutionState,
    private conversationId: string,
  ) {}

  static async create(
    config: ResolvedAgentConfig,
    mcpServers: Record<string, McpServerSpec>,
  ): Promise<VercelToolLoopAgent> {
    const model = createLLMProvider({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      upstreamProvider: config.upstreamProvider,
      resourceName: config.resourceName,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    })

    const excludedTools = new Set(['save_memory', 'google_web_search'])
    if (config.supportsImages === false) {
      excludedTools.add('browser_get_screenshot')
      excludedTools.add('browser_get_screenshot_pointer')
    }
    if (config.evalMode !== true) {
      excludedTools.add('browser_create_window')
      excludedTools.add('browser_close_window')
    }
    if (config.chatMode === true) {
      const allToolNames = [
        ...allControllerTools.map((t) => t.name),
        ...allCdpTools.map((t) => t.name),
      ]
      for (const name of allToolNames) {
        if (!CHAT_MODE_ALLOWED_TOOLS.has(name)) excludedTools.add(name)
      }
    }

    const state: ToolExecutionState = {}
    const tools: Record<string, ReturnType<typeof dynamicTool>> = {}

    for (const [serverName, server] of Object.entries(mcpServers)) {
      if (server.transport !== 'streamable-http') {
        logger.warn('Skipping non-streamable MCP server for Vercel agent PoC', {
          serverName,
          transport: server.transport,
        })
        continue
      }

      const discovered = await listMcpTools(server.url, {
        headers: server.headers,
      })

      for (const discoveredTool of discovered) {
        const toolName = discoveredTool.name
        if (excludedTools.has(toolName)) continue
        if (tools[toolName]) {
          logger.warn('Duplicate MCP tool name detected; keeping first', {
            toolName,
            serverName,
          })
          continue
        }

        tools[toolName] = dynamicTool({
          description: discoveredTool.description ?? `MCP tool ${toolName}`,
          inputSchema: jsonSchema(discoveredTool.inputSchema),
          execute: async (input: unknown) => {
            const headers = {
              ...server.headers,
              ...(state.windowId != null && {
                'X-BrowserOS-Window-Id': String(state.windowId),
              }),
            }

            const args =
              input && typeof input === 'object'
                ? (input as Record<string, unknown>)
                : {}

            return callMcpTool(server.url, toolName, args, { headers })
          },
        })
      }
    }

    const excludeSections: string[] = []
    if (config.isScheduledTask) excludeSections.push('tab-grouping')

    const agent = new ToolLoopAgent({
      model,
      instructions: buildSystemPrompt({
        userSystemPrompt: config.userSystemPrompt,
        exclude: excludeSections,
      }),
      tools,
      stopWhen: [stepCountIs(AGENT_LIMITS.MAX_TURNS)],
    })

    logger.info('VercelToolLoopAgent created', {
      conversationId: config.conversationId,
      provider: config.provider,
      model: config.model,
      toolCount: Object.keys(tools).length,
    })

    return new VercelToolLoopAgent(agent, state, config.conversationId)
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

  getHistory(): UIMessage[] {
    return this.history
  }

  dispose(): void {
    this.history = []
  }

  async execute(
    message: string,
    honoStream: HonoSSEStream,
    signal?: AbortSignal,
    browserContext?: BrowserContext,
    previousConversation?: string,
  ): Promise<void> {
    this.state.windowId = browserContext?.windowId
    const contextPrefix = this.formatBrowserContext(browserContext)

    const userQuery = `<USER_QUERY>
${message}
</USER_QUERY>`

    let fullMessage = userQuery
    if (previousConversation) {
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

    const uiMessages = [
      ...this.history,
      {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: contextPrefix + fullMessage }],
      },
    ]

    const response = await createAgentUIStreamResponse({
      agent: this.agent,
      uiMessages,
      abortSignal: signal,
      onFinish: ({ messages }) => {
        this.history = messages
      },
    })

    if (!response.body) {
      throw new Error('Agent UI stream response body is not readable')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        await honoStream.write(chunk)
      }
    } finally {
      reader.releaseLock()
    }
  }
}
