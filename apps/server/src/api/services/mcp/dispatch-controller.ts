/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ControllerBridge } from '../../../browser/extension/bridge'
import { ScopedControllerContext } from '../../../browser/extension/context'
import { ControllerResponse } from '../../../tools/controller-based/response/controller-response'
import type { SessionBrowserState } from '../../../tools/session-browser-state'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'

export async function dispatchControllerTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionBrowserState,
  controllerBridge: ControllerBridge,
  windowId: number | undefined,
): Promise<ToolResult> {
  const { windowId: _, ...cleanParams } = params
  const scopedContext = new ScopedControllerContext(controllerBridge, windowId)
  const controllerToolContext = { controller: scopedContext, state }
  const response = new ControllerResponse()
  await tool.handler({ params: cleanParams }, response, controllerToolContext)
  return response.handle(scopedContext)
}
