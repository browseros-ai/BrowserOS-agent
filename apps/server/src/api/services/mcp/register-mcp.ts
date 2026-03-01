import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'
import { executeTool, type ToolContext } from '../../../tools/framework'
import type { ToolRegistry } from '../../../tools/tool-registry'
import type { KlavisToolProxy } from './kalvis-proxy'

export function registerTools(
  mcpServer: McpServer,
  registry: ToolRegistry,
  ctx: ToolContext,
): void {
  for (const tool of registry.all()) {
    const handler = async (
      args: Record<string, unknown>,
      extra: { signal: AbortSignal },
    ) => {
      const startTime = performance.now()

      try {
        logger.info(`${tool.name} request: ${JSON.stringify(args, null, '  ')}`)

        const result = await executeTool(tool, args, ctx, extra.signal)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: !result.isError,
        })

        return {
          content: result.content,
          isError: result.isError,
        }
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: false,
          error_message: errorText,
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
        inputSchema: tool.input as unknown as Record<string, never>,
      },
      handler,
    )
  }

  logger.info(
    `Registered ${registry.names().length} tools: ${registry.names().join(', ')}`,
  )
}

export function registerKlavisTools(
  mcpServer: McpServer,
  proxy: KlavisToolProxy,
): void {
  const tools = proxy.getTools()

  if (tools.length === 0) {
    logger.debug('No Kalvis tools to register')
    return
  }

  for (const tool of tools) {
    const handler = async (
      args: Record<string, unknown>,
      _extra: { signal: AbortSignal },
    ) => {
      const startTime = performance.now()

      try {
        logger.info(`${tool.name} request: ${JSON.stringify(args, null, '  ')}`)

        const result = await proxy.callTool(tool.name, args)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: !result.isError,
          source: 'kalvis',
        })

        return {
          content: result.content,
          isError: result.isError,
        }
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)

        metrics.log('tool_executed', {
          tool_name: tool.name,
          duration_ms: Math.round(performance.now() - startTime),
          success: false,
          error_message: errorText,
          source: 'kalvis',
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
        inputSchema: tool.inputSchema as Record<string, never>,
      },
      handler,
    )
  }

  logger.info(
    `Registered ${tools.length} Kalvis tools: ${tools.map((t) => t.name).join(', ')}`,
  )
}
