/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'
import type { ControllerBridge } from '../../../browser/extension/bridge'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'
import type { CdpContext } from '../../../tools/cdp-based/context/cdp-context'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'
import { CDP_UNAVAILABLE_RESULT, dispatchCdpTool } from './dispatch-cdp'
import { dispatchControllerTool } from './dispatch-controller'
import type { McpScopeManager } from './scope-manager'
import { scopeIdStore } from './scope-manager'

export interface McpServiceDeps {
  version: string
  tools: ToolDefinition[]
  ensureCdpContext: () => Promise<CdpContext | null>
  controllerBridge: ControllerBridge
}

export function createMcpServer(
  deps: McpServiceDeps,
  scopeManager: McpScopeManager,
): McpServer {
  const { version, tools, controllerBridge } = deps

  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    { capabilities: { logging: {} } },
  )

  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {}
  })

  for (const tool of tools) {
    // @ts-expect-error TS2589: Type instantiation too deep with complex Zod schema generics
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema as z.ZodRawShape,
        annotations: tool.annotations,
      },
      (async (params: Record<string, unknown>): Promise<CallToolResult> => {
        const startTime = performance.now()

        const scopeId = scopeIdStore.getStore()
        const state = scopeManager.resolve(scopeId)
        const windowId = state.windowId

        try {
          logger.info(
            `${tool.name} request: ${JSON.stringify(params, null, '  ')}`,
          )

          try {
            let result: ToolResult

            if (tool.kind === 'cdp') {
              const cdpContext = await deps.ensureCdpContext()
              if (!cdpContext) {
                return CDP_UNAVAILABLE_RESULT
              }
              result = await dispatchCdpTool(tool, params, state, cdpContext)
            } else {
              result = await dispatchControllerTool(
                tool,
                params,
                state,
                controllerBridge,
                windowId,
              )
            }

            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: true,
            })

            return {
              content: result.content,
              ...(Object.keys(result.structuredContent).length
                ? { structuredContent: result.structuredContent }
                : {}),
            }
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error)

            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: false,
              error_message:
                error instanceof Error ? error.message : 'Unknown error',
            })

            return {
              content: [{ type: 'text', text: errorText }],
              isError: true,
            }
          }
        } finally {
          // no mutex to release
        }
      }) as (params: Record<string, unknown>) => Promise<CallToolResult>,
    )
  }

  return server
}
