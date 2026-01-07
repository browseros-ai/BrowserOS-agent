/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tool Registry - Combines CDP and controller tools into a unified registry.
 */

import { logger } from '../common/logger'
import type { McpContext } from '../common/mcp-context'
import type { ControllerContext } from '../controller-server/controller-context'

import { allCdpTools } from './cdp-based/registry'
import { allControllerTools } from './controller-based/registry'
import type { ToolDefinition } from './types/tool-definition'

export function createToolRegistry(
  cdpContext: McpContext | null,
  controllerContext: ControllerContext,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry requires any
): Array<ToolDefinition<any, any, any>> {
  const cdpTools = cdpContext ? allCdpTools : []
  const wrappedControllerTools = wrapControllerTools(
    allControllerTools,
    controllerContext,
  )

  logger.info(
    `Total tools available: ${cdpTools.length + wrappedControllerTools.length} ` +
      `(${cdpTools.length} CDP + ${wrappedControllerTools.length} extension)`,
  )

  return [...cdpTools, ...wrappedControllerTools]
}

function wrapControllerTools(
  tools: typeof allControllerTools,
  controllerContext: ControllerContext,
  // biome-ignore lint/suspicious/noExplicitAny: wrapper function for heterogeneous tools
): Array<ToolDefinition<any, any, any>> {
  // biome-ignore lint/suspicious/noExplicitAny: tool has heterogeneous schema
  return tools.map((tool: any) => ({
    ...tool,
    // biome-ignore lint/suspicious/noExplicitAny: handler params are dynamically typed
    handler: async (request: any, response: any, _context: any) => {
      return tool.handler(request, response, controllerContext)
    },
  }))
}
