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

export async function resolveCdpPage(
  params: Record<string, unknown>,
  state: SessionState,
  cdpClient: CdpClient,
) {
  if (params.pageId != null) {
    const page = cdpClient.getPageById(params.pageId as number)
    if (!page) {
      throw new Error(`Unknown pageId: ${params.pageId}`)
    }
    return page
  }

  const activePageId = state.activePageId
  if (activePageId !== undefined) {
    try {
      const page = cdpClient.getPageById(activePageId)
      if (page && !page.isClosed()) return page
    } catch {
      // stale — page closed or removed, fall through
    }
    state.activePageId = undefined
  }

  const page = await cdpClient.newPage()
  const pageId = cdpClient.getPageId(page)
  if (pageId !== undefined) {
    state.activePageId = pageId
  }
  return page
}

export async function dispatchCdpTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionState,
  cdpClient: CdpClient,
): Promise<ToolResult> {
  const page = await resolveCdpPage(params, state, cdpClient)
  const resolvedPageId = cdpClient.getPageId(page)
  if (resolvedPageId !== undefined) {
    state.activePageId = resolvedPageId
  }
  const { pageId: _, ...cleanParams } = params

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
