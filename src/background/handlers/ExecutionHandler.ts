import { MessageType, ExecuteQueryMessage, CancelTaskMessage, ResetConversationMessage } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Execution } from '@/lib/execution/Execution'
import { Logging } from '@/lib/utils/Logging'
import { PubSub } from '@/lib/pubsub'

/**
 * Handles execution-related messages:
 * - EXECUTE_QUERY: Start a new query execution (opens sidepanel if source is 'newtab')
 * - CANCEL_TASK: Cancel running execution
 * - RESET_CONVERSATION: Reset execution state
 */
export class ExecutionHandler {
  private execution: Execution

  constructor() {
    this.execution = Execution.getInstance()
  }

  /**
   * Handle EXECUTE_QUERY message
   */
  async handleExecuteQuery(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    const payload = message.payload as ExecuteQueryMessage['payload']
    const { query, tabIds, chatMode, metadata } = payload
    
    Logging.log('ExecutionHandler', 
      `Starting execution: "${query}" (mode: ${chatMode ? 'chat' : 'browse'})`)
    
    // Log metrics
    Logging.logMetric('query_initiated', {
      query,
      source: metadata?.source || 'unknown',
      mode: chatMode ? 'chat' : 'browse',
      executionMode: metadata?.executionMode || 'dynamic',
    })
    
    try {
      // If execution is running, cancel it first
      if (this.execution.isRunning()) {
        Logging.log('ExecutionHandler', `Cancelling previous task`)
        this.execution.cancel()
      }
      
      // Update execution options
      this.execution.updateOptions({
        mode: chatMode ? 'chat' : 'browse',
        tabIds,
        metadata,
        debug: false
      })
      
      // Run the query
      await this.execution.run(query, metadata)
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success'
        },
        id: message.id
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error executing query: ${errorMessage}`, 'error')
      
      // Send error response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle CANCEL_TASK message
   */
  handleCancelTask(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    Logging.log('ExecutionHandler', `Cancelling execution`)
    
    try {
      this.execution.cancel()
      Logging.logMetric('task_cancelled', {})
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Task cancelled'
        },
        id: message.id
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error cancelling task: ${errorMessage}`, 'error')
      
      // Send error response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle RESET_CONVERSATION message
   */
  handleResetConversation(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    Logging.log('ExecutionHandler', `Resetting execution`)
    
    try {
      this.execution.reset()
      Logging.logMetric('conversation_reset', {})
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Conversation reset'
        },
        id: message.id
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error resetting conversation: ${errorMessage}`, 'error')
      
      // Send error response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle HUMAN_INPUT_RESPONSE message
   */
  handleHumanInputResponse(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    const payload = message.payload as any
    
    // Forward the response through PubSub
    const pubsub = PubSub.getChannel("main")
    pubsub.publishHumanInputResponse(payload)
    
    Logging.log('ExecutionHandler', 
      `Forwarded human input response`)
  }

  /**
   * Handle NEWTAB_EXECUTE_QUERY - message from newtab
   * Opens sidepanel for display and executes directly
   */
  async handleNewtabQuery(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { tabId, query, metadata } = message

    Logging.log('ExecutionHandler',
      `Received query from newtab for tab ${tabId}: "${query}"`)

    // Log metrics
    Logging.logMetric('query_initiated', {
      query,
      source: metadata?.source || 'newtab',
      mode: 'browse',
      executionMode: metadata?.executionMode || 'dynamic',
    })

    try {
      // Open sidepanel for UI display
      await chrome.sidePanel.open({ tabId })

      // Small delay to ensure sidepanel starts listening to PubSub
      await new Promise(resolve => setTimeout(resolve, 200))

      // Notify sidepanel that execution is starting (for processing state)
      chrome.runtime.sendMessage({
        type: MessageType.EXECUTION_STARTING,
        source: 'newtab'
      }).catch(() => {
        // Sidepanel might not be ready yet, that's OK - it will pick up state from stream
      })

      // Cancel any running execution
      if (this.execution.isRunning()) {
        Logging.log('ExecutionHandler', `Cancelling previous task`)
        this.execution.cancel()
      }

      // Update execution options
      this.execution.updateOptions({
        mode: 'browse',
        tabIds: [tabId],
        metadata,
        debug: false
      })

      // Execute directly (sidepanel will receive updates via PubSub)
      await this.execution.run(query, metadata)

      sendResponse({ ok: true })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler',
        `Failed to handle newtab query: ${errorMessage}`, 'error')
      sendResponse({ ok: false, error: errorMessage })
    }
  }

}
