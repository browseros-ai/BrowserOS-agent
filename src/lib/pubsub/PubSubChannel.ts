import { Message, PubSubEvent, SubscriptionCallback, Subscription, HumanInputRequest, HumanInputResponse, TeachModeEventPayload } from './types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Scoped PubSub channel for a single execution.
 * Provides the same API as PubSub but isolated per execution.
 */
export class PubSubChannel {
  readonly executionId: string
  private subscribers: Set<SubscriptionCallback> = new Set()
  private messageBuffer: PubSubEvent[] = []
  private readonly MAX_BUFFER_SIZE = 200  // Max messages to keep
  private isDestroyed: boolean = false

  constructor(executionId: string) {
    this.executionId = executionId
    Logging.log('PubSubChannel', `Created channel for execution ${executionId}`)
  }

  /**
   * Publish a message to this channel
   */
  publishMessage(message: Message): void {
    if (this.isDestroyed) {
      console.warn(`PubSubChannel: Attempted to publish to destroyed channel ${this.executionId}`)
      return
    }
    
    const event: PubSubEvent = {
      type: 'message',
      payload: message
    }
    this._publish(event)
  }

  /**
   * Publish human input request
   */
  publishHumanInputRequest(request: HumanInputRequest): void {
    if (this.isDestroyed) {
      console.warn(`PubSubChannel: Attempted to publish request to destroyed channel ${this.executionId}`)
      return
    }
    
    const event: PubSubEvent = {
      type: 'human-input-request',
      payload: request
    }
    this._publish(event)
  }

  /**
   * Publish human input response (called from UI)
   */
  publishHumanInputResponse(response: HumanInputResponse): void {
    if (this.isDestroyed) {
      console.warn(`PubSubChannel: Attempted to publish response to destroyed channel ${this.executionId}`)
      return
    }

    const event: PubSubEvent = {
      type: 'human-input-response',
      payload: response
    }
    this._publish(event)
  }

  /**
   * Publish teach mode event
   */
  publishTeachModeEvent(payload: TeachModeEventPayload): void {
    if (this.isDestroyed) {
      console.warn(`PubSubChannel: Attempted to publish teach mode event to destroyed channel ${this.executionId}`)
      return
    }

    const event: PubSubEvent = {
      type: 'teach-mode-event',
      payload: payload
    }
    this._publish(event)

    Logging.log('PubSubChannel', `Published teach mode event: ${payload.eventType} for session ${payload.sessionId}`)
  }

  /**
   * Subscribe to events on this channel
   */
  subscribe(callback: SubscriptionCallback): Subscription {
    if (this.isDestroyed) {
      console.warn(`PubSubChannel: Attempted to subscribe to destroyed channel ${this.executionId}`)
      return {
        unsubscribe: () => {}
      }
    }
    
    this.subscribers.add(callback)
    
    // Send buffered messages to new subscriber
    this.messageBuffer.forEach(event => {
      try {
        callback(event)
      } catch (error) {
        console.error(`PubSubChannel[${this.executionId}]: Error replaying buffered event`, error)
      }
    })

    return {
      unsubscribe: () => {
        this.subscribers.delete(callback)
      }
    }
  }

  /**
   * Get current buffer
   */
  getBuffer(): PubSubEvent[] {
    return [...this.messageBuffer]
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.messageBuffer = []
  }

  /**
   * Internal publish method
   * @private
   */
  private _publish(event: PubSubEvent): void {
    // Add to buffer
    this.messageBuffer.push(event)
    
    // Trim buffer if too large
    if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
      this.messageBuffer = this.messageBuffer.slice(-this.MAX_BUFFER_SIZE)
    }
    
    // Notify all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error(`PubSubChannel[${this.executionId}]: Subscriber error`, error)
      }
    })
  }

  /**
   * Check if channel is destroyed
   */
  isActive(): boolean {
    return !this.isDestroyed
  }

  /**
   * Get number of subscribers
   */
  getSubscriberCount(): number {
    return this.subscribers.size
  }

  /**
   * Get channel statistics
   */
  getStats(): {
    executionId: string
    subscribers: number
    bufferSize: number
    isActive: boolean
  } {
    return {
      executionId: this.executionId,
      subscribers: this.subscribers.size,
      bufferSize: this.messageBuffer.length,
      isActive: !this.isDestroyed
    }
  }

  /**
   * Destroy the channel and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) {
      return
    }
    
    // Clear all subscribers
    this.subscribers.clear()
    
    // Clear message buffer
    this.messageBuffer = []
    
    // Mark as destroyed
    this.isDestroyed = true
    
    Logging.log('PubSubChannel', `Destroyed channel for execution ${this.executionId}`)
  }
  
  // ============================================
  // Static helper methods (mirror PubSub API)
  // ============================================
  
  /**
   * Generate a unique message ID
   * @param prefix - Optional prefix for the ID
   */
  static generateId(prefix: string = 'msg'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Create a message object with generated ID
   */
  static createMessage(content: string, role: Message['role'] = 'thinking'): Message {
    return {
      msgId: PubSubChannel.generateId(`msg_${role}`),
      content,
      role,
      ts: Date.now()
    }
  }
  
  /**
   * Create a message with specific ID
   */
  static createMessageWithId(msgId: string, content: string, role: Message['role'] = 'thinking'): Message {
    return {
      msgId,
      content,
      role,
      ts: Date.now()
    }
  }
}