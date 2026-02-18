/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ControllerBridge } from '../../../browser/extension/bridge'
import { ControllerClient } from '../../../browser/extension/controller-client'
import type { SessionState } from '../../../browser/session-state'
import { ControllerResponse } from '../../../tools/controller/response/controller-response'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'

export async function dispatchControllerTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionState,
  controllerBridge: ControllerBridge,
  windowId: number | undefined,
): Promise<ToolResult> {
  const { windowId: _, ...cleanParams } = params
  const client = new ControllerClient(controllerBridge, windowId)
  const controllerToolContext = { controller: client, state }
  const response = new ControllerResponse()
  await tool.handler({ params: cleanParams }, response, controllerToolContext)
  return response.handle(client)
}
