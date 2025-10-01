import { Logging } from '@/lib/utils/Logging'
import { RecordingSession } from '@/lib/teach-mode/recording/RecordingSession'
import type { TeachModeMessage, TeachModeRecording, CapturedEvent } from '@/lib/teach-mode/types'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { RecordingStorage } from '@/lib/teach-mode/storage/RecordingStorage'
import { PreprocessAgent } from '@/lib/agent/PreprocessAgent'
import { PubSub } from '@/lib/pubsub'

const NAVIGATION_DELAY_MS = 100  // Delay after navigation before re-injection
const HEARTBEAT_INTERVAL_MS = 100  // Heartbeat ping interval

/**
 * Service to manage teach mode recording
 * Handles content script injection and event collection
 */
export class TeachModeService {
  private static instance: TeachModeService
  private currentSession: RecordingSession | null = null
  private browserContext: BrowserContext | null = null
  private navigationListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null
  private messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | undefined) | null = null
  private activeTabId: number | null = null  // Currently active recording tab
  private tabActivatedListener: ((info: chrome.tabs.TabActiveInfo) => void) | null = null
  private tabCreatedListener: ((tab: chrome.tabs.Tab) => void) | null = null
  private tabRemovedListener: ((tabId: number, info: chrome.tabs.TabRemoveInfo) => void) | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  private constructor() {
    this._setupNavigationListener()
    this._setupMessageListener()
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

      // Log metric for recording start
      Logging.logMetric('teachmode.recording.started').catch(() => {
        // Metric logging failed, continue
      })

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

      // Start heartbeat monitoring (pass initial tabId but it uses activeTabId)
      this._startHeartbeat(tabId)

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

      // Initial injection only - heartbeat will maintain it
      await this._injectAndStartRecording(tabId)

      Logging.log('TeachModeService', `Started recording on tab ${tabId}`)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to start recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(audioDataBase64?: string): Promise<TeachModeRecording | null> {
    try {
      if (!this.currentSession) {
        Logging.log('TeachModeService', 'No active recording to stop', 'warning')
        return null
      }

      // Set audio if provided
      if (audioDataBase64) {
        this.currentSession.setAudio(audioDataBase64)
      }

      // Send stop message to current tab
      const tabId = this.activeTabId || this.currentSession.getActiveTabId()
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'STOP_RECORDING',
          source: 'TeachModeService'
        } as TeachModeMessage)
      } catch (error) {
        // Tab might be closed or navigated away
        Logging.log('TeachModeService', `Failed to send stop message: ${error}`, 'warning')
      }

      // Stop session and get recording
      const recording = this.currentSession.stop()
      this.currentSession = null
      this.activeTabId = null

      // Log metric for recording stop
      Logging.logMetric('teachmode.recording.stopped', {
        eventsCount: recording.events.length
      }).catch(() => {
        // Metric logging failed, continue
      })

      // Stop heartbeat
      this._stopHeartbeat()

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
   * Setup navigation listener for re-injection
   */
  private _setupNavigationListener(): void {
    this.navigationListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      // Only handle main frame navigations
      if (details.frameId !== 0) return

      // Check if this is the active recording tab
      if (!this.currentSession || this.activeTabId !== details.tabId) {
        return
      }

      // Record navigation event
      this.currentSession.handleNavigation(details.url, details.transitionType)
    }

    chrome.webNavigation.onCommitted.addListener(this.navigationListener)
    // TODO: Heartbeat handles SPA navigation now. Will reinject if needed.
    // chrome.webNavigation.onHistoryStateUpdated.addListener(this.navigationListener)  // Also listen for SPA navigation
  }

  /**
   * Inject content script and start recording (idempotent)
   */
  private async _injectAndStartRecording(tabId: number): Promise<void> {
    try {
      // Check if script is already alive via ping
      const isAlive = await this._isScriptAlive(tabId)

      if (isAlive) {
        // Script is already there, just ensure it's recording
        await chrome.tabs.sendMessage(tabId, {
          action: 'START_RECORDING',
          source: 'TeachModeService',
          targetTabId: tabId
        } as TeachModeMessage & { targetTabId: number })

        Logging.log('TeachModeService', `Script already alive on tab ${tabId}, started recording`)
        return
      }

      // Script is dead or not injected, inject it
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['teach-mode-recorder.js']
      })

      // Small delay for script initialization
      await new Promise(resolve => setTimeout(resolve, 100))

      // Send start recording message
      await chrome.tabs.sendMessage(tabId, {
        action: 'START_RECORDING',
        source: 'TeachModeService',
        targetTabId: tabId
      } as TeachModeMessage & { targetTabId: number })

      Logging.log('TeachModeService', `Injected and started recording on tab ${tabId}`)
    } catch (error) {
      Logging.log('TeachModeService', `Failed to inject/start recording on tab ${tabId}: ${error}`, 'error')
    }
  }

  /**
   * Check if content script is alive
   */
  private async _isScriptAlive(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'HEARTBEAT_PING',
        source: 'TeachModeService'
      })
      // Check if script is actually recording, not just alive
      return response?.alive === true
    } catch {
      return false
    }
  }

  /**
   * Start heartbeat monitoring for the active tab
   */
  private _startHeartbeat(tabId: number): void {
    // Stop any existing heartbeat
    this._stopHeartbeat()

    // Start new heartbeat interval
    this.heartbeatInterval = setInterval(async () => {
      // Always use the current activeTabId (it may have changed)
      const currentTabId = this.activeTabId

      if (!currentTabId || !this.currentSession) {
        // No active tab or session ended, stop heartbeat
        this._stopHeartbeat()
        return
      }

      try {
        // Send ping to the currently active tab
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'HEARTBEAT_PING',
          source: 'TeachModeService'
        })

        // Script is alive, nothing to do
      } catch (error) {
        // Script is not responding on current active tab
        Logging.log('TeachModeService', `Heartbeat failed for tab ${currentTabId}, reinjecting`)

        // Reinject the script
        await this._injectAndStartRecording(currentTabId)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  /**
   * Stop heartbeat monitoring
   */
  private _stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
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

    // Verify event is from the CURRENTLY active recording tab 
    if (tabId !== this.activeTabId) {
      Logging.log('TeachModeService', `Event from non-active tab ${tabId}, active is ${this.activeTabId}`, 'warning')
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

      // Generate title with processing indicator
      const url = new URL(recording.session.url)
      const date = new Date(recording.session.startTimestamp)
      const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      const title = `Processing - ${url.hostname} ${timeString}`

      // Save recording to storage immediately
      const recordingId = await storage.save(recording, title)
      Logging.log('TeachModeService', `Saved recording ${recordingId} with ${recording.events.length} events`)

      // Start async preprocessing - fire and forget
      this._startAsyncPreprocessing(recordingId, recording)

      return recordingId
    } catch (error) {
      Logging.log('TeachModeService', `Failed to save recording: ${error}`, 'error')
      return null
    }
  }

  /**
   * Start async preprocessing of recording
   */
  private async _startAsyncPreprocessing(recordingId: string, recording: TeachModeRecording): Promise<void> {
    const storage = RecordingStorage.getInstance()
    const pubsub = PubSub.getChannel('main')

    try {
      // Emit preprocessing started
      pubsub.publishTeachModeEvent({
        eventType: 'preprocessing_started',
        sessionId: recording.session.id,
        data: {
          recordingId,
          totalEvents: recording.events.filter(
            e => e.action.type !== 'session_start' && e.action.type !== 'session_end'
          ).length
        }
      })

      // Process recording with PreprocessAgent
      console.log('Processing recording into workflow...')
      const preprocessAgent = new PreprocessAgent(pubsub, recording.session.id)
      const workflow = await preprocessAgent.processRecording(recording)
      console.log(`Created workflow with ${workflow.steps.length} steps`)
      Logging.log('TeachModeService', `Created workflow with ${workflow.steps.length} steps`)

      // Save workflow (this also updates the title)
      await storage.saveWorkflow(recordingId, workflow)

      // Emit preprocessing completed
      pubsub.publishTeachModeEvent({
        eventType: 'preprocessing_completed',
        sessionId: recording.session.id,
        data: {
          recordingId,
          workflowSteps: workflow.steps.length
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TeachModeService', `Async preprocessing failed: ${errorMessage}`, 'error')

      // Emit preprocessing failed event
      pubsub.publishTeachModeEvent({
        eventType: 'preprocessing_failed',
        sessionId: recording.session.id,
        data: {
          recordingId,
          error: errorMessage
        }
      })
    }
  }

  /**
   * Cleanup when tab is closed
   */
  handleTabClosed(tabId: number): void {
    if (this.currentSession && this.activeTabId === tabId) {
      Logging.log('TeachModeService', `Active recording tab ${tabId} was closed, stopping recording`)
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
   * Get workflow for a recording
   */
  async getWorkflow(recordingId: string): Promise<any | null> {
    const storage = RecordingStorage.getInstance()
    return await storage.getWorkflow(recordingId)
  }

  /**
   * Update workflow for a recording with partial changes
   */
  async updateWorkflow(recordingId: string, updates: any): Promise<boolean> {
    const storage = RecordingStorage.getInstance()
    return await storage.updateWorkflow(recordingId, updates)
  }

  /**
   * Delete workflow for a recording
   */
  async deleteWorkflow(recordingId: string): Promise<boolean> {
    const storage = RecordingStorage.getInstance()
    return await storage.deleteWorkflow(recordingId)
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

      // Stop recording on previous tab (if exists) and wait for confirmation
      if (previousTabId !== null) {
        try {
          await chrome.tabs.sendMessage(previousTabId, {
            action: 'STOP_RECORDING',
            source: 'TeachModeService',
            targetTabId: previousTabId
          } as TeachModeMessage & { targetTabId: number })

          // Give it 50ms to actually stop before proceeding
          await new Promise(resolve => setTimeout(resolve, 50))
        } catch (error) {
          // Previous tab might be closed or navigated
          Logging.log('TeachModeService', `Could not stop recording on previous tab: ${error}`, 'warning')
        }
      }

      // The heartbeat will automatically handle the new tab on next tick
      // No need to inject here - heartbeat will detect if script is missing
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

      // Only record if this was the active tab
      if (tabId === this.activeTabId) {
        Logging.log('TeachModeService', `Active recording tab closed: ${tabId}`)

        // Record tab closed event
        this.currentSession.addEvent({
          type: 'tab_closed',
          action: {
            tabId,
            url: ''  // URL not available after close
          }
        })

        // Find another tab to switch to
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs.length > 0 && tabs[0].id) {
          this.activeTabId = tabs[0].id
          this.currentSession.setActiveTabId(this.activeTabId)
          // Let heartbeat handle injection - don't force inject
        } else {
          this.activeTabId = null
        }
      }
    }

    // We'll add/remove these listeners dynamically during recording
  }

}
