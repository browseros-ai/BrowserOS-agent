import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'
import type { ToolRegistry } from '../../../tools/tool-registry'
import type { KlavisMcpClientCache } from './klavis-mcp-cache'

export interface KlavisProxyConfig {
  klavisClient: KlavisClient
  browserosId: string
  enabledServers: string[]
  registry: ToolRegistry
  cache: KlavisMcpClientCache
}

export async function registerKlavisTools(
  mcpServer: McpServer,
  config: KlavisProxyConfig,
): Promise<void> {
  const { klavisClient, browserosId, enabledServers, registry, cache } = config

  try {
    const client = await cache.getOrCreate(
      browserosId,
      enabledServers,
      klavisClient,
    )

    const result = await client.listTools()
    const browserToolNames = new Set(registry.names())
    let registeredCount = 0

    for (const tool of result.tools) {
      if (browserToolNames.has(tool.name)) {
        logger.warn('Klavis tool name collides with browser tool, skipping', {
          toolName: tool.name,
        })
        continue
      }

      const toolName = tool.name

      const handler = async (
        args: Record<string, unknown>,
      ): Promise<CallToolResult> => {
        const startTime = performance.now()

        try {
          logger.info(`Klavis proxy ${toolName} request`, {
            args: JSON.stringify(args).slice(0, 200),
          })

          let activeClient: typeof client
          try {
            activeClient = await cache.getOrCreate(
              browserosId,
              enabledServers,
              klavisClient,
            )
          } catch (reconnectError) {
            const errorText =
              reconnectError instanceof Error
                ? reconnectError.message
                : String(reconnectError)
            logger.error('Failed to reconnect Klavis MCP client', {
              toolName,
              error: errorText,
            })
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Klavis connection error: ${errorText}`,
                },
              ],
              isError: true,
            }
          }

          const callResult = await activeClient.callTool({
            name: toolName,
            arguments: args,
          })

          const isError = callResult.isError === true

          metrics.log('tool_executed', {
            tool_name: toolName,
            duration_ms: Math.round(performance.now() - startTime),
            success: !isError,
            source: 'klavis',
          })

          return {
            content: callResult.content as CallToolResult['content'],
            isError,
          }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)

          metrics.log('tool_executed', {
            tool_name: toolName,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
            error_message: errorText,
            source: 'klavis',
          })

          await cache.invalidate(browserosId).catch(() => {})

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

    logger.info(
      `Registered ${registeredCount} Klavis proxy tools from Strata`,
      {
        browserosId: browserosId.slice(0, 12),
        totalAvailable: result.tools.length,
        skipped: result.tools.length - registeredCount,
      },
    )
  } catch (error) {
    logger.error('Failed to register Klavis tools, browser tools unaffected', {
      error: error instanceof Error ? error.message : String(error),
      browserosId: browserosId.slice(0, 12),
    })
  }
}
