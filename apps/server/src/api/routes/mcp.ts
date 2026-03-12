/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StreamableHTTPTransport } from '@hono/mcp'
import { type Context, Hono } from 'hono'
import type { Browser } from '../../browser/browser'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import { Sentry } from '../../lib/sentry'
import type { ToolRegistry } from '../../tools/tool-registry'
import { createMcpServer } from '../services/mcp/mcp-server'
import type { KlavisProxyHandle } from '../services/mcp/register-klavis-mcp'
import type { Env } from '../types'

interface McpRouteDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
  executionDir: string
  resourcesDir: string
  klavisProxy?: KlavisProxyHandle | null
}

const MCP_STATUS_MESSAGE =
  'MCP server is running. Use POST for JSON-RPC requests. GET with Accept: text/event-stream is reserved for SSE streaming.'

function acceptsEventStream(acceptHeader: string | undefined): boolean {
  return acceptHeader?.includes('text/event-stream') ?? false
}

function shouldReturnStatusResponse(c: Context<Env>): boolean {
  return c.req.method === 'GET' && !acceptsEventStream(c.req.header('Accept'))
}

function createMcpStatusResponse(c: Context<Env>) {
  return c.json({
    status: 'ok',
    message: MCP_STATUS_MESSAGE,
  })
}

async function handleMcpTransportRequest(c: Context<Env>, deps: McpRouteDeps) {
  const mcpServer = createMcpServer(deps)
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
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
}

export function createMcpRoutes(deps: McpRouteDeps) {
  return new Hono<Env>().all('/', async (c) => {
    const scopeId = c.req.header('X-BrowserOS-Scope-Id') || 'ephemeral'
    metrics.log('mcp.request', { scopeId })

    if (shouldReturnStatusResponse(c)) {
      return createMcpStatusResponse(c)
    }

    // Per-request server + transport: no shared state, no race conditions,
    // no ID collisions. Required by MCP SDK 1.26.0+ security fix (GHSA-345p-7cg4-v4c7).
    return handleMcpTransportRequest(c, deps)
  })
}
