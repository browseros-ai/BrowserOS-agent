/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tool Registry - Combines CDP and controller tools into a unified registry.
 */

import { logger } from '../lib/logger'

import { allCdpTools } from './cdp/registry'
import {
  allControllerTools,
  allControllerToolsFull,
} from './controller/registry'
import type { ToolDefinition } from './types/tool-definition'

export function createToolRegistry(
  cdpEnabled: boolean,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry requires any
): Array<ToolDefinition<any, any, any>> {
  const cdpTools = cdpEnabled ? allCdpTools : []
  const controllerTools = cdpEnabled
    ? allControllerTools
    : allControllerToolsFull

  logger.info(
    `Total tools available: ${cdpTools.length + controllerTools.length} ` +
      `(${cdpTools.length} CDP + ${controllerTools.length} extension)`,
  )

  return [...cdpTools, ...controllerTools]
}
