import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'

export interface KlavisToolDescriptor {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface KlavisToolCallResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
  isError?: boolean
}

export interface KlavisToolProxyDeps {
  browserToolNames: Set<string>
  registeredKlavisNames: Set<string>
  executeToolCall: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<KlavisToolCallResult>
}

function resolveToolName(
  name: string,
  browserToolNames: Set<string>,
  registeredKlavisNames: Set<string>,
): { resolvedName: string; skip: boolean } {
  if (registeredKlavisNames.has(name)) {
    logger.debug(`Klavis tool "${name}" already registered by another pool entry, skipping`)
    return { resolvedName: name, skip: true }
  }
  if (browserToolNames.has(name)) {
    const prefixed = `klavis_${name}`
    if (registeredKlavisNames.has(prefixed)) {
      logger.debug(`Klavis tool "${name}" (as "${prefixed}") already registered by another pool entry, skipping`)
      return { resolvedName: prefixed, skip: true }
    }
    logger.warn(`Klavis tool name collision: "${name}" already registered as browser tool, using "${prefixed}"`)
    return { resolvedName: prefixed, skip: false }
  }
  return { resolvedName: name, skip: false }
}

export interface RegisterKlavisToolsResult {
  registeredTools: RegisteredTool[]
  registeredNames: string[]
}

export function registerKlavisTools(
  mcpServer: McpServer,
  tools: KlavisToolDescriptor[],
  deps: KlavisToolProxyDeps,
): RegisterKlavisToolsResult {
  const registeredTools: RegisteredTool[] = []
  const registeredNames: string[] = []

  for (const tool of tools) {
    const originalName = tool.name
    const { resolvedName, skip } = resolveToolName(
      originalName,
      deps.browserToolNames,
      deps.registeredKlavisNames,
    )

    if (skip) {
      continue
    }

    const handler = async (
      args: Record<string, unknown>,
      extra: { signal: AbortSignal },
    ) => {
      const startTime = performance.now()

      try {
        const result = await deps.executeToolCall(originalName, args)

        metrics.log('tool_executed', {
          tool_name: resolvedName,
          duration_ms: Math.round(performance.now() - startTime),
          success: !result.isError,
          source: 'klavis',
        })

        return {
          content: result.content,
          isError: result.isError,
        }
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)

        metrics.log('tool_executed', {
          tool_name: resolvedName,
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

    const registered = mcpServer.registerTool(
      resolvedName,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as unknown as Record<string, never>,
      },
      handler,
    )

    registeredTools.push(registered)
    registeredNames.push(resolvedName)
    deps.registeredKlavisNames.add(resolvedName)
  }

  logger.info(
    `Registered ${registeredTools.length} Klavis proxy tools: ${registeredNames.join(', ')}`,
  )

  return { registeredTools, registeredNames }
}
