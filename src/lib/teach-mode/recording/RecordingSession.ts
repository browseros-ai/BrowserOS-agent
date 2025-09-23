import { CapturedEvent, EventType, RecordingMetadata, TeachModeRecording } from '@/lib/teach-mode/types'
import { Logging } from '@/lib/utils/Logging'
import { isDevelopmentMode } from '@/config'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'

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

  constructor(tabId: number, url: string) {
    this.metadata = {
      id: `recording_${Date.now()}`,
      startTime: Date.now(),
      tabId,
      url
    }

    // Use the main PubSub channel for messages
    this.pubsub = PubSub.getChannel('main')

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
