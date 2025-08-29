import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { parsePortName } from '@/lib/utils/portUtils'

// Handler function type
export type MessageHandler = (
  message: PortMessage,
  port: chrome.runtime.Port,
  executionId?: string
) => Promise<void> | void

/**
 * Routes messages to appropriate handlers based on message type and executionId.
 * Central routing logic for the background script.
 */
export class MessageRouter {
  private handlers: Map<MessageType, MessageHandler> = new Map()
  private defaultHandler?: MessageHandler

  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    this.handlers.set(type, handler)
    Logging.log('MessageRouter', `Registered handler for ${type}`)
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<MessageType, MessageHandler>): void {
    Object.entries(handlers).forEach(([type, handler]) => {
      this.registerHandler(type as MessageType, handler)
    })
  }

  /**
   * Set a default handler for unhandled message types
   */
  setDefaultHandler(handler: MessageHandler): void {
    this.defaultHandler = handler
  }

  /**
   * Route a message to the appropriate handler
   */
  async routeMessage(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    // Parse port name to extract information
    const portInfo = parsePortName(port.name)
    const executionId = portInfo.executionId
    
    // Log the routing
    Logging.log('MessageRouter', 
      `Routing ${message.type} from ${port.name}${executionId ? ` (execution: ${executionId})` : ''}${portInfo.tabId ? ` (tab: ${portInfo.tabId})` : ''}`)

    // Find and execute handler
    const handler = this.handlers.get(message.type) || this.defaultHandler

    if (handler) {
      try {
        await handler(message, port, executionId)
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
    this.defaultHandler = undefined
  }

  /**
   * Get list of registered message types
   */
  getRegisteredTypes(): MessageType[] {
    return Array.from(this.handlers.keys())
  }
}