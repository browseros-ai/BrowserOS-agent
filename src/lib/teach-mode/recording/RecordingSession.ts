import { CapturedEvent, EventType, RecordingMetadata, TeachModeRecording, BrowserState } from '@/lib/teach-mode/types'
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
  private metadata: RecordingMetadata
  private events: CapturedEvent[] = []
  private eventCounter = 0
  private isDebugMode = isDevelopmentMode()
  private pubsub: PubSubChannel
  private stateCapture: StateCapture
  private browserContext: BrowserContext | null = null

  constructor(tabId: number, url: string, browserContext?: BrowserContext) {
    this.metadata = {
      id: `recording_${Date.now()}`,
      startTime: Date.now(),
      tabId,
      url
    }

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
      url
    })

    Logging.log('RecordingSession', `Started recording session ${this.metadata.id} on tab ${tabId}`)
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
    this.addEvent({
      type: 'setViewport',
      ...viewport
    })
  }

  /**
   * Add a captured event to the session
   */
  addEvent(eventData: Partial<CapturedEvent> & { type: EventType }): void {
    const event: CapturedEvent = {
      id: `event_${this.metadata.id}_${this.eventCounter++}`,
      timestamp: Date.now(),
      ...eventData
    }

    this.events.push(event)
    Logging.log('RecordingSession', `Added event: ${event.type} (${event.id})`)

    // Schedule state capture for interaction events (100ms delay)
    const interactionEvents = ['click', 'dblclick', 'change', 'input', 'keydown', 'navigation', 'setViewport']
    if (interactionEvents.includes(event.type) && this.browserContext) {
      this._scheduleStateCapture(event)
    }

    // Emit debug message to sidepanel in dev mode
    this._emitDebugMessage(event.type, eventData)
  }

  /**
   * Handle navigation event
   */
  handleNavigation(url: string, transitionType?: string): void {
    this.addEvent({
      type: 'navigation',
      url
    })
  }

  /**
   * Stop the recording session
   */
  stop(): TeachModeRecording {
    // Add session end event
    this.addEvent({
      type: 'session_end'
    })

    // Update end time
    this.metadata.endTime = Date.now()

    // Cancel any pending state captures
    this.stateCapture.cleanup()

    const recording: TeachModeRecording = {
      metadata: this.metadata,
      events: this.events
    }

    Logging.log('RecordingSession', `Stopped recording session ${this.metadata.id} with ${this.events.length} events`)

    return recording
  }

  /**
   * Get current recording data without stopping
   */
  getRecording(): TeachModeRecording {
    return {
      metadata: { ...this.metadata },
      events: [...this.events]
    }
  }

  /**
   * Get session metadata
   */
  getMetadata(): RecordingMetadata {
    return { ...this.metadata }
  }

  /**
   * Get tab ID being recorded
   */
  getTabId(): number {
    return this.metadata.tabId
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
      // Schedule state capture with 100ms delay
      const state = await this.stateCapture.scheduleCapture(
        event.id,
        this.metadata.tabId,
        100
      )

      if (state) {
        // Find the event and add the state to it
        const eventIndex = this.events.findIndex(e => e.id === event.id)
        if (eventIndex !== -1) {
          this.events[eventIndex].state = state
          Logging.log('RecordingSession', `Added state to event ${event.id}`)
        }
      }
    } catch (error) {
      Logging.log('RecordingSession', `Failed to capture state for event ${event.id}: ${error}`, 'warning')
    }
  }

  /**
   * Emit debug message to sidepanel in dev mode
   */
  private _emitDebugMessage(eventType: EventType, eventData: Partial<CapturedEvent>): void {
    if (!this.isDebugMode) return


    // Publish message to sidepanel
    this.pubsub.publishMessage(
      PubSub.createMessage(`[TEACH MODE] ${eventType}`, 'thinking')
    )
  }
}
