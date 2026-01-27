/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmBrowserController - Adapter that provides BrowserController interface
 * for a specific worker window via the ControllerBridge.
 */

import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import type { BrowserController } from './swarm-worker-agent'

/**
 * Creates a BrowserController for a specific worker window.
 * All browser operations are routed to this window via windowId.
 */
export function createSwarmBrowserController(
  bridge: ControllerBridge,
  windowId: number,
  tabId?: number,
): BrowserController {
  let currentUrl = 'about:blank'
  const activeTabId = tabId

  const log = (action: string, details?: Record<string, unknown>) => {
    logger.debug(`SwarmBrowserController: ${action}`, {
      windowId,
      tabId: activeTabId,
      ...details,
    })
  }

  return {
    async navigate(url: string): Promise<void> {
      log('navigate', { url })
      await bridge.sendRequest('openTab', {
        windowId,
        url,
        active: true,
      })
      currentUrl = url
    },

    async click(selector: string): Promise<void> {
      log('click', { selector })
      // Use CDP-based click through the MCP server
      // For now, we'll use the extension's native click action
      await bridge.sendRequest('click', {
        windowId,
        tabId: activeTabId,
        selector,
      })
    },

    async type(selector: string, text: string): Promise<void> {
      log('type', { selector, textLength: text.length })
      await bridge.sendRequest('type', {
        windowId,
        tabId: activeTabId,
        selector,
        text,
      })
    },

    async scroll(
      direction: 'up' | 'down' | 'left' | 'right',
      amount?: number,
    ): Promise<void> {
      log('scroll', { direction, amount })
      await bridge.sendRequest('scroll', {
        windowId,
        tabId: activeTabId,
        direction,
        amount: amount ?? 300,
      })
    },

    async waitForSelector(selector: string, timeoutMs = 5000): Promise<void> {
      log('waitForSelector', { selector, timeoutMs })
      const startTime = Date.now()

      while (Date.now() - startTime < timeoutMs) {
        try {
          const result = (await bridge.sendRequest('querySelector', {
            windowId,
            tabId: activeTabId,
            selector,
          })) as { found?: boolean }

          if (result?.found) {
            return
          }
        } catch {
          // Element not found, keep waiting
        }
        await new Promise((r) => setTimeout(r, 200))
      }

      throw new Error(`Selector "${selector}" not found within ${timeoutMs}ms`)
    },

    async waitForNavigation(timeoutMs = 10000): Promise<void> {
      log('waitForNavigation', { timeoutMs })
      // Simple implementation: wait for page load state
      await new Promise((r) => setTimeout(r, 1000))
    },

    async extractText(selector: string): Promise<string> {
      log('extractText', { selector })
      const result = (await bridge.sendRequest('extractText', {
        windowId,
        tabId: activeTabId,
        selector,
      })) as { text?: string }

      return result?.text ?? ''
    },

    async extractData(
      selectors: Record<string, string>,
    ): Promise<Record<string, string>> {
      log('extractData', { selectorCount: Object.keys(selectors).length })
      const result: Record<string, string> = {}

      for (const [key, selector] of Object.entries(selectors)) {
        try {
          result[key] = await this.extractText(selector)
        } catch {
          result[key] = ''
        }
      }

      return result
    },

    async screenshot(): Promise<string> {
      log('screenshot')
      const result = (await bridge.sendRequest('captureScreenshot', {
        windowId,
        tabId: activeTabId,
      })) as { dataUrl?: string }

      return result?.dataUrl ?? ''
    },

    getCurrentUrl(): string {
      return currentUrl
    },

    async getPageContent(): Promise<string> {
      log('getPageContent')
      try {
        const result = (await bridge.sendRequest('getPageContent', {
          windowId,
          tabId: activeTabId,
        })) as { content?: string; text?: string }

        return result?.content ?? result?.text ?? ''
      } catch (error) {
        logger.warn('Failed to get page content', { windowId, error })
        return ''
      }
    },

    async evaluate<T>(fn: string): Promise<T> {
      log('evaluate', { fnLength: fn.length })
      const result = (await bridge.sendRequest('evaluate', {
        windowId,
        tabId: activeTabId,
        script: fn,
      })) as { result?: T }

      return result?.result as T
    },
  }
}
