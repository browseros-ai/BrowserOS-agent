/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CdpClient } from '../../../browser/cdp/cdp-client'
import type { SessionState } from '../../../browser/session-state'
import { CdpResponse } from '../../../tools/cdp/response/cdp-response'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'

export async function dispatchCdpTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionState,
  cdpClient: CdpClient,
): Promise<ToolResult> {
  const { tabId, ...cleanParams } = params

  const page =
    tabId != null
      ? cdpClient.getPageByTabId(tabId as number)
      : cdpClient.getPages()[0]

  if (!page) {
    throw new Error(
      tabId != null
        ? `No page found for tabId: ${tabId}. Use list_pages to see available tabs.`
        : 'No pages available.',
    )
  }

  const response = new CdpResponse()
  return cdpClient.withPage(page, state, async () => {
    await tool.handler(
      { params: cleanParams },
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      response as any,
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      cdpClient as any,
    )
    return await response.handle(tool.name, cdpClient)
  })
}

const CDP_UNAVAILABLE_RESULT: CallToolResult = {
  content: [
    {
      type: 'text',
      text: 'CDP context not available. Start server with --cdp-port to enable CDP tools.',
    },
  ],
  isError: true,
}

export { CDP_UNAVAILABLE_RESULT }
