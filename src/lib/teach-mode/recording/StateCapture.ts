import { BrowserContext } from '@/lib/browser/BrowserContext'
import BrowserPage from '@/lib/browser/BrowserPage'
import { Logging } from '@/lib/utils/Logging'
import { StateSnapshot } from '@/lib/teach-mode/types'

/**
 * Captures browser state and screenshots
 * Used after events to record the resulting state
 */
export class StateCapture {
  private browserContext: BrowserContext | null = null
  private captureQueue: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Set the browser context for state capture
   */
  setBrowserContext(context: BrowserContext | null): void {
    this.browserContext = context
  }

  /**
   * Schedule state capture after a delay
   * Uses debouncing to avoid multiple captures for rapid events
   */
  scheduleCapture(eventId: string, tabId: number, delay: number = 100): Promise<StateSnapshot | null> {
    return new Promise((resolve) => {
      // Cancel any pending capture for this event
      const existing = this.captureQueue.get(eventId)
      if (existing) {
        clearTimeout(existing)
      }

      // Schedule new capture
      const timeout = setTimeout(async () => {
        this.captureQueue.delete(eventId)
        const state = await this.captureState(tabId)
        resolve(state)
      }, delay)

      this.captureQueue.set(eventId, timeout)
    })
  }

  /**
   * Capture current browser state
   */
  async captureState(tabId: number): Promise<StateSnapshot | null> {
    try {
      if (!this.browserContext) {
        Logging.log('StateCapture', 'No browser context available', 'warning')
        return null
      }

      // Get the current page using getCurrentPage() like NewAgent does
      const page = await this.browserContext.getCurrentPage()

      // Get browser state string first (simplified version for teach mode)
      const browserStateString = await this._getBrowserStateString()
      if (!browserStateString) {
        Logging.log('StateCapture', 'Failed to get browser state string', 'warning')
        return null
      }

      // Take screenshot with highlights (same as NewAgent)
      const screenshot = await this._captureScreenshot(page)

      // Get current tab info
      const tab = await chrome.tabs.get(tabId)

      // Build state object matching StateSnapshot schema
      const state: StateSnapshot = {
        timestamp: Date.now(),
        page: {
          url: tab.url || '',
          title: tab.title || ''
        },
        browserState: {
          string: browserStateString
        },
        screenshot: screenshot || undefined,
        viewport: undefined  // Could be populated if needed
      }

      Logging.log('StateCapture', `Captured state for tab ${tabId} - state string: ${browserStateString.length} chars, screenshot: ${screenshot ? 'yes' : 'no'}`)
      return state

    } catch (error) {
      Logging.log('StateCapture', `Failed to capture state: ${error}`, 'error')
      return null
    }
  }

  /**
   * Get browser state string
   */
  private async _getBrowserStateString(simplified: boolean = false): Promise<string | null> {
    try {
      if (!this.browserContext) return null

      // Get simplified state like NewAgent does (simplified = true for teach mode)
      const stateString = await this.browserContext.getBrowserStateString(simplified)
      return stateString
    } catch (error) {
      Logging.log('StateCapture', `Failed to get browser state string: ${error}`, 'warning')
      return null
    }
  }

  /**
   * Capture screenshot
   */
  private async _captureScreenshot(page: BrowserPage): Promise<string | null> {
    try {
      // Take a large screenshot to reduce storage size
      // showHighlights = false to reduce file size
      const screenshot = await page.takeScreenshot('large', false)
      return screenshot
    } catch (error) {
      Logging.log('StateCapture', `Failed to capture screenshot: ${error}`, 'warning')
      return null
    }
  }

  /**
   * Cancel all pending captures
   */
  cancelAll(): void {
    for (const timeout of this.captureQueue.values()) {
      clearTimeout(timeout)
    }
    this.captureQueue.clear()
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.cancelAll()
    this.browserContext = null
  }
}
