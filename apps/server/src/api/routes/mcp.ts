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
import {
  type ControllerContext,
  ScopedControllerContext,
} from '../../browser/extension/context'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { MutexPool } from '../../lib/mutex'
import { Sentry } from '../../lib/sentry'
import type { CdpContext } from '../../tools/cdp-based/context'
import { CdpResponse } from '../../tools/cdp-based/response'
import { ControllerResponse } from '../../tools/controller-based/response/controller-response'
import type { ToolDefinition } from '../../tools/types/tool-definition'
import type { Env } from '../types'
import { isLocalhostRequest } from '../utils/security'

interface McpRouteDeps {
  version: string
  tools: ToolDefinition[]
  ensureCdpContext: () => Promise<CdpContext | null>
  controllerContext: ControllerContext
  mutexPool: MutexPool
  allowRemote: boolean
}

const MCP_SOURCE_HEADER = 'X-BrowserOS-Source'
const MCP_WINDOW_ID_HEADER = 'X-BrowserOS-Window-Id'

const windowIdStore = new AsyncLocalStorage<number | undefined>()

type McpRequestSource = 'gemini-agent' | 'sdk-internal' | 'third-party'

function getMcpRequestSource(
  headerValue: string | undefined,
): McpRequestSource {
  if (headerValue === 'gemini-agent' || headerValue === 'sdk-internal') {
    return headerValue
  }
  return 'third-party'
}

/**
 * Creates an MCP server with registered tools.
 * Reuses the same logic from the old mcp/server.ts
 */
function createMcpServerWithTools(deps: McpRouteDeps): McpServer {
  const { version, tools, controllerContext, mutexPool } = deps

  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    { capabilities: { logging: {} } },
  )

  // Handle logging level requests
  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {}
  })

  // Register each tool with the MCP server
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

        // Resolve windowId: explicit param takes priority over request header
        const windowId =
          (params.windowId as number | undefined) ?? windowIdStore.getStore()
        const guard = await mutexPool.getMutex(windowId).acquire()
        try {
          const isControllerTool = tool.name.startsWith('browser_')

          logger.info(
            `${tool.name} request: ${JSON.stringify(params, null, '  ')}`,
          )

          try {
            let result: {
              content: Array<TextContent | ImageContent>
              structuredContent: Record<string, unknown>
            }

            if (isControllerTool) {
              const { windowId: _, ...cleanParams } = params
              const scopedContext = new ScopedControllerContext(
                controllerContext.bridge,
                windowId,
              )
              const response = new ControllerResponse()
              await tool.handler(
                { params: cleanParams },
                response,
                scopedContext,
              )
              const content = await response.handle(scopedContext)
              result = {
                content,
                structuredContent: response.structuredContent ?? {},
              }
            } else {
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
              const response = new CdpResponse()
              // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
              await tool.handler({ params }, response as any, cdpContext as any)
              result = await response.handle(tool.name, cdpContext)
            }

            // Log successful tool execution (non-blocking)
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

            // Log failed tool execution (non-blocking)
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
          guard.dispose()
        }
      }) as (params: Record<string, unknown>) => Promise<CallToolResult>,
    )
  }

  return server
}

export function createMcpRoutes(deps: McpRouteDeps) {
  const { allowRemote } = deps

  // Create MCP server once with all tools registered
  const mcpServer = createMcpServerWithTools(deps)

  return new Hono<Env>().all('/', async (c) => {
    // Security check: localhost only (unless allowRemote is enabled)
    if (!allowRemote && !isLocalhostRequest(c)) {
      logger.warn('Rejected non-localhost MCP request')
      metrics.log('mcp.rejected', { reason: 'non_localhost' })
      return c.json({ error: 'Forbidden: Only localhost access allowed' }, 403)
    }

    const source = getMcpRequestSource(c.req.header(MCP_SOURCE_HEADER))
    const headerWindowId = c.req.header(MCP_WINDOW_ID_HEADER)
    const requestWindowId = headerWindowId ? Number(headerWindowId) : undefined

    metrics.log('mcp.request', { source })

    return windowIdStore.run(requestWindowId, async () => {
      try {
        // Create a new transport for EACH request to prevent request ID collisions.
        // Different clients may use the same JSON-RPC request IDs, which would cause
        // responses to be routed to the wrong HTTP connections if transport state is shared.
        const transport = new StreamableHTTPTransport({
          sessionIdGenerator: undefined, // Stateless mode - no session management
          enableJsonResponse: true, // Return JSON responses (not SSE streams)
        })

        // Connect the server to this transport
        await mcpServer.connect(transport)

        // Handle the request and return response
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
