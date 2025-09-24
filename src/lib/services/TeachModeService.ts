import { Logging } from '@/lib/utils/Logging'
import { RecordingSession } from '@/lib/teach-mode/recording/RecordingSession'
import type { TeachModeMessage, TeachModeRecording, CapturedEvent } from '@/lib/teach-mode/types'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { RecordingStorage } from '@/lib/teach-mode/storage/RecordingStorage'

const NAVIGATION_DELAY_MS = 100  // Delay after navigation before re-injection

/**
 * Service to manage teach mode recording
 * Handles content script injection and event collection
 */
export class TeachModeService {
  private static instance: TeachModeService
  private currentSession: RecordingSession | null = null
  private browserContext: BrowserContext | null = null
  private navigationListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null
  private messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) | null = null
  private recorderPorts: Map<number, chrome.runtime.Port> = new Map()  // Track all recorder ports by tab ID
  private activeTabId: number | null = null  // Currently active recording tab
  private tabActivatedListener: ((info: chrome.tabs.TabActiveInfo) => void) | null = null
  private tabCreatedListener: ((tab: chrome.tabs.Tab) => void) | null = null
  private tabRemovedListener: ((tabId: number, info: chrome.tabs.TabRemoveInfo) => void) | null = null

  private constructor() {
    this._setupNavigationListener()
    this._setupMessageListener()
    this._setupPortListener()
    this._setupTabListeners()
  }

  static getInstance(): TeachModeService {
    if (!TeachModeService.instance) {
      TeachModeService.instance = new TeachModeService()
    }
    return TeachModeService.instance
  }

  /**
   * Start recording on a specific tab
   */
  async startRecording(tabId: number): Promise<void> {
    try {
      // Stop any existing recording
      if (this.currentSession) {
        await this.stopRecording()
      }

      // Get tab information
      const tab = await chrome.tabs.get(tabId)
      if (!tab.url) {
        throw new Error('Tab has no URL')
      }

      // Initialize browser context for state capture
      try {
        this.browserContext = new BrowserContext()
        // BrowserContext will automatically manage the tab when we request pages
        Logging.log('TeachModeService', `Initialized browser context for tab ${tabId}`)
      } catch (error) {
        Logging.log('TeachModeService', `Failed to initialize browser context: ${error}`, 'warning')
        // Continue without browser context - state capture will be skipped
        this.browserContext = null
      }

      // Create new recording session with browser context
      this.currentSession = new RecordingSession(tabId, tab.url, this.browserContext || undefined)

      // Capture viewport information
      const viewport = await this._captureViewport(tabId)
      if (viewport) {
        this.currentSession.addViewport(viewport)
      }

      // Set active tab
      this.activeTabId = tabId

      // Start listening for tab events
      if (this.tabActivatedListener) {
        chrome.tabs.onActivated.addListener(this.tabActivatedListener)
      }
      if (this.tabCreatedListener) {
        chrome.tabs.onCreated.addListener(this.tabCreatedListener)
      }
      if (this.tabRemovedListener) {
        chrome.tabs.onRemoved.addListener(this.tabRemovedListener)
      }

      // Inject content script
      await this._injectContentScript(tabId)

      // Send start message with target tab ID
      await this._sendToTab(tabId, 'START_RECORDING')

      Logging.log('TeachModeService', `Started recording on tab ${tabId}`)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to start recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(): Promise<TeachModeRecording | null> {
    try {
      if (!this.currentSession) {
        Logging.log('TeachModeService', 'No active recording to stop', 'warning')
        return null
      }

      // Send stop message to all tabs with content scripts
      for (const [tabId] of this.recorderPorts) {
        try {
          await this._sendToTab(tabId, 'STOP_RECORDING')
        } catch (error) {
          // Tab might be closed
          Logging.log('TeachModeService', `Failed to stop tab ${tabId}: ${error}`, 'warning')
        }
      }

      // Stop session and get recording
      const recording = this.currentSession.stop()
      this.currentSession = null
      this.activeTabId = null

      // Clean up all ports
      for (const [, port] of this.recorderPorts) {
        try {
          port.disconnect()
        } catch (error) {
          // Port might already be disconnected
        }
      }
      this.recorderPorts.clear()

      // Stop listening for tab events
      if (this.tabActivatedListener) {
        chrome.tabs.onActivated.removeListener(this.tabActivatedListener)
      }
      if (this.tabCreatedListener) {
        chrome.tabs.onCreated.removeListener(this.tabCreatedListener)
      }
      if (this.tabRemovedListener) {
        chrome.tabs.onRemoved.removeListener(this.tabRemovedListener)
      }

      // Clean up browser context
      if (this.browserContext) {
        try {
          await this.browserContext.cleanup()
        } catch (error) {
          Logging.log('TeachModeService', `Failed to clean up browser context: ${error}`, 'warning')
        }
        this.browserContext = null
      }

      // Save recording to storage
      await this._saveRecording(recording)

      Logging.log('TeachModeService', `Stopped recording with ${recording.events.length} events`)

      return recording
    } catch (error) {
      Logging.log('TeachModeService', `Failed to stop recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.currentSession !== null
  }

  /**
   * Get current recording session
   */
  getCurrentSession(): RecordingSession | null {
    return this.currentSession
  }

  /**
   * Capture viewport information from tab
   */
  private async _captureViewport(tabId: number): Promise<{
    width: number
    height: number
    deviceScaleFactor: number
    isMobile: boolean
    hasTouch: boolean
    isLandscape: boolean
  } | null> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          width: window.innerWidth,
          height: window.innerHeight,
          deviceScaleFactor: window.devicePixelRatio || 1,
          isMobile: false,
          hasTouch: 'ontouchstart' in window,
          isLandscape: window.innerWidth > window.innerHeight
        })
      })

      if (results && results[0]?.result) {
        return results[0].result
      }
    } catch (error) {
      Logging.log('TeachModeService', `Failed to capture viewport: ${error}`, 'warning')
    }
    return null
  }

  /**
   * Inject content script into tab
   */
  private async _injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['teach-mode-recorder.js']
      })
      Logging.log('TeachModeService', `Injected content script into tab ${tabId}`)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to inject content script: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Setup navigation listener for re-injection
   */
  private _setupNavigationListener(): void {
    this.navigationListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      // Only handle main frame navigations
      if (details.frameId !== 0) return

      // Check if this is the recording tab
      if (!this.currentSession || this.currentSession.getTabId() !== details.tabId) {
        return
      }

      Logging.log('TeachModeService', `Navigation detected for recording tab ${details.tabId}`)

      // Record navigation event
      this.currentSession.handleNavigation(details.url, details.transitionType)

      // Only re-inject if this is the active tab
      if (details.tabId === this.activeTabId) {
        setTimeout(() => {
          this._reinjectContentScript(details.tabId)
        }, NAVIGATION_DELAY_MS)
      }
    }

    chrome.webNavigation.onCommitted.addListener(this.navigationListener)
    chrome.webNavigation.onHistoryStateUpdated.addListener(this.navigationListener)  // Also listen for SPA navigation
  }

  /**
   * Re-inject content script after navigation
   */
  private async _reinjectContentScript(tabId: number): Promise<void> {
    try {
      // Check if still recording
      if (!this.currentSession || this.currentSession.getTabId() !== tabId) {
        return
      }

      // Re-inject script
      await this._injectContentScript(tabId)

      // Restart recording with target tab ID
      await this._sendToTab(tabId, 'START_RECORDING')

      Logging.log('TeachModeService', `Re-injected content script after navigation`)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to re-inject content script: ${error}`, 'error')
    }
  }

  /**
   * Setup message listener for events from content script
   */
  private _setupMessageListener(): void {
    this.messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      // Handle GET_TAB_ID request separately (not part of TeachModeMessage)
      if (message.action === 'GET_TAB_ID') {
        sendResponse({ tabId: sender.tab?.id || -1 })
        return true
      }

      const teachMessage = message as TeachModeMessage

      // Only handle messages from teach mode recorder
      if (teachMessage.source !== 'TeachModeRecorder') {
        return
      }

      switch (teachMessage.action) {
        case 'EVENT_CAPTURED':
          this._handleCapturedEvent(teachMessage.event, sender.tab?.id)
          sendResponse({ success: true })
          break

        case 'RECORDER_READY':
          Logging.log('TeachModeService', `Recorder ready on tab ${sender.tab?.id}`)
          sendResponse({ success: true })
          break

        default:
          return
      }

      return true  // Keep message channel open
    }

    chrome.runtime.onMessage.addListener(this.messageListener)
  }

  /**
   * Handle captured event from content script
   */
  private _handleCapturedEvent(event: CapturedEvent, tabId?: number): void {
    if (!this.currentSession) {
      Logging.log('TeachModeService', 'Received event but no active session', 'warning')
      return
    }

    // Verify event is from correct tab
    if (tabId !== this.currentSession.getTabId()) {
      Logging.log('TeachModeService', `Event from wrong tab ${tabId}`, 'warning')
      return
    }

    // Add event to session - convert from CapturedEvent to expected format
    this.currentSession.addEvent({
      type: event.action.type,
      action: event.action,
      target: event.target
    })
  }

  /**
   * Save recording to storage using RecordingStorage
   */
  private async _saveRecording(recording: TeachModeRecording): Promise<string | null> {
    try {
      const storage = RecordingStorage.getInstance()

      // Generate title based on URL and time
      const url = new URL(recording.session.url)
      const date = new Date(recording.session.startTimestamp)
      const title = `${url.hostname} - ${date.toLocaleString()}`

      // Save to storage
      const recordingId = await storage.save(recording, title)

      Logging.log('TeachModeService', `Saved recording ${recordingId} with ${recording.events.length} events`)

      // Optionally export immediately
      if (await this._shouldAutoExport()) {
        await storage.export(recordingId)
        Logging.log('TeachModeService', `Auto-exported recording ${recordingId}`)
      }

      return recordingId
    } catch (error) {
      Logging.log('TeachModeService', `Failed to save recording: ${error}`, 'error')
      return null
    }
  }

  /**
   * Check if auto-export is enabled
   */
  private async _shouldAutoExport(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get('teachMode_autoExport')
      return result.teachMode_autoExport === true
    } catch {
      return false
    }
  }

  /**
   * Cleanup when tab is closed
   */
  handleTabClosed(tabId: number): void {
    if (this.currentSession && this.currentSession.getTabId() === tabId) {
      Logging.log('TeachModeService', `Recording tab ${tabId} was closed, stopping recording`)
      this.stopRecording()
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.browserContext) {
      this.browserContext.cleanup().catch((error: any) => {
        Logging.log('TeachModeService', `Failed to clean up browser context: ${error}`, 'warning')
      })
      this.browserContext = null
    }
    this.currentSession = null
    this.activeTabId = null
    this.recorderPorts.clear()
  }

  // ============= Storage Management =============

  /**
   * Get list of all recordings
   */
  async getRecordings(): Promise<any[]> {
    const storage = RecordingStorage.getInstance()
    return await storage.list()
  }

  /**
   * Get a specific recording
   */
  async getRecording(recordingId: string): Promise<TeachModeRecording | null> {
    const storage = RecordingStorage.getInstance()
    return await storage.get(recordingId)
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string): Promise<boolean> {
    const storage = RecordingStorage.getInstance()
    return await storage.delete(recordingId)
  }

  /**
   * Clear all recordings
   */
  async clearAllRecordings(): Promise<void> {
    const storage = RecordingStorage.getInstance()
    await storage.clear()
  }

  /**
   * Export a recording as JSON file
   */
  async exportRecording(recordingId: string): Promise<void> {
    const storage = RecordingStorage.getInstance()
    await storage.export(recordingId)
  }

  /**
   * Import a recording from JSON
   */
  async importRecording(json: string, title?: string): Promise<string> {
    const storage = RecordingStorage.getInstance()
    return await storage.import(json, title)
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<any> {
    const storage = RecordingStorage.getInstance()
    return await storage.getStats()
  }

  /**
   * Search recordings by query
   */
  async searchRecordings(query: string): Promise<any[]> {
    const storage = RecordingStorage.getInstance()
    return await storage.search(query)
  }

  /**
   * Setup port listener for content script connection monitoring
   */
  private _setupPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
      // Only handle teach mode recorder ports
      if (port.name !== 'teach-mode-recorder') return

      const tabId = port.sender?.tab?.id
      if (!tabId) return

      // Store the port reference by tab ID
      this.recorderPorts.set(tabId, port)
      Logging.log('TeachModeService', `Recorder connected from tab ${tabId}`)

      // Handle port disconnect - content script died or page navigated
      port.onDisconnect.addListener(() => {
        Logging.log('TeachModeService', `Recorder disconnected from tab ${tabId}`)
        this.recorderPorts.delete(tabId)

        // Only re-inject if this is the active recording tab
        if (this.currentSession && tabId === this.activeTabId) {
          Logging.log('TeachModeService', `Re-injecting content script after disconnect on active tab ${tabId}`)

          // Re-inject after a small delay to let the page settle
          setTimeout(() => {
            if (this.currentSession && tabId === this.activeTabId) {
              this._reinjectContentScript(tabId)
            }
          }, 100)
        }
      })
    })
  }

  /**
   * Setup tab listeners for multi-tab recording
   */
  private _setupTabListeners(): void {
    // Tab activated listener
    this.tabActivatedListener = async (info: chrome.tabs.TabActiveInfo) => {
      // Only care about tab switches during recording
      if (!this.currentSession) return

      const newTabId = info.tabId
      const previousTabId = this.activeTabId

      // Skip if switching to the same tab
      if (newTabId === previousTabId) return

      Logging.log('TeachModeService', `Tab switched from ${previousTabId} to ${newTabId} during recording`)

      // Record tab switch event with URLs
      if (previousTabId !== null) {
        try {
          // Get URLs of both tabs
          const [previousTab, newTab] = await Promise.all([
            chrome.tabs.get(previousTabId).catch(() => null),
            chrome.tabs.get(newTabId)
          ])

          this.currentSession.addEvent({
            type: 'tab_switched',
            action: {
              fromTabId: previousTabId,
              toTabId: newTabId,
              fromUrl: previousTab?.url || '',
              toUrl: newTab.url || ''
            }
          })
        } catch (error) {
          // Fallback without URLs if tab query fails
          this.currentSession.addEvent({
            type: 'tab_switched',
            action: {
              fromTabId: previousTabId,
              toTabId: newTabId
            }
          })
        }
      }

      // Update active tab
      this.activeTabId = newTabId
      this.currentSession.setActiveTabId(newTabId)

      // Pause recording on previous tab
      if (previousTabId !== null) {
        await this._sendToTab(previousTabId, 'PAUSE_RECORDING')
      }

      // Ensure content script is injected in new tab
      const hasPort = this.recorderPorts.has(newTabId)
      if (!hasPort) {
        // Need to inject content script
        await this._injectContentScript(newTabId)
        await this._sendToTab(newTabId, 'START_RECORDING')
      } else {
        // Resume recording on existing script
        await this._sendToTab(newTabId, 'RESUME_RECORDING')
      }
    }

    // Tab created listener
    this.tabCreatedListener = async (tab: chrome.tabs.Tab) => {
      // Only care about new tabs during recording
      if (!this.currentSession || !tab.id) return

      // Check if this tab was opened from our active recording tab
      // openerTabId is set when a tab is opened via link click, window.open, etc.
      const wasOpenedFromRecordingTab = tab.openerTabId === this.activeTabId

      if (wasOpenedFromRecordingTab) {
        Logging.log('TeachModeService', `New tab ${tab.id} opened from recording tab ${tab.openerTabId} with URL: ${tab.url}`)

        // Record tab opened event
        this.currentSession.addEvent({
          type: 'tab_opened',
          action: {
            tabId: tab.id,
            url: tab.url || '',
            toUrl: tab.url || '',  // For consistency with tab_switched
            fromTabId: tab.openerTabId  // Track which tab opened it
          }
        })
      } else {
        // Tab was opened independently (e.g., Ctrl+T, bookmark, etc.)
        // We might still want to track if user switches to it
        Logging.log('TeachModeService', `New tab ${tab.id} opened independently during recording`)
      }
    }

    // Tab removed listener
    this.tabRemovedListener = async (tabId: number, info: chrome.tabs.TabRemoveInfo) => {
      // Only care about closed tabs during recording
      if (!this.currentSession) return

      // Only record if this tab had a content script (was part of recording)
      const wasRecordingTab = this.recorderPorts.has(tabId)

      if (wasRecordingTab) {
        Logging.log('TeachModeService', `Recording tab closed: ${tabId}`)

        // Try to get the tab URL (might be cached or still available)
        let url = ''
        try {
          // Sometimes the tab info is still available briefly
          const tab = await chrome.tabs.get(tabId).catch(() => null)
          if (tab) {
            url = tab.url || ''
          }
        } catch (e) {
          // Tab already fully closed
        }

        // Record tab closed event
        this.currentSession.addEvent({
          type: 'tab_closed',
          action: {
            tabId,
            url
          }
        })

        // Clean up the port reference
        this.recorderPorts.delete(tabId)

        // If this was the active tab, switch to another tab
        if (tabId === this.activeTabId) {
          // Find another tab to switch to
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tabs.length > 0 && tabs[0].id) {
            this.activeTabId = tabs[0].id
            Logging.log('TeachModeService', `Active tab switched to ${this.activeTabId} after tab close`)
          } else {
            this.activeTabId = null
          }
        }
      } else {
        Logging.log('TeachModeService', `Non-recording tab closed during recording: ${tabId}`)
      }
    }

    // We'll add/remove these listeners dynamically during recording
  }

  /**
   * Send message to specific tab with target ID
   */
  private async _sendToTab(tabId: number, action: string, data?: any): Promise<void> {
    const message: TeachModeMessage & { targetTabId?: number } = {
      action: action as any,
      source: 'TeachModeService',
      targetTabId: tabId,  // Include target tab ID
      ...data
    }

    try {
      await chrome.tabs.sendMessage(tabId, message)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to send message to tab ${tabId}: ${error}`, 'warning')
    }
  }
}
