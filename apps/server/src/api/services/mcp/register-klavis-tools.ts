/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Registers Klavis Strata tools on the BrowserOS MCP server as proxy tools.
 * Each Klavis tool call is forwarded to the Strata MCP server via the client manager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'
import type { ToolRegistry } from '../../../tools/tool-registry'
import type { KlavisMcpClientManager } from './klavis-mcp-client'

export function registerKlavisTools(
  mcpServer: McpServer,
  manager: KlavisMcpClientManager,
  browserToolRegistry: ToolRegistry,
): void {
  const klavisTools = manager.getTools()
  const browserToolNames = new Set(browserToolRegistry.names())
  let registeredCount = 0

  for (const tool of klavisTools) {
    if (browserToolNames.has(tool.name)) {
      logger.warn(
        'Skipping Klavis tool due to name conflict with browser tool',
        {
          tool: tool.name,
        },
      )
      continue
    }

    const handler = async (args: Record<string, unknown>) => {
      const startTime = performance.now()

      try {
        logger.info(
          `Klavis tool ${tool.name} request: ${JSON.stringify(args, null, '  ')}`,
        )

        const result = await manager.callTool(tool.name, args)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: !result.isError,
          source: 'klavis',
        })

        return {
          content: result.content as Array<{
            type: 'text'
            text: string
          }>,
          isError: result.isError,
        }
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: false,
          error_message: errorText,
          source: 'klavis',
        })

        return {
          content: [{ type: 'text' as const, text: errorText }],
          isError: true,
        }
      }
    }

    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as unknown as Record<string, never>,
      },
      handler,
    )
    registeredCount++
  }

  if (registeredCount > 0) {
    logger.info(`Registered ${registeredCount} Klavis tools on MCP server`)
  }
}
