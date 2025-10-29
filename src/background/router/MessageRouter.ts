import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'

// Handler function type
export type MessageHandler = (
  message: PortMessage,
  port: chrome.runtime.Port
) => Promise<void> | void

/**
 * Simple message router for singleton architecture
 */
export class MessageRouter {
  private handlers: Map<MessageType, MessageHandler> = new Map()

  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    this.handlers.set(type, handler)
    Logging.log('MessageRouter', `Registered handler for ${type}`)
  }

  /**
   * Route a message to the appropriate handler
   */
  async routeMessage(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    // Log the routing
    Logging.log('MessageRouter', `Routing ${message.type} from ${port.name}`)

    // Find and execute handler
    const handler = this.handlers.get(message.type)

    if (handler) {
      try {
        await handler(message, port)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logging.log('MessageRouter', `Handler error for ${message.type}: ${errorMessage}`, 'error')
        
        // Send error response back to port
        this.sendErrorResponse(port, message, errorMessage)
      }
    } else {
      Logging.log('MessageRouter', `No handler for message type: ${message.type}`, 'warning')
      this.sendErrorResponse(port, message, `Unknown message type: ${message.type}`)
    }
  }


  /**
   * Send error response back to port
   */
  private sendErrorResponse(
    port: chrome.runtime.Port,
    originalMessage: PortMessage,
    error: string
  ): void {
    try {
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error 
        },
        id: originalMessage.id
      })
    } catch (err) {
      // Port might be disconnected
      Logging.log('MessageRouter', `Could not send error response: ${err}`, 'warning')
    }
  }

  /**
   * Check if a handler is registered for a message type
   */
  hasHandler(type: MessageType): boolean {
    return this.handlers.has(type)
  }

  /**
   * Remove a handler
   */
  removeHandler(type: MessageType): void {
    this.handlers.delete(type)
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear()
  }

  /**
   * Get list of registered message types
   */
  getRegisteredTypes(): MessageType[] {
    return Array.from(this.handlers.keys())
  }
}