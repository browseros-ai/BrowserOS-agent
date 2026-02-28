/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Browser } from '../../../browser/browser'
import type { ToolRegistry } from '../../../tools/tool-registry'
import type { KlavisMcpClientManager } from './klavis-mcp-client'
import { registerKlavisTools } from './register-klavis-tools'
import { registerTools } from './register-mcp'

export interface McpServiceDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
  klavisMcpClient?: KlavisMcpClientManager
}

export function createMcpServer(deps: McpServiceDeps): McpServer {
  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version: deps.version,
    },
    { capabilities: { logging: {} } },
  )

  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {}
  })

  registerTools(server, deps.registry, { browser: deps.browser })

  if (deps.klavisMcpClient) {
    registerKlavisTools(server, deps.klavisMcpClient, deps.registry)
  }

  return server
}
