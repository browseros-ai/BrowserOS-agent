import { CapturedEvent, ActionType, TeachModeRecording, StateSnapshot } from '@/lib/teach-mode/types'
import { Logging } from '@/lib/utils/Logging'
import { isDevelopmentMode } from '@/config'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { StateCapture } from './StateCapture'
import { BrowserContext } from '@/lib/browser/BrowserContext'

/**
 * Manages a single recording session
 * Collects events and metadata during recording
 */
export class RecordingSession {
  private session: TeachModeRecording['session']
  private events: CapturedEvent[] = []
  private eventCounter = 0
  private isDebugMode = isDevelopmentMode()
  private pubsub: PubSubChannel
  private stateCapture: StateCapture
  private browserContext: BrowserContext | null = null
  private viewport?: TeachModeRecording['viewport']
  private narration?: TeachModeRecording['narration']
  private activeTabId: number  // Track current active tab for multi-tab recording

  constructor(tabId: number, url: string, browserContext?: BrowserContext) {
    this.session = {
      id: `recording_${Date.now()}`,
      startTimestamp: Date.now(),
      tabId,  // Initial tab ID
      url
    }

    this.activeTabId = tabId  // Start with the initial tab as active

    // Use the main PubSub channel for messages
    this.pubsub = PubSub.getChannel('main')

    // Initialize state capture
    this.stateCapture = new StateCapture()
    this.browserContext = browserContext || null
    if (this.browserContext) {
      this.stateCapture.setBrowserContext(this.browserContext)
    }

    // Add session start event
    this.addEvent({
      type: 'session_start',
      action: {
        url
      }
    })

    Logging.log('RecordingSession', `Started recording session ${this.session.id} on tab ${tabId}`)
  }

  /**
   * Add viewport information
   */
  addViewport(viewport: {
    width: number
    height: number
    deviceScaleFactor: number
    isMobile: boolean
    hasTouch: boolean
    isLandscape: boolean
  }): void {
    this.viewport = viewport
    Logging.log('RecordingSession', `Set viewport: ${viewport.width}x${viewport.height}`)
  }

  /**
   * Add a captured event to the session
   */
  addEvent(eventData: { type: ActionType; action?: Partial<CapturedEvent['action']>; target?: CapturedEvent['target'] }): void {
    const event: CapturedEvent = {
      id: `event_${this.session.id}_${this.eventCounter++}`,
      timestamp: Date.now(),
      action: {
        type: eventData.type,
        ...eventData.action
      },
      target: eventData.target
    }

    this.events.push(event)
    Logging.log('RecordingSession', `Added event: ${event.action.type} (${event.id})`)

    // Schedule state capture for significant interaction events (100ms delay)
    // We capture state after actions that change the page state
    const stateChangeEvents = ['click', 'dblclick', 'change', 'scroll', 'type', 'navigation', 'session_start', 'session_end']
    if (stateChangeEvents.includes(event.action.type) && this.browserContext) {
      this._scheduleStateCapture(event)
    }

    // Emit debug message to sidepanel in dev mode
    this._emitDebugMessage(event.action.type, eventData)
  }

  /**
   * Handle navigation event
   */
  handleNavigation(url: string, transitionType?: string): void {
    this.addEvent({
      type: 'navigation',
      action: {
        url
      }
    })
  }

  /**
   * Stop the recording session
   */
  stop(): TeachModeRecording {
    // Add session end event
    this.addEvent({
      type: 'session_end',
      action: {}
    })

    // Update end time
    this.session.endTimestamp = Date.now()

    // Cancel any pending state captures
    this.stateCapture.cleanup()

    const recording: TeachModeRecording = {
      session: this.session,
      narration: this.narration,
      viewport: this.viewport,
      events: this.events
    }

    Logging.log('RecordingSession', `Stopped recording session ${this.session.id} with ${this.events.length} events`)

    return recording
  }

  /**
   * Get current recording data without stopping
   */
  getRecording(): TeachModeRecording {
    return {
      session: { ...this.session },
      narration: this.narration,
      viewport: this.viewport,
      events: [...this.events]
    }
  }

  /**
   * Get session metadata
   */
  getSession(): TeachModeRecording['session'] {
    return { ...this.session }
  }

  /**
   * Get initial tab ID (for compatibility)
   */
  getTabId(): number {
    return this.session.tabId
  }

  /**
   * Get currently active tab ID
   */
  getActiveTabId(): number {
    return this.activeTabId
  }

  /**
   * Set the active tab for recording
   */
  setActiveTabId(tabId: number): void {
    this.activeTabId = tabId
    Logging.log('RecordingSession', `Active tab changed to ${tabId}`)
  }

  /**
   * Set browser context for state capture
   */
  setBrowserContext(context: BrowserContext): void {
    this.browserContext = context
    this.stateCapture.setBrowserContext(context)
  }

  /**
   * Schedule state capture after an event
   */
  private async _scheduleStateCapture(event: CapturedEvent): Promise<void> {
    try {
      // Schedule state capture with 100ms delay on active tab
      const state = await this.stateCapture.scheduleCapture(
        event.id,
        this.activeTabId,  // Use active tab instead of initial tab
        100
      )

      if (state) {
        // Find the event and add the state to it
        const eventIndex = this.events.findIndex(e => e.id === event.id)
        if (eventIndex !== -1) {
          this.events[eventIndex].state = state
          Logging.log('RecordingSession', `Added state to event ${event.id}`)

          // Emit debug message with state info only after successful capture
          if (this.isDebugMode && state.browserState) {
            const stateInfo = `📸 State captured: ${state.browserState.string.length} chars, screenshot: ${state.screenshot ? 'yes' : 'no'}`
            this.pubsub.publishMessage(
              PubSub.createMessage(`[TEACH MODE] ${stateInfo}`, 'thinking')
            )
          }
        }
      }
    } catch (error) {
      Logging.log('RecordingSession', `Failed to capture state for event ${event.id}: ${error}`, 'warning')
    }
  }

  /**
   * Emit debug message to sidepanel in dev mode
   */
  private _emitDebugMessage(eventType: ActionType, eventData: any): void {
    if (!this.isDebugMode) return

    // Publish message to sidepanel
    this.pubsub.publishMessage(
      PubSub.createMessage(`[TEACH MODE] ${eventType}`, 'thinking')
    )
  }
}
