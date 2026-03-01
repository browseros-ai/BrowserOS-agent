/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Browser } from '../../../browser/browser'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'
import type { ToolRegistry } from '../../../tools/tool-registry'
import { KlavisMcpClientCache } from './klavis-mcp-cache'
import { registerKlavisTools } from './register-klavis'
import { registerTools } from './register-mcp'

const klavisMcpClientCache = new KlavisMcpClientCache()

export interface McpServiceDeps {
  version: string
  registry: ToolRegistry
  browser: Browser
  klavisClient?: KlavisClient
  browserosId?: string
  enabledMcpServers?: string[]
}

export async function createMcpServer(
  deps: McpServiceDeps,
): Promise<McpServer> {
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

  if (deps.klavisClient && deps.browserosId && deps.enabledMcpServers?.length) {
    try {
      await registerKlavisTools(server, {
        klavisClient: deps.klavisClient,
        browserosId: deps.browserosId,
        enabledServers: deps.enabledMcpServers,
        registry: deps.registry,
        cache: klavisMcpClientCache,
      })
    } catch (error) {
      logger.error(
        'Klavis tool registration failed, browser tools unaffected',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  return server
}
