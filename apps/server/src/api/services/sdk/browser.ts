/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Browser Service - MCP-based browser operations for SDK
 */

import {
  callMcpTool,
  getImageContent,
  getTextContent,
} from '../../utils/mcp-client'
import type {
  ActiveTab,
  InteractiveElements,
  NavigateResult,
  PageContent,
  PageLoadStatus,
  Screenshot,
} from './types'
import { SdkError } from './types'

type ListedPage = {
  id: number
  url: string
  selected: boolean
  tabId?: number
  windowId?: number
}

function parseJsonFromToolText(text: string | undefined): unknown {
  if (!text) {
    return undefined
  }

  const match = text.match(/```json\n([\s\S]*?)\n```/)
  if (!match?.[1]) {
    return undefined
  }

  try {
    return JSON.parse(match[1])
  } catch {
    return undefined
  }
}

export class BrowserService {
  constructor(private mcpServerUrl: string) {}

  private async listPages(): Promise<ListedPage[]> {
    const result = await callMcpTool(this.mcpServerUrl, 'list_pages', {})
    if (result.isError) {
      throw new SdkError(getTextContent(result) || 'Failed to list pages')
    }

    const pages =
      (result.structuredContent?.pages as ListedPage[] | undefined) ?? []
    return pages
  }

  private async resolvePage(options?: {
    tabId?: number
    windowId?: number
  }): Promise<ListedPage> {
    const pages = await this.listPages()
    if (pages.length === 0) {
      throw new SdkError('No tracked pages available')
    }

    if (options?.tabId != null) {
      const page = pages.find((candidate) => candidate.tabId === options.tabId)
      if (!page) {
        throw new SdkError(`Tab ${options.tabId} is not tracked`)
      }
      return page
    }

    const scoped =
      options?.windowId != null
        ? pages.filter((candidate) => candidate.windowId === options.windowId)
        : pages

    const active = scoped.find((candidate) => candidate.selected)
    if (active) {
      return active
    }

    return scoped[0] ?? pages[0]
  }

  async getActiveTab(windowId?: number): Promise<ActiveTab> {
    const page = await this.resolvePage({ windowId })
    return {
      tabId: page.tabId ?? page.id,
      url: page.url,
      title: page.url,
      windowId: page.windowId ?? windowId ?? 0,
    }
  }

  async getPageContent(tabId: number): Promise<string> {
    const page = await this.resolvePage({ tabId })
    const result = await callMcpTool<PageContent>(
      this.mcpServerUrl,
      'take_snapshot',
      {
        pageId: page.id,
        verbose: false,
      },
    )

    if (result.isError) {
      throw new SdkError(getTextContent(result) || 'Failed to get page content')
    }

    const content = getTextContent(result)
    if (!content) {
      throw new SdkError('No content found on page', 400)
    }

    return content
  }

  async getScreenshot(tabId: number): Promise<Screenshot> {
    const page = await this.resolvePage({ tabId })
    const result = await callMcpTool(this.mcpServerUrl, 'take_screenshot', {
      pageId: page.id,
    })

    if (result.isError) {
      throw new SdkError('Failed to capture screenshot')
    }

    const image = getImageContent(result)
    if (!image) {
      throw new SdkError('Screenshot not available')
    }

    return image
  }

  async navigate(
    url: string,
    tabId?: number,
    windowId?: number,
  ): Promise<NavigateResult> {
    const page = await this.resolvePage({ tabId, windowId })
    const result = await callMcpTool<NavigateResult>(
      this.mcpServerUrl,
      'navigate_page',
      {
        pageId: page.id,
        type: 'url',
        url,
      },
    )

    if (result.isError) {
      throw new SdkError(getTextContent(result) || 'Navigation failed')
    }

    return {
      tabId: page.tabId ?? page.id,
      windowId: page.windowId ?? windowId ?? 0,
    }
  }

  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    const page = await this.resolvePage({ tabId })
    const result = await callMcpTool(this.mcpServerUrl, 'evaluate_script', {
      pageId: page.id,
      function:
        '() => ({ readyState: document.readyState, isComplete: document.readyState === "complete" })',
    })

    if (result.isError) {
      throw new SdkError(
        getTextContent(result) || 'Failed to get page load status',
      )
    }

    const text = getTextContent(result)
    const parsed = parseJsonFromToolText(text) as
      | { readyState?: string; isComplete?: boolean }
      | undefined

    const isPageComplete = Boolean(parsed?.isComplete)
    const isDOMContentLoaded =
      parsed?.readyState === 'interactive' || parsed?.readyState === 'complete'

    return {
      tabId,
      isDOMContentLoaded,
      isResourcesLoading: !isPageComplete,
      isPageComplete,
    }
  }

  async getInteractiveElements(
    tabId: number,
    simplified = false,
    windowId?: number,
  ): Promise<InteractiveElements> {
    const page = await this.resolvePage({ tabId, windowId })
    const result = await callMcpTool<InteractiveElements>(
      this.mcpServerUrl,
      'take_snapshot',
      {
        pageId: page.id,
        verbose: !simplified,
      },
    )

    if (result.isError) {
      throw new SdkError(
        getTextContent(result) || 'Failed to get interactive elements',
      )
    }

    const content = result.structuredContent?.content || getTextContent(result)

    return { content }
  }
}
