import { Logging } from '@/lib/utils/Logging'
import { RecordingSession } from '@/lib/teach-mode/recording/RecordingSession'
import type { TeachModeMessage, TeachModeRecording, CapturedEvent } from '@/lib/teach-mode/types'

const NAVIGATION_DELAY_MS = 100  // Delay after navigation before re-injection

/**
 * Service to manage teach mode recording
 * Handles content script injection and event collection
 */
export class TeachModeService {
  private static instance: TeachModeService
  private currentSession: RecordingSession | null = null
  private navigationListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null
  private messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) | null = null

  private constructor() {
    this._setupNavigationListener()
    this._setupMessageListener()
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

      // Create new recording session
      this.currentSession = new RecordingSession(tabId, tab.url)

      // Capture viewport information
      const viewport = await this._captureViewport(tabId)
      if (viewport) {
        this.currentSession.addViewport(viewport)
      }

      // Inject content script
      await this._injectContentScript(tabId)

      // Send start message
      await chrome.tabs.sendMessage(tabId, {
        action: 'START_RECORDING',
        source: 'TeachModeService'
      } as TeachModeMessage)

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

      const tabId = this.currentSession.getTabId()

      // Send stop message to content script
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

      // Re-inject content script after delay
      setTimeout(() => {
        this._reinjectContentScript(details.tabId)
      }, NAVIGATION_DELAY_MS)
    }

    chrome.webNavigation.onCommitted.addListener(this.navigationListener)
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

      // Restart recording
      await chrome.tabs.sendMessage(tabId, {
        action: 'START_RECORDING',
        source: 'TeachModeService'
      } as TeachModeMessage)

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

    // Add event to session
    this.currentSession.addEvent(event)
  }

  /**
   * Save recording to storage (Phase 1: simple JSON file)
   */
  private async _saveRecording(recording: TeachModeRecording): Promise<void> {
    try {
      // For Phase 1, just log the recording
      // In later phases, this will save to chrome.storage and offer download
      const json = JSON.stringify(recording, null, 2)

      // Store in chrome.storage.local
      const key = `teach_recording_${recording.metadata.id}`
      await chrome.storage.local.set({ [key]: json })

      Logging.log('TeachModeService', `Saved recording ${recording.metadata.id} (${json.length} bytes)`)

      // TODO: In future phases, offer download as JSON file
    } catch (error) {
      Logging.log('TeachModeService', `Failed to save recording: ${error}`, 'error')
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
}