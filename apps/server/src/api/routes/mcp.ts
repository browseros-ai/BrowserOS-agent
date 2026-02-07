/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'
import type { SessionManager } from '../../agent/session'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import { Sentry } from '../../lib/sentry'
import type { CdpContext } from '../../tools/cdp-based/context'
import type { ToolDefinition } from '../../tools/types/tool-definition'
import { createMcpServer } from '../services/mcp/mcp-server'
import {
  MCP_SCOPE_HEADER,
  McpScopeManager,
  scopeIdStore,
} from '../services/mcp/scope-manager'
import type { Env } from '../types'

interface McpRouteDeps {
  version: string
  tools: ToolDefinition[]
  ensureCdpContext: () => Promise<CdpContext | null>
  controllerBridge: ControllerBridge
  sessionManager: SessionManager
}

export function createMcpRoutes(deps: McpRouteDeps) {
  const scopeManager = new McpScopeManager(deps.sessionManager)
  scopeManager.startSweep()

  const mcpServer = createMcpServer(deps, scopeManager)

  return new Hono<Env>().all('/', async (c) => {
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
