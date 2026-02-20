import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createMCPClient } from '@ai-sdk/mcp'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import { PATHS } from '@browseros/shared/constants/paths'
import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { zValidator } from '@hono/zod-validator'
import {
  createAgentUIStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  type ToolSet,
} from 'ai'
import { Hono } from 'hono'
import { buildSystemPrompt } from '../../agent/prompt'
import { createLanguageModel } from '../../agent/runtime/provider-factory'
import {
  type AgentSession,
  SessionStore,
} from '../../agent/runtime/session-store'
import type { ProviderConfig, ResolvedAgentConfig } from '../../agent/types'
import { INLINED_ENV } from '../../env'
import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '../../lib/clients/gateway'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import {
  detectMcpTransport,
  type McpTransportType,
} from '../../lib/mcp-transport-detect'
import { metrics } from '../../lib/metrics'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import { Sentry } from '../../lib/sentry'
import { createBrowserosRateLimitMiddleware } from '../middleware/rate-limit'
import type { BrowserContext, ChatRequest } from '../types'
import { ChatRequestSchema } from '../types'
import { ConversationIdParamSchema } from '../utils/validation'

interface McpServerSpec {
  name: string
  url: string
  transport: McpTransportType
  headers?: Record<string, string>
}

interface ChatV2RouteDeps {
  port: number
  executionDir?: string
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatV2Routes(deps: ChatV2RouteDeps) {
  const { port, browserosId, rateLimiter } = deps
  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`
  const executionDir = deps.executionDir || PATHS.DEFAULT_EXECUTION_DIR
  const klavisClient = new KlavisClient()
  const sessionStore = new SessionStore()

  return new Hono()
    .post(
      '/',
      zValidator('json', ChatRequestSchema),
      createBrowserosRateLimitMiddleware({ rateLimiter, browserosId }),
      async (c) => {
        const request = c.req.valid('json')

        Sentry.getCurrentScope().setTag(
          'request-type',
          request.isScheduledTask ? 'schedule' : 'chat',
        )
        Sentry.setContext('request', {
          provider: request.provider,
          model: request.model,
          baseUrl: request.baseUrl,
        })

        metrics.log('chat-v2.request', {
          provider: request.provider,
          model: request.model,
        })

        logger.info('Chat-v2 request received', {
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
        })

        const providerConfig = await resolveProviderConfig(request, browserosId)
        const sessionDir = await resolveSessionDir(request, executionDir)

        const agentConfig: ResolvedAgentConfig = {
          conversationId: request.conversationId,
          provider: providerConfig.provider,
          model: providerConfig.model,
          apiKey: providerConfig.apiKey,
          baseUrl: providerConfig.baseUrl,
          upstreamProvider: providerConfig.upstreamProvider,
          resourceName: providerConfig.resourceName,
          region: providerConfig.region,
          accessKeyId: providerConfig.accessKeyId,
          secretAccessKey: providerConfig.secretAccessKey,
          sessionToken: providerConfig.sessionToken,
          contextWindowSize: request.contextWindowSize,
          userSystemPrompt: request.userSystemPrompt,
          sessionExecutionDir: sessionDir,
          supportsImages: request.supportsImages,
          chatMode: request.mode === 'chat',
          isScheduledTask: request.isScheduledTask,
        }

        const isNewSession = !sessionStore.has(request.conversationId)
        let session = sessionStore.get(request.conversationId)

        if (!session) {
          session = await createAgentSession(
            agentConfig,
            mcpServerUrl,
            request.browserContext,
            klavisClient,
            browserosId,
          )
          sessionStore.set(request.conversationId, session)
        }

        const userContent = formatUserMessage(
          request.message,
          request.browserContext,
          isNewSession ? request.previousConversation : undefined,
          request.conversationId,
        )
        session.messages.push({
          id: crypto.randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: userContent }],
        })

        const response = await createAgentUIStreamResponse({
          agent: session.agent,
          uiMessages: session.messages,
          abortSignal: c.req.raw.signal,
          onFinish: ({ messages }) => {
            if (session) {
              session.messages = messages
            }
            logger.info('Agent execution complete', {
              conversationId: request.conversationId,
              totalMessages: messages.length,
            })
          },
        })

        return response
      },
    )
    .delete(
      '/:conversationId',
      zValidator('param', ConversationIdParamSchema),
      async (c) => {
        const { conversationId } = c.req.valid('param')
        const deleted = await sessionStore.delete(conversationId)

        if (deleted) {
          return c.json({
            success: true,
            message: `Session ${conversationId} deleted`,
            sessionCount: sessionStore.count(),
          })
        }

        return c.json(
          { success: false, message: `Session ${conversationId} not found` },
          404,
        )
      },
    )
}

async function createAgentSession(
  config: ResolvedAgentConfig,
  mcpServerUrl: string,
  browserContext?: BrowserContext,
  klavisClient?: KlavisClient,
  browserosId?: string,
): Promise<AgentSession> {
  const model = createLanguageModel(config)

  const mcpSpecs = buildMcpServerSpecs({
    mcpServerUrl,
    browserContext,
    klavisClient,
    browserosId,
  })

  const mcpClients: Array<{ close(): Promise<void> }> = []
  let mcpTools: ToolSet = {}

  for (const spec of await mcpSpecs) {
    const client = await createMCPClient({
      transport: {
        type: spec.transport === 'sse' ? 'sse' : 'http',
        url: spec.url,
        headers: spec.headers,
      },
    })
    mcpClients.push(client)
    const tools = await client.tools()
    mcpTools = { ...mcpTools, ...tools }
  }

  const excludeSections: string[] = []
  if (config.isScheduledTask) excludeSections.push('tab-grouping')

  const instructions = buildSystemPrompt({
    userSystemPrompt: config.userSystemPrompt,
    exclude: excludeSections,
  })

  const agent = new ToolLoopAgent({
    model,
    instructions,
    tools: mcpTools,
    stopWhen: [stepCountIs(AGENT_LIMITS.MAX_TURNS)],
  })

  logger.info('Agent session created (v2)', {
    conversationId: config.conversationId,
    provider: config.provider,
    model: config.model,
    toolCount: Object.keys(mcpTools).length,
  })

  return { agent, messages: [], mcpClients }
}

async function buildMcpServerSpecs(deps: {
  mcpServerUrl: string
  browserContext?: BrowserContext
  klavisClient?: KlavisClient
  browserosId?: string
}): Promise<McpServerSpec[]> {
  const specs: McpServerSpec[] = []

  if (deps.mcpServerUrl) {
    specs.push({
      name: 'browseros-mcp',
      url: deps.mcpServerUrl,
      transport: 'streamable-http',
      headers: {
        Accept: 'application/json, text/event-stream',
        'X-BrowserOS-Source': 'agent-runtime',
        ...(deps.browserContext?.windowId != null && {
          'X-BrowserOS-Window-Id': String(deps.browserContext.windowId),
        }),
      },
    })
  }

  if (
    deps.browserosId &&
    deps.klavisClient &&
    deps.browserContext?.enabledMcpServers?.length
  ) {
    try {
      const result = await deps.klavisClient.createStrata(
        deps.browserosId,
        deps.browserContext.enabledMcpServers,
      )
      specs.push({
        name: 'klavis-strata',
        url: result.strataServerUrl,
        transport: 'streamable-http',
      })
      logger.info('Added Klavis Strata MCP server', {
        browserosId: deps.browserosId.slice(0, 12),
        servers: deps.browserContext.enabledMcpServers,
      })
    } catch (error) {
      logger.error('Failed to create Klavis Strata MCP server', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (deps.browserContext?.customMcpServers?.length) {
    const servers = deps.browserContext.customMcpServers
    const transports = await Promise.all(
      servers.map((s) => detectMcpTransport(s.url)),
    )
    for (let i = 0; i < servers.length; i++) {
      specs.push({
        name: `custom-${servers[i].name}`,
        url: servers[i].url,
        transport: transports[i],
      })
    }
  }

  return specs
}

function formatUserMessage(
  message: string,
  browserContext?: BrowserContext,
  previousConversation?: string,
  conversationId?: string,
): string {
  const contextPrefix = formatBrowserContext(browserContext)

  let fullMessage = `<USER_QUERY>\n${message}\n</USER_QUERY>`

  if (previousConversation) {
    fullMessage = `<previous_conversation>
The user is resuming a previous conversation:

${previousConversation}
</previous_conversation>

Continue based on the above context:

${fullMessage}`
    logger.info('Injecting previous conversation for resume', {
      conversationId,
      historyLength: previousConversation.length,
    })
  }

  return contextPrefix + fullMessage
}

function formatBrowserContext(browserContext?: BrowserContext): string {
  if (!browserContext?.activeTab && !browserContext?.selectedTabs?.length) {
    return ''
  }

  const formatTab = (tab: { id: number; url?: string; title?: string }) =>
    `Tab ${tab.id}${tab.title ? ` - "${tab.title}"` : ''}${tab.url ? ` (${tab.url})` : ''}`

  const lines: string[] = ['## Browser Context']

  if (browserContext.activeTab) {
    lines.push(`**User's Active Tab:** ${formatTab(browserContext.activeTab)}`)
  }

  if (browserContext.selectedTabs?.length) {
    lines.push(
      `**User's Selected Tabs (${browserContext.selectedTabs.length}):**`,
    )
    browserContext.selectedTabs.forEach((tab, i) => {
      lines.push(`  ${i + 1}. ${formatTab(tab)}`)
    })
  }

  return `${lines.join('\n')}\n\n---\n\n`
}

async function resolveProviderConfig(
  request: ChatRequest,
  browserosId?: string,
): Promise<ProviderConfig> {
  if (request.provider === LLM_PROVIDERS.BROWSEROS) {
    const configUrl = INLINED_ENV.BROWSEROS_CONFIG_URL
    if (!configUrl) {
      throw new Error(
        'BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider',
      )
    }

    const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId)
    const llmConfig = getLLMConfigFromProvider(browserosConfig, 'default')

    return {
      provider: request.provider,
      model: llmConfig.modelName,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      upstreamProvider: llmConfig.providerType,
    }
  }

  return {
    provider: request.provider,
    model: request.model,
    apiKey: request.apiKey,
    baseUrl: request.baseUrl,
    resourceName: request.resourceName,
    region: request.region,
    accessKeyId: request.accessKeyId,
    secretAccessKey: request.secretAccessKey,
    sessionToken: request.sessionToken,
  }
}

async function resolveSessionDir(
  request: ChatRequest,
  executionDir: string,
): Promise<string> {
  const dir = request.userWorkingDir
    ? request.userWorkingDir
    : path.join(executionDir, 'sessions', request.conversationId)
  await mkdir(dir, { recursive: true })
  return dir
}
