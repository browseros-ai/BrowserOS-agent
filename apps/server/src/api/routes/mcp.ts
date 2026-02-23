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
import { Sentry } from '../../lib/sentry'
import type { ToolRegistry } from '../../tools/tool-registry'
import { createMcpServer } from '../services/mcp/mcp-server'
import type { Env } from '../types'

interface McpRouteDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
}

export function createMcpRoutes(deps: McpRouteDeps) {
  const mcpServer = createMcpServer(deps)

  return new Hono<Env>().all('/', async (c) => {
    const scopeId = c.req.header('X-BrowserOS-Scope-Id') || 'ephemeral'
    metrics.log('mcp.request', { scopeId })

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
}
