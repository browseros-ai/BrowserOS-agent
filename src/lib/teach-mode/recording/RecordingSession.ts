import { CapturedEvent, EventType, RecordingMetadata, TeachModeRecording } from '@/lib/teach-mode/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Manages a single recording session
 * Collects events and metadata during recording
 */
export class RecordingSession {
  private metadata: RecordingMetadata
  private events: CapturedEvent[] = []
  private eventCounter = 0

  constructor(tabId: number, url: string) {
    this.metadata = {
      id: `recording_${Date.now()}`,
      startTime: Date.now(),
      tabId,
      url
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
}