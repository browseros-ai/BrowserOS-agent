/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  CallToolResult,
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Hono } from 'hono'
import type { z } from 'zod'
import type { SessionManager } from '../../agent/session'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { ScopedControllerContext } from '../../browser/extension/context'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import { Sentry } from '../../lib/sentry'
import type { CdpContext } from '../../tools/cdp-based/context'
import { CdpResponse } from '../../tools/cdp-based/response'
import { ControllerResponse } from '../../tools/controller-based/response/controller-response'
import { SessionBrowserState } from '../../tools/session-browser-state'
import type { ToolDefinition } from '../../tools/types/tool-definition'
import type { Env } from '../types'
import { isLocalhostRequest } from '../utils/security'

interface McpRouteDeps {
  version: string
  tools: ToolDefinition[]
  ensureCdpContext: () => Promise<CdpContext | null>
  controllerBridge: ControllerBridge
  sessionManager: SessionManager
  allowRemote: boolean
}

const MCP_SCOPE_HEADER = 'X-BrowserOS-Scope-Id'

const MCP_SCOPE_TTL_MS = 30 * 60 * 1000
const MCP_SCOPE_SWEEP_MS = 5 * 60 * 1000

interface McpScopeEntry {
  state: SessionBrowserState
  lastAccess: number
}

const scopeIdStore = new AsyncLocalStorage<string | undefined>()

function resolveScope(
  scopeId: string | undefined,
  sessionManager: SessionManager,
  mcpScopeMap: Map<string, McpScopeEntry>,
): SessionBrowserState {
  if (!scopeId) {
    return new SessionBrowserState()
  }

  const conversationState = sessionManager.getBrowserState(scopeId)
  if (conversationState) {
    return conversationState
  }

  const existing = mcpScopeMap.get(scopeId)
  if (existing) {
    existing.lastAccess = Date.now()
    return existing.state
  }

  const state = new SessionBrowserState()
  mcpScopeMap.set(scopeId, { state, lastAccess: Date.now() })
  return state
}

async function resolveCdpPage(
  params: Record<string, unknown>,
  state: SessionBrowserState,
  cdpContext: CdpContext,
) {
  if (params.pageId != null) {
    const page = cdpContext.getPageById(params.pageId as number)
    if (!page) {
      throw new Error(`Unknown pageId: ${params.pageId}`)
    }
    return page
  }

  const activePageId = state.activePageId
  if (activePageId !== undefined) {
    try {
      const page = cdpContext.getPageById(activePageId)
      if (page) return page
    } catch {
      // stale — page closed, fall through
    }
    state.setActiveByPageId(undefined)
  }

  const page = await cdpContext.newPage()
  const pageId = cdpContext.getPageId(page)
  // @ts-expect-error _tabId is internal
  const tabId = page._tabId as number | undefined
  if (pageId !== undefined) {
    state.register({ pageId, tabId })
    state.setActiveByPageId(pageId)
  }
  return page
}

function createMcpServerWithTools(
  deps: McpRouteDeps,
  mcpScopeMap: Map<string, McpScopeEntry>,
): McpServer {
  const { version, tools, controllerBridge, sessionManager } = deps

  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    { capabilities: { logging: {} } },
  )

  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {}
  })

  for (const tool of tools) {
    // @ts-expect-error TS2589: Type instantiation too deep with complex Zod schema generics
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema as z.ZodRawShape,
        annotations: tool.annotations,
      },
      (async (params: Record<string, unknown>): Promise<CallToolResult> => {
        const startTime = performance.now()

        const scopeId = scopeIdStore.getStore()
        const state = resolveScope(scopeId, sessionManager, mcpScopeMap)
        const windowId = state.windowId

        try {
          logger.info(
            `${tool.name} request: ${JSON.stringify(params, null, '  ')}`,
          )

          try {
            let result: {
              content: Array<TextContent | ImageContent>
              structuredContent: Record<string, unknown>
            }

            if (tool.kind === 'cdp') {
              const cdpContext = await deps.ensureCdpContext()
              if (!cdpContext) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: 'CDP context not available. Start server with --cdp-port to enable CDP tools.',
                    },
                  ],
                  isError: true,
                }
              }

              const page = await resolveCdpPage(params, state, cdpContext)
              const { pageId: _, ...cleanParams } = params

              const response = new CdpResponse()
              result = await cdpContext.withPage(page, async () => {
                await tool.handler(
                  { params: cleanParams },
                  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
                  response as any,
                  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
                  cdpContext as any,
                )
                return await response.handle(tool.name, cdpContext)
              })
            } else {
              const { windowId: _, ...cleanParams } = params
              const scopedContext = new ScopedControllerContext(
                controllerBridge,
                windowId,
              )
              const controllerToolContext = { controller: scopedContext, state }
              const response = new ControllerResponse()
              await tool.handler(
                { params: cleanParams },
                response,
                controllerToolContext,
              )
              const content = await response.handle(scopedContext)
              result = {
                content,
                structuredContent: response.structuredContent ?? {},
              }
            }

            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: true,
            })

            return {
              content: result.content,
              ...(Object.keys(result.structuredContent).length
                ? { structuredContent: result.structuredContent }
                : {}),
            }
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error)

            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: false,
              error_message:
                error instanceof Error ? error.message : 'Unknown error',
            })

            return {
              content: [{ type: 'text', text: errorText }],
              isError: true,
            }
          }
        } finally {
          // no mutex to release
        }
      }) as (params: Record<string, unknown>) => Promise<CallToolResult>,
    )
  }

  return server
}

export function createMcpRoutes(deps: McpRouteDeps) {
  const { allowRemote } = deps

  const mcpScopeMap = new Map<string, McpScopeEntry>()

  // TTL-based cleanup for third-party MCP sessions
  setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of mcpScopeMap) {
      if (now - entry.lastAccess > MCP_SCOPE_TTL_MS) {
        mcpScopeMap.delete(id)
        logger.debug('Expired MCP scope', { scopeId: id })
      }
    }
  }, MCP_SCOPE_SWEEP_MS)

  const mcpServer = createMcpServerWithTools(deps, mcpScopeMap)

  return new Hono<Env>().all('/', async (c) => {
    if (!allowRemote && !isLocalhostRequest(c)) {
      logger.warn('Rejected non-localhost MCP request')
      metrics.log('mcp.rejected', { reason: 'non_localhost' })
      return c.json({ error: 'Forbidden: Only localhost access allowed' }, 403)
    }

    const scopeId = c.req.header(MCP_SCOPE_HEADER) || undefined

    metrics.log('mcp.request', { scopeId: scopeId ?? 'ephemeral' })

    return scopeIdStore.run(scopeId, async () => {
      try {
        const transport = new StreamableHTTPTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })

        await mcpServer.connect(transport)

        return transport.handleRequest(c)
      } catch (error) {
        Sentry.captureException(error)
        logger.error('Error handling MCP request', {
          error: error instanceof Error ? error.message : String(error),
        })

        return c.json(
          {
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          },
          500,
        )
      }
    })
  })
}
