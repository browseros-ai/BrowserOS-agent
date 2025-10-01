import { MessageType, ExecuteQueryMessage, CancelTaskMessage, ResetConversationMessage } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Execution } from '@/lib/execution/Execution'
import { Logging } from '@/lib/utils/Logging'
import { isUserCancellation } from '@/lib/utils/Abortable'
import { PubSub } from '@/lib/pubsub'
import { BrowserContext } from '@/lib/browser/BrowserContext'

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
      if (!isUserCancellation(error)) {
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
      } else {
        // Send success status for user cancellation (no error shown)
        Logging.log('ExecutionHandler', 'User cancelled execution', 'info')
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'success' },
          id: message.id
        })
      }
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
   * Handle EXECUTE_TEACH_MODE_WORKFLOW message
   * Executes a teach mode workflow through the unified execution system
   */
  async handleExecuteTeachModeWorkflow(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    const { workflowId } = message.payload as any

    Logging.log('ExecutionHandler',
      `Starting teach mode workflow with ID: ${workflowId}`)

    // Retrieve the workflow from storage
    const TeachModeService = (await import('@/lib/services/TeachModeService')).TeachModeService
    const teachModeService = TeachModeService.getInstance()
    const workflow = await teachModeService.getWorkflow(workflowId)

    if (!workflow) {
      Logging.log('ExecutionHandler',
        `Workflow not found for ID: ${workflowId}`, 'error')

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: `Workflow not found for ID: ${workflowId}`
        },
        id: message.id
      })
      return
    }

    // Log metrics
    Logging.logMetric('teachmode.workflow.executed', {
      workflowGoal: workflow.metadata.goal,
      stepsCount: workflow.steps.length
    })

    try {
      // If execution is running, cancel it first
      if (this.execution.isRunning()) {
        Logging.log('ExecutionHandler', `Cancelling previous task`)
        this.execution.cancel()
      }

      // Update execution options for teach mode
      this.execution.updateOptions({
        mode: 'teach',
        workflow: workflow,
        metadata: {
          source: 'teach_mode',
          workflowId: workflowId,
          workflowGoal: workflow.metadata.goal
        },
        debug: false
      })

      // Send immediate response that execution has started
      port.postMessage({
        type: MessageType.EXECUTE_TEACH_MODE_WORKFLOW,
        payload: {
          success: true,
          message: `Workflow execution started for "${workflow.metadata.goal}"`
        },
        id: message.id
      })

      // Run the workflow in the background (not awaited)
      // The execution will publish its own completion/failure events via PubSub
      this.execution.run(workflow.metadata.goal).catch((error) => {
        // Error handling happens inside TeachAgent which publishes execution_failed event
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logging.log('ExecutionHandler',
          `Background teach mode workflow execution failed: ${errorMessage}`, 'error')
      })

    } catch (error) {
      // This catches errors in setup, before execution starts
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler',
        `Error starting teach mode workflow: ${errorMessage}`, 'error')

      // Send error response for setup failures
      port.postMessage({
        type: MessageType.EXECUTE_TEACH_MODE_WORKFLOW,
        payload: {
          success: false,
          error: errorMessage
        },
        id: message.id
      })
    }
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

  /**
   * Handle EXTRACT_PAGE_CONTENT message
   * Extracts accessibility tree content from a tab
   */
  async handleExtractPageContent(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    // Note: We don't use the tabId from payload anymore
    // BrowserContext will find the best tab automatically

    Logging.log('ExecutionHandler', 'Extracting page content from active tab')

    const browserContext = new BrowserContext()

    try {
      // Get current page using BrowserContext's robust fallback logic
      const page = await browserContext.getCurrentPage()
      const tabId = page.tabId

      Logging.log('ExecutionHandler', `Found active tab: ${tabId}`)

      // Get hierarchical text representation
      const pageContent = await page.getHierarchicalText()

      // Send success response with the content
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          data: {
            pageContent
          }
        },
        id: message.id
      })

      Logging.logMetric('page_content_extracted', {
        tabId: tabId,
        contentLength: pageContent.length
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler',
        `Failed to extract page content: ${errorMessage}`, 'error')

      // Send error response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    } finally {
      // Always clean up the browser context
      await browserContext.cleanup()
    }
  }

}
