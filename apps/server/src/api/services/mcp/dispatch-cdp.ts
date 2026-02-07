/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CdpContext } from '../../../tools/cdp-based/context/cdp-context'
import { CdpResponse } from '../../../tools/cdp-based/response/cdp-response'
import type { SessionBrowserState } from '../../../tools/session-browser-state'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'

export async function resolveCdpPage(
  params: Record<string, unknown>,
  state: SessionBrowserState,
  cdpContext: CdpContext,
) {
  if (params.pageId != null) {
    const page = cdpContext.getPageById(params.pageId as number)
    if (!page) {
      throw new Error(`Unknown pageId: ${params.pageId}`)
    }
    return page
  }

  const activePageId = state.activePageId
  if (activePageId !== undefined) {
    try {
      const page = cdpContext.getPageById(activePageId)
      if (page) return page
    } catch {
      // stale — page closed, fall through
    }
    state.setActiveByPageId(undefined)
  }

  const page = await cdpContext.newPage()
  const pageId = cdpContext.getPageId(page)
  // @ts-expect-error _tabId is internal
  const tabId = page._tabId as number | undefined
  if (pageId !== undefined) {
    state.register({ pageId, tabId })
    state.setActiveByPageId(pageId)
  }
  return page
}

export async function dispatchCdpTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionBrowserState,
  cdpContext: CdpContext,
): Promise<ToolResult> {
  const page = await resolveCdpPage(params, state, cdpContext)
  const { pageId: _, ...cleanParams } = params

  const response = new CdpResponse()
  return cdpContext.withPage(page, async () => {
    await tool.handler(
      { params: cleanParams },
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      response as any,
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      cdpContext as any,
    )
    return await response.handle(tool.name, cdpContext)
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
