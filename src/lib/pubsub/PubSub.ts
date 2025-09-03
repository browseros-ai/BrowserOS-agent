import { Message, PubSubEvent, SubscriptionCallback, Subscription, ExecutionStatus, HumanInputRequest, HumanInputResponse, PlanEditRequest, PlanEditResponse } from './types'

/**
 * Core pub-sub implementation for message passing
 * Handles publish/subscribe pattern with message buffering
 */
export class PubSub {
  private static instance: PubSub | null = null
  private subscribers: Set<SubscriptionCallback> = new Set()
  private messageBuffer: PubSubEvent[] = []  // Simple buffer for replay
  
  private readonly MAX_BUFFER_SIZE = 200  // Max messages to keep

  private constructor() {}

  // Singleton pattern
  static getInstance(): PubSub {
    if (!PubSub.instance) {
      PubSub.instance = new PubSub()
    }
    return PubSub.instance
  }

  // Publish a message
  publishMessage(message: Message): void {
    const event: PubSubEvent = {
      type: 'message',
      payload: message
    }
    this._publish(event)
  }

  // Publish execution status with optional message
  publishExecutionStatus(status: 'running' | 'done' | 'cancelled' | 'error', message?: string): void {
    const event: PubSubEvent = {
      type: 'execution-status',
      payload: {
        status,
        ts: Date.now(),
        ...(message && { message })
      }
    }
    this._publish(event)
  }

  // Publish human input request
  publishHumanInputRequest(request: HumanInputRequest): void {
    const event: PubSubEvent = {
      type: 'human-input-request',
      payload: request
    }
    this._publish(event)
  }

  // Publish human input response (called from UI)
  publishHumanInputResponse(response: HumanInputResponse): void {
    const event: PubSubEvent = {
      type: 'human-input-response',
      payload: response
    }
    this._publish(event)
  }

  // Publish plan edit request (called from agent)
  publishPlanEditRequest(request: PlanEditRequest): void {
    const event: PubSubEvent = {
      type: 'plan-edit-request',
      payload: request
    }
    this._publish(event)
  }

  publishPlanEditResponse(response: PlanEditResponse): void {
    const event: PubSubEvent = {
      type: 'plan-edit-response',
      payload: response
    }
    this._publish(event)
  }

  // Subscribe to events
  subscribe(callback: SubscriptionCallback): Subscription {
    this.subscribers.add(callback)
    
    // Send buffered messages to new subscriber
    this.messageBuffer.forEach(event => {
      try {
        callback(event)
      } catch (error) {
        console.error('PubSub: Error replaying buffered event', error)
      }
    })

    return {
      unsubscribe: () => {
        this.subscribers.delete(callback)
      }
    }
  }

  // Get current buffer
  getBuffer(): PubSubEvent[] {
    return [...this.messageBuffer]
  }

  // Clear buffer
  clearBuffer(): void {
    this.messageBuffer = []
  }

  // Internal publish method
  private _publish(event: PubSubEvent): void {
    // Add to buffer
    this.messageBuffer.push(event)
    
    // Trim buffer if too large
    if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
      this.messageBuffer.shift()
    }

    // Notify all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('PubSub: Subscriber error', error)
      }
    })
  }

  // Helper to generate a unique message ID
  static generateId(prefix: string = 'msg'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  // Helper to create message with auto-generated ID
  static createMessage(content: string, role: Message['role'] = 'thinking'): Message {
    const msgId = PubSub.generateId(`msg_${role}`)
    return {
      msgId,
      content,
      role,
      ts: Date.now()
    }
  }
  
  // Helper to create message with specific ID (for cases where ID matters)
  static createMessageWithId(msgId: string, content: string, role: Message['role'] = 'thinking'): Message {
    return {
      msgId,
      content,
      role,
      ts: Date.now()
    }
  }
}
