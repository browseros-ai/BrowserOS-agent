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
import type { ActiveTab, PageContent, Screenshot } from './types'
import { SdkError } from './types'

export class BrowserService {
  constructor(private mcpServerUrl: string) {}

  async getActiveTab(): Promise<ActiveTab> {
    const result = await callMcpTool<ActiveTab>(
      this.mcpServerUrl,
      'browser_get_active_tab',
      {},
    )

    if (result.isError || !result.structuredContent?.tabId) {
      throw new SdkError('Failed to get active tab')
    }

    return result.structuredContent
  }

  async getPageContent(tabId: number): Promise<string> {
    const result = await callMcpTool<PageContent>(
      this.mcpServerUrl,
      'browser_get_page_content',
      { tabId, type: 'text' },
    )

    if (result.isError) {
      throw new SdkError('Failed to get page content')
    }

    const content = result.structuredContent?.content || getTextContent(result)
    if (!content) {
      throw new SdkError('No content found on page', 400)
    }

    return content
  }

  async getScreenshot(tabId: number): Promise<Screenshot> {
    const result = await callMcpTool(
      this.mcpServerUrl,
      'browser_get_screenshot',
      { tabId, size: 'medium' },
    )

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
  ): Promise<void> {
    const result = await callMcpTool(this.mcpServerUrl, 'browser_navigate', {
      url,
      ...(tabId && { tabId }),
      ...(windowId && { windowId }),
    })

    if (result.isError) {
      throw new SdkError(getTextContent(result) || 'Navigation failed')
    }
  }
}
