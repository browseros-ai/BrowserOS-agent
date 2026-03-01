/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Browser } from '../../../browser/browser'
import type { ToolRegistry } from '../../../tools/tool-registry'
import type { KlavisToolProxy } from './kalvis-proxy'
import { registerKlavisTools, registerTools } from './register-mcp'

export interface McpServiceDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
  klavisProxy?: KlavisToolProxy
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

  if (deps.klavisProxy?.isInitialized()) {
    registerKlavisTools(server, deps.klavisProxy)
  }

  return server
}
