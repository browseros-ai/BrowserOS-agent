import { Logging } from '@/lib/utils/Logging'
import { MessageType } from '@/lib/types/messaging'
import { PubSub } from '@/lib/pubsub'
import { Subscription, PubSubEvent } from '@/lib/pubsub/types'
import { ExecutionEvent, EventType } from '@/lib/pubsub/types'

// Simplified port info for singleton
interface PortInfo {
  port: chrome.runtime.Port
  connectedAt: number
  subscription?: Subscription
}

/**
 * Simple port manager for singleton architecture
 */
export class PortManager {
  private ports: Map<string, PortInfo> = new Map()
  private currentSessionId: string | null = null
  private currentSubscription: Subscription | null = null

  constructor() {
    // Session-based channel subscription only - no more "main" channel
  }

  /**
   * Register a new port connection
   */
  registerPort(port: chrome.runtime.Port): string {
    const portId = port.name  // Just use port name as ID

    // Store port info
    const info: PortInfo = {
      port,
      connectedAt: Date.now()
    }

    // Set up session message listener for sidepanel
    if (port.name === 'sidepanel') {
      port.onMessage.addListener((message) => {
        if (message.type === 'SUBSCRIBE_SESSION') {
          console.log('[PortManager] SUBSCRIBE_SESSION received:', message.sessionId, 'at', Date.now())
          this.subscribeToSession(message.sessionId, port)
        }
      })

      // OLD "main" channel subscription removed - fully migrated to session-based channels
      // Each mode now subscribes to its own session channel (browse_*, chat_*, teach_*, record_*)
    }

    this.ports.set(portId, info)

    Logging.log('PortManager', `Registered ${port.name} port`)

    return portId
  }


  /**
   * Unregister a port (on disconnect)
   */
  unregisterPort(port: chrome.runtime.Port): void {
    const portId = port.name
    const portInfo = this.ports.get(portId)
    
    if (!portInfo) {
      return
    }
    
    // Unsubscribe from PubSub if subscribed
    if (portInfo.subscription) {
      portInfo.subscription.unsubscribe()
    }
    
    // Remove port info
    this.ports.delete(portId)
    
    Logging.log('PortManager', `Unregistered ${port.name} port`)
  }

  /**
   * Get port info by port object
   */
  getPortInfo(port: chrome.runtime.Port): PortInfo | undefined {
    return this.ports.get(port.name)
  }

  /**
   * Clean up all ports
   */
  cleanup(): void {
    // Unsubscribe from current session
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe()
      this.currentSubscription = null
    }

    // Unsubscribe all port subscriptions
    for (const portInfo of this.ports.values()) {
      if (portInfo.subscription) {
        portInfo.subscription.unsubscribe()
      }
    }

    // Clear map
    this.ports.clear()
  }

  /**
   * Subscribe to a specific session channel
   */
  public subscribeToSession(sessionId: string, port: chrome.runtime.Port): void {
    console.log('[PortManager] subscribeToSession called:', sessionId)
    Logging.log('PortManager', `Subscribing to session: ${sessionId}`)

    // Unsubscribe from old session
    if (this.currentSubscription) {
      console.log('[PortManager] Unsubscribing from old session')
      this.currentSubscription.unsubscribe()
      this.currentSubscription = null
    }

    // Subscribe to new session channel
    console.log('[PortManager] Getting channel:', sessionId)
    const sessionChannel = PubSub.getChannel(sessionId)
    console.log('[PortManager] Channel retrieved, subscribing to events...')

    this.currentSubscription = sessionChannel.subscribeToEvents((event: ExecutionEvent) => {
      console.log('[PortManager] Callback received event:', event.type, event.message?.substring(0, 40))

      // Transform ExecutionEvent → PubSubEvent
      const pubsubEvent = this.transformEvent(event)
      if (!pubsubEvent) {
        console.log('[PortManager] Event transformed to null, skipping')
        return  // Skip null events
      }

      console.log('[PortManager] Forwarding event to UI, type:', pubsubEvent.type)
      // Forward to UI
      try {
        port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: {
            executionId: sessionId,
            event: pubsubEvent
          }
        })
        console.log('[PortManager] Event forwarded successfully')
      } catch (error) {
        console.error('[PortManager] Failed to forward event:', error)
        Logging.log('PortManager', `Failed to forward event: ${error}`, 'warning')
      }
    })

    console.log('[PortManager] Subscription complete, sessionId stored:', sessionId)
    this.currentSessionId = sessionId
  }

  /**
   * Transform ExecutionEvent to PubSubEvent for backward compatibility
   */
  private transformEvent(execEvent: ExecutionEvent): PubSubEvent | null {
    switch (execEvent.type) {
      case 'thinking':
        // For teach mode sessions, send thinking as teach-mode-event
        if (execEvent.sessionId?.startsWith('teach_')) {
          return {
            type: 'teach-mode-event',
            payload: {
              eventType: 'execution_thinking',
              sessionId: execEvent.sessionId,
              data: {
                msgId: execEvent.data?.msgId || `msg_${Date.now()}`,
                content: execEvent.message,
                timestamp: execEvent.timestamp
              }
            }
          }
        }
        // For other modes, send as regular message
        return {
          type: 'message',
          payload: {
            msgId: execEvent.data?.msgId || `msg_${Date.now()}`,
            content: execEvent.message,
            role: 'thinking',
            ts: execEvent.timestamp
          }
        }

      case 'message': {
        const level = execEvent.data?.level || 'info'
        const roleMap: Record<string, 'thinking' | 'assistant' | 'error'> = {
          'info': 'thinking',
          'success': 'assistant',
          'warning': 'assistant',
          'error': 'error'
        }

        // For teach mode sessions, send all messages as teach-mode-event
        if (execEvent.sessionId?.startsWith('teach_')) {
          return {
            type: 'teach-mode-event',
            payload: {
              eventType: 'execution_thinking',  // Use thinking event type for all messages
              sessionId: execEvent.sessionId,
              data: {
                msgId: execEvent.data?.msgId || `msg_${Date.now()}`,
                content: execEvent.message,
                timestamp: execEvent.timestamp,
                level: level  // Preserve level for UI to style differently
              }
            }
          }
        }

        // For other modes, send as regular message
        return {
          type: 'message',
          payload: {
            msgId: execEvent.data?.msgId || `msg_${Date.now()}`,  // Use msgId from data if available for streaming upserts
            content: execEvent.message,
            role: roleMap[level],
            ts: execEvent.timestamp
          }
        }
      }

      case 'failed':
        // For teach mode sessions, send as teach-mode-event
        if (execEvent.sessionId?.startsWith('teach_')) {
          return {
            type: 'teach-mode-event',
            payload: {
              eventType: 'execution_failed',
              sessionId: execEvent.sessionId,
              data: {
                message: execEvent.message,
                error: execEvent.data?.error,
                timestamp: execEvent.timestamp
              }
            }
          }
        }
        // For browse/chat modes, send as error message WITH completion marker
        return {
          type: 'message',
          payload: {
            msgId: `error_${Date.now()}`,
            content: execEvent.message,
            role: 'error',
            ts: execEvent.timestamp
          },
          metadata: { sessionCompleted: true }  // Mark as completion to clear isProcessing
        } as any

      case 'human_input':
        if (execEvent.data?.action === 'request') {
          const requestId = execEvent.data.requestId
          const sessionId = execEvent.sessionId

          // Track this request so we can route the response back to the correct session
          if (requestId && sessionId) {
            const { ExecutionHandler } = require('@/background/handlers/ExecutionHandler')
            ExecutionHandler.trackHumanInputRequest(requestId, sessionId)
          }

          return {
            type: 'human-input-request',
            payload: {
              requestId: requestId,
              prompt: execEvent.data.prompt
            }
          }
        }
        return null

      case 'recording':
      case 'preprocessing':
        // Transform to match TeachModeEventPayload schema
        return {
          type: 'teach-mode-event',
          payload: {
            eventType: execEvent.data.action,  // Rename action → eventType
            sessionId: execEvent.sessionId,  // Add sessionId from ExecutionEvent
            data: execEvent.data  // Keep original data structure
          }
        }

      // Handle session lifecycle events
      case 'started':
        // For teach mode sessions, send execution_started event
        if (execEvent.sessionId?.startsWith('teach_')) {
          return {
            type: 'teach-mode-event',
            payload: {
              eventType: 'execution_started',
              sessionId: execEvent.sessionId,
              data: {
                task: execEvent.data?.task,
                totalSteps: execEvent.data?.totalSteps,
                timestamp: execEvent.timestamp
              }
            }
          }
        }
        // For other modes, skip
        return null

      case 'completed':
        console.log('[PortManager] Session completed:', execEvent.sessionId)

        // Send completion event BEFORE cleanup
        let completedEvent: PubSubEvent | null = null

        if (execEvent.sessionId?.startsWith('teach_')) {
          // Teach mode: send as teach-mode-event
          completedEvent = {
            type: 'teach-mode-event' as const,
            payload: {
              eventType: 'execution_completed' as const,
              sessionId: execEvent.sessionId,
              data: {
                message: execEvent.message,
                duration: execEvent.data?.duration,
                timestamp: execEvent.timestamp
              }
            }
          }
        } else if (execEvent.sessionId?.startsWith('browse_') || execEvent.sessionId?.startsWith('chat_')) {
          // Browse/Chat mode: send as regular message with special marker
          completedEvent = {
            type: 'message' as const,
            payload: {
              msgId: `completion_${Date.now()}`,
              content: execEvent.message,
              role: 'assistant' as const,
              ts: execEvent.timestamp
            },
            metadata: { sessionCompleted: true }  // Special marker for UI
          } as any
        }

        // Unsubscribe from session when it ends
        if (this.currentSessionId === execEvent.sessionId && this.currentSubscription) {
          console.log('[PortManager] Unsubscribing from completed session')
          this.currentSubscription.unsubscribe()
          this.currentSubscription = null
          this.currentSessionId = null
        }

        return completedEvent

      case 'aborted':
        console.log('[PortManager] Session aborted:', execEvent.sessionId)

        // Send abort notification BEFORE cleanup
        let abortedEvent: PubSubEvent | null = null
        if (execEvent.sessionId?.startsWith('teach_')) {
          // Teach mode: send as teach-mode-event
          abortedEvent = {
            type: 'teach-mode-event' as const,
            payload: {
              eventType: 'execution_failed' as const,  // Use failed to trigger cleanup
              sessionId: execEvent.sessionId,
              data: {
                message: execEvent.message || '✋ Task cancelled',
                timestamp: execEvent.timestamp
              }
            }
          }
        } else if (execEvent.sessionId?.startsWith('browse_') || execEvent.sessionId?.startsWith('chat_')) {
          // Browse/Chat mode: send as message with completion marker
          abortedEvent = {
            type: 'message' as const,
            payload: {
              msgId: `aborted_${Date.now()}`,
              content: execEvent.message || '✋ Task cancelled',
              role: 'assistant' as const,
              ts: execEvent.timestamp
            },
            metadata: { sessionCompleted: true }  // Mark as completion to clear isProcessing
          } as any
        }

        // Unsubscribe from session when it ends
        if (this.currentSessionId === execEvent.sessionId && this.currentSubscription) {
          console.log('[PortManager] Unsubscribing from aborted session')
          this.currentSubscription.unsubscribe()
          this.currentSubscription = null
          this.currentSessionId = null
        }

        return abortedEvent  // Forward abort notification to UI

      // Skip tool events
      case 'tool':
        return null

      default:
        Logging.log('PortManager', `Unknown event type: ${(execEvent as any).type}`, 'warning')
        return null
    }
  }

  /**
   * Broadcast session start to all connected UIs
   */
  public broadcastSessionStart(sessionId: string, mode: string): void {
    Logging.log('PortManager', `Broadcasting session start: ${sessionId} (${mode})`)

    // Broadcast to all sidepanel ports
    for (const [portId, portInfo] of this.ports.entries()) {
      if (portId === 'sidepanel') {
        try {
          portInfo.port.postMessage({
            type: 'SESSION_STARTED',
            payload: { sessionId, mode }
          })
        } catch (error) {
          Logging.log('PortManager', `Failed to broadcast session start: ${error}`, 'warning')
        }
      }
    }
  }
}
