/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CdpClient } from '../../../browser/cdp/cdp-client'
import type { PageRegistry } from '../../../browser/page-registry'
import type { SessionState } from '../../../browser/session-state'
import { CdpResponse } from '../../../tools/cdp/response/cdp-response'
import type { ToolResult } from '../../../tools/types/response'
import type { ToolDefinition } from '../../../tools/types/tool-definition'

function resolvePageId(
  params: Record<string, unknown>,
  state: SessionState,
): number {
  if (params.pageId != null) {
    return Number(params.pageId)
  }

  if (state.activePageId != null) {
    return state.activePageId
  }

  throw new Error(
    'No active page. Use list_pages to see open pages, or new_page to create one.',
  )
}

function toolRequiresPage(toolName: string): boolean {
  return !['list_pages', 'new_page'].includes(toolName)
}

export async function dispatchCdpTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionState,
  cdpClient: CdpClient,
  registry: PageRegistry,
): Promise<ToolResult> {
  const { pageId: _, ...cleanParams } = params

  const response = new CdpResponse()
  const toolContext = { cdp: cdpClient, registry, state }

  if (!toolRequiresPage(tool.name)) {
    await tool.handler(
      { params: cleanParams },
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      response as any,
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      toolContext as any,
    )
    return response.handle(tool.name, cdpClient, state, registry)
  }

  const resolvedPageId = resolvePageId(params, state)
  const page = registry.getPage(resolvedPageId)
  state.setActive(resolvedPageId)

  return cdpClient.withPage(page, async () => {
    await tool.handler(
      { params: cleanParams },
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      response as any,
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool handler signatures
      toolContext as any,
    )
    return response.handle(tool.name, cdpClient, state, registry)
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
