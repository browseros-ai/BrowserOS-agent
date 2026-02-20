/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Page } from 'puppeteer-core'
import { logger } from '../../../lib/logger'
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
  logger.info('resolveCdpPage called', {
    paramsPageId: params.pageId,
    activePageId: state.activePageId,
    activeTabId: state.activeTabId,
  })

  if (params.pageId != null) {
    const page = cdpContext.getPageById(params.pageId as number)
    if (!page) {
      throw new Error(`Unknown pageId: ${params.pageId}`)
    }
    logger.info('Resolved page from params.pageId', { pageId: params.pageId })
    return page
  }

  const activePageId = state.activePageId
  if (activePageId !== undefined) {
    try {
      const page = cdpContext.getPageById(activePageId)
      if (page) {
        logger.info('Resolved page from state.activePageId', { activePageId })
        return page
      }
    } catch {
      logger.info('state.activePageId is stale, clearing', { activePageId })
    }
    state.setActiveByPageId(undefined)
  }

  const activeTabId = state.activeTabId
  if (activeTabId !== undefined) {
    await cdpContext.createPagesSnapshot()
    const page = cdpContext.getPageByTabId(activeTabId)
    if (page) {
      const pageId = cdpContext.getPageId(page)
      logger.info('Resolved page from state.activeTabId', {
        activeTabId,
        pageId,
      })
      if (pageId !== undefined) {
        state.register({ pageId, tabId: activeTabId })
        state.setActiveByPageId(pageId)
      }
      return page
    }
    logger.info('No CDP page found for activeTabId', {
      activeTabId,
      knownPages: cdpContext.getPages().map((p) => ({
        pageId: cdpContext.getPageId(p),
        tabId: cdpContext.getTabId(p),
        url: p.url(),
      })),
    })
  }

  logger.warn('No active page found, creating fallback blank page')
  const page = await cdpContext.newPage()
  const pageId = cdpContext.getPageId(page)
  if (pageId !== undefined) {
    state.register({ pageId, tabId: cdpContext.getTabId(page) })
    state.setActiveByPageId(pageId)
  }
  return page
}

const activatedPages = new WeakSet<Page>()

async function activatePage(page: Page): Promise<void> {
  // @ts-expect-error _client() is internal Puppeteer API
  const client = page._client()
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })

  if (!activatedPages.has(page)) {
    activatedPages.add(page)
    await client.send('DOM.enable')
    await client.send('Overlay.enable')
    await client.send('Page.setWebLifecycleState', { state: 'active' })
  }
}

export async function dispatchCdpTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  state: SessionBrowserState,
  cdpContext: CdpContext,
): Promise<ToolResult> {
  logger.info('dispatchCdpTool started', {
    tool: tool.name,
    params,
    state,
    cdpContext,
  })
  const page = await resolveCdpPage(params, state, cdpContext)
  await activatePage(page)
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

    const currentPage = cdpContext.getSelectedPage()
    const resolvedPageId = cdpContext.getPageId(page)
    const currentPageId = cdpContext.getPageId(currentPage)
    if (currentPage !== page) {
      const newTabId = cdpContext.getTabId(currentPage)
      logger.info('Page changed after tool.handler', {
        previousPageId: resolvedPageId,
        newPageId: currentPageId,
        newTabId,
        url: currentPage.url(),
      })
      if (currentPageId !== undefined) {
        state.register({ pageId: currentPageId, tabId: newTabId })
        state.setActiveByPageId(currentPageId)
      }
    } else {
      logger.info('Page unchanged after tool.handler', {
        pageId: resolvedPageId,
        url: currentPage.url(),
      })
    }

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
