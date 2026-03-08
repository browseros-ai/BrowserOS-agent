/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'
import type { Browser } from '../../browser/browser'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import { captureExceptionOnce } from '../../lib/sentry-utils'
import type { ToolRegistry } from '../../tools/tool-registry'
import { createMcpServer } from '../services/mcp/mcp-server'
import type { KlavisProxyHandle } from '../services/mcp/register-klavis-mcp'
import type { Env } from '../types'

interface McpRouteDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
  klavisProxy?: KlavisProxyHandle | null
}

export function createMcpRoutes(deps: McpRouteDeps) {
  return new Hono<Env>().all('/', async (c) => {
    const scopeId = c.req.header('X-BrowserOS-Scope-Id') || 'ephemeral'
    metrics.log('mcp.request', { scopeId })

    // Per-request server + transport: no shared state, no race conditions,
    // no ID collisions. Required by MCP SDK 1.26.0+ security fix (GHSA-345p-7cg4-v4c7).
    const mcpServer = createMcpServer(deps)
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      await mcpServer.connect(transport)
      return transport.handleRequest(c)
    } catch (error) {
      captureExceptionOnce(error, {
        tags: {
          route: 'mcp',
          action: 'handle-request',
          scope_id: scopeId,
        },
        contexts: {
          request: {
            scopeId,
            path: c.req.path,
            method: c.req.method,
          },
        },
      })
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
}
