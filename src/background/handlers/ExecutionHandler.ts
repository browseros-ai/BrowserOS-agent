import { MessageType, ExecuteQueryMessage, CancelTaskMessage, ResetConversationMessage } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { ExecutionManager } from '@/lib/execution/ExecutionManager'
import { Logging } from '@/lib/utils/Logging'
import { PubSub } from '@/lib/pubsub'
import { getExecutionId } from '@/lib/utils/executionUtils'

/**
 * Handles execution-related messages:
 * - EXECUTE_QUERY: Start a new query execution (opens sidepanel if source is 'newtab')
 * - CANCEL_TASK: Cancel running execution
 * - RESET_CONVERSATION: Reset execution state
 */
export class ExecutionHandler {
  private executionManager: ExecutionManager

  constructor() {
    this.executionManager = ExecutionManager.getInstance()
  }

  /**
   * Handle EXECUTE_QUERY message
   */
  async handleExecuteQuery(
    message: PortMessage,
    port: chrome.runtime.Port,
    executionId?: string
  ): Promise<void> {
    const payload = message.payload as ExecuteQueryMessage['payload']
    const { query, tabIds, chatMode, metadata } = payload
    
    // Use executionId from port or generate default
    const execId = executionId || 'default'
    
    // If source is newtab, notify sidepanel to switch context and open it
    if (metadata?.source === 'newtab') {
      const tabId = tabIds?.[0]
      if (tabId) {
        try {
          // Send context switch message via chrome.runtime.sendMessage
          // The sidepanel will listen for this and reconnect with new executionId
          chrome.runtime.sendMessage({
            type: MessageType.SWITCH_EXECUTION_CONTEXT,
            payload: {
              executionId: execId,
              tabId: tabId,
              cancelExisting: true
            }
          }).catch(() => {
            // No listeners yet, that's fine - sidepanel might not be open
          })
          
          // Open sidepanel
          await chrome.sidePanel.open({ tabId })
          // Give sidepanel time to initialize
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (sidepanelError) {
          Logging.log('ExecutionHandler', 
            `Could not open sidepanel for tab ${tabId}: ${sidepanelError}`, 'warning')
        }
      }
    }
    
    Logging.log('ExecutionHandler', 
      `Starting execution ${execId}: "${query}" (mode: ${chatMode ? 'chat' : 'browse'})`)
    
    // Log metrics
    Logging.logMetric('query_initiated', {
      query,
      source: metadata?.source || 'unknown',
      mode: chatMode ? 'chat' : 'browse',
      executionMode: metadata?.executionMode || 'dynamic',
    })
    
    try {
      // Get or create execution
      let execution = this.executionManager.get(execId)
      
      if (!execution) {
        // Create new execution
        execution = this.executionManager.create(execId, {
          mode: chatMode ? 'chat' : 'browse',
          tabIds,
          metadata,
          debug: false
        })
      } else {
        // If execution exists and is running, cancel it
        // No need to wait - the new run() will handle it
        if (execution.isRunning()) {
          Logging.log('ExecutionHandler', `Cancelling previous task for execution ${execId}`)
          execution.cancel()
        }
      }
      
      // Run the query
      await execution.run(query, metadata)
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          executionId: execId
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
          error: errorMessage,
          executionId: execId
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
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    const execId = executionId || 'default'
    
    Logging.log('ExecutionHandler', `Cancelling execution ${execId}`)
    
    try {
      this.executionManager.cancel(execId)
      Logging.logMetric('task_cancelled', { executionId: execId })
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Task cancelled',
          executionId: execId
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
          error: errorMessage,
          executionId: execId
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
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    const execId = executionId || 'default'
    
    Logging.log('ExecutionHandler', `Resetting execution ${execId}`)
    
    try {
      this.executionManager.reset(execId)
      Logging.logMetric('conversation_reset', { executionId: execId })
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Conversation reset',
          executionId: execId
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
          error: errorMessage,
          executionId: execId
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
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    const execId = executionId || 'default'
    const payload = message.payload as any
    
    // Get the execution and forward the response
    const execution = this.executionManager.get(execId)
    if (execution) {
      // Get the execution's PubSub channel
      const pubsub = PubSub.getChannel(execId)
      pubsub.publishHumanInputResponse(payload)
      
      Logging.log('ExecutionHandler', 
        `Forwarded human input response for execution ${execId}`)
    } else {
      Logging.log('ExecutionHandler', 
        `No execution found for human input response: ${execId}`, 'warning')
    }
  }

  /**
   * Clean up execution for a closed tab
   */
  async cleanupTabExecution(tabId: number): Promise<void> {
    const execId = await getExecutionId(tabId)
    
    const execution = this.executionManager.get(execId)
    if (execution) {
      Logging.log('ExecutionHandler', `Cleaning up execution ${execId} for closed tab ${tabId}`)
      
      // Cancel if running
      if (execution.isRunning()) {
        execution.cancel()
      }
      
      // Delete the execution
      await this.executionManager.delete(execId)
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): any {
    return this.executionManager.getStats()
  }
}
