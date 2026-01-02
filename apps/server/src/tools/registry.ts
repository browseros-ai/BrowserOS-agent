/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tool Registry - Combines CDP and controller tools into a unified registry.
 */

import type { McpContext } from '../common/index.js'
import { logger } from '../common/index.js'
import type { ControllerContext } from '../controller-server/index.js'

import {
  allCdpTools,
  allControllerTools,
  type ToolDefinition,
} from './index.js'

export function createToolRegistry(
  cdpContext: McpContext | null,
  controllerContext: ControllerContext,
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
): Array<ToolDefinition<any, any, any>> {
  return tools.map((tool: any) => ({
    ...tool,
    handler: async (request: any, response: any, _context: any) => {
      return tool.handler(request, response, controllerContext)
    },
  }))
}
