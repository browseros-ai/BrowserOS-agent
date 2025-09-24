import { MessageType, ExecuteQueryMessage, CancelTaskMessage, ResetConversationMessage } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { PubSub } from '@/lib/pubsub'
import { PortManager } from '../router/PortManager'
import { ExecutionRegistry } from './ExecutionRegistry'

const DEFAULT_EXECUTION_ID = 'main'

type ExecutionAwarePayload = Partial<ExecuteQueryMessage['payload']> & { executionId?: string }

type CancelPayload = CancelTaskMessage['payload'] & { executionId?: string }
type ResetPayload = ResetConversationMessage['payload'] & { executionId?: string }

type HumanInputResponsePayload = {
  requestId: string
  action: 'done' | 'abort'
  executionId?: string
}

/**
 * Handles execution-related messages:
 * - EXECUTE_QUERY: Start a new query execution (opens sidepanel if source is 'newtab')
 * - CANCEL_TASK: Cancel running execution
 * - RESET_CONVERSATION: Reset execution state
 */
export class ExecutionHandler {
  private readonly registry: ExecutionRegistry
  private readonly portManager?: PortManager

  constructor(portManager?: PortManager) {
    this.registry = new ExecutionRegistry()
    this.portManager = portManager
  }

  /**
   * Resolve an executionId from the payload/port context.
   */
  private resolveExecutionId(
    payload: ExecutionAwarePayload | undefined,
    port?: chrome.runtime.Port,
    fallbackTabId?: number
  ): string {
    const directId = payload?.executionId
    if (typeof directId === 'string' && directId.trim().length > 0) {
      return directId.trim()
    }

    const metadataExecutionId = (payload?.metadata as { executionId?: string } | undefined)?.executionId
    if (typeof metadataExecutionId === 'string' && metadataExecutionId.trim().length > 0) {
      return metadataExecutionId.trim()
    }

    const payloadTabId = payload?.tabIds && payload.tabIds.length > 0 ? payload.tabIds[0] : undefined
    if (typeof payloadTabId === 'number') {
      return `tab-${payloadTabId}`
    }

    if (typeof fallbackTabId === 'number') {
      return `tab-${fallbackTabId}`
    }

    const senderTabId = port?.sender?.tab?.id
    if (typeof senderTabId === 'number') {
      return `tab-${senderTabId}`
    }

    return DEFAULT_EXECUTION_ID
  }

  /**
   * Handle EXECUTE_QUERY message
   */
  async handleExecuteQuery(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    const payload = message.payload as ExecuteQueryMessage['payload'] & { executionId?: string }
    const { query, tabIds, chatMode, metadata } = payload

    const executionId = this.resolveExecutionId(payload, port)
    Logging.log('ExecutionHandler', `Resolved executionId: ${executionId} for query: "${query}"`)
    const execution = this.registry.getOrCreate(executionId)

    const primaryTabId = Array.isArray(tabIds) && tabIds.length > 0
      ? tabIds.find((id): id is number => typeof id === 'number')
      : port.sender?.tab?.id

    this.portManager?.setPortExecution(port, executionId, primaryTabId)

    Logging.log(
      'ExecutionHandler',
      `Starting execution ${executionId}: "${query}" (mode: ${chatMode ? 'chat' : 'browse'})`
    )

    Logging.logMetric('query_initiated', {
      query,
      executionId,
      source: metadata?.source || 'unknown',
      mode: chatMode ? 'chat' : 'browse',
      executionMode: metadata?.executionMode || 'dynamic'
    })

    try {
      if (execution.isRunning()) {
        Logging.log('ExecutionHandler', `Cancelling previous task for ${executionId}`)
        execution.cancel()
        // Wait a moment to ensure cancellation is processed
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      execution.updateOptions({
        mode: chatMode ? 'chat' : 'browse',
        tabIds,
        metadata,
        debug: false
      })

      if (Array.isArray(tabIds)) {
        tabIds.forEach((id) => {
          if (typeof id === 'number') {
            this.portManager?.updateExecutionForTab(id, executionId)
          }
        })
      } else if (port.sender?.tab?.id !== undefined) {
        this.portManager?.updateExecutionForTab(port.sender.tab.id, executionId)
      }

      await execution.run(query, metadata)

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          executionId
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error executing query for ${executionId}: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: errorMessage,
          executionId
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
    const payload = message.payload as CancelPayload
    const executionId = this.resolveExecutionId(payload, port)
    const hadExplicitId = typeof payload.executionId === 'string'

    Logging.log('ExecutionHandler', `Cancelling execution ${executionId}`)

    try {
      let cancelled = this.registry.cancel(executionId)

      if (!cancelled && !hadExplicitId) {
        this.registry.cancelAll()
        cancelled = true
        Logging.log('ExecutionHandler', 'No scoped execution found, cancelled all active executions', 'warning')
      }

      if (cancelled) {
        Logging.logMetric('task_cancelled', { executionId })
      }

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          message: cancelled ? 'Task cancelled' : 'No active task to cancel',
          executionId
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error cancelling execution ${executionId}: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: errorMessage,
          executionId
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
    const payload = message.payload as ResetPayload
    const executionId = this.resolveExecutionId(payload, port)
    const hadExplicitId = typeof payload.executionId === 'string'

    Logging.log('ExecutionHandler', `Resetting execution ${executionId}`)

    try {
      let reset = this.registry.reset(executionId)

      if (!reset && !hadExplicitId) {
        this.registry.resetAll()
        reset = true
        Logging.log('ExecutionHandler', 'No scoped execution found, reset all active executions', 'warning')
      }

      if (reset) {
        Logging.logMetric('conversation_reset', { executionId })
      }

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          message: reset ? 'Conversation reset' : 'No active conversation to reset',
          executionId
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler', `Error resetting execution ${executionId}: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: errorMessage,
          executionId
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
    const payload = message.payload as HumanInputResponsePayload
    const candidateId = typeof payload.executionId === 'string' && payload.executionId.trim().length > 0
      ? payload.executionId.trim()
      : DEFAULT_EXECUTION_ID

    const channelId = this.registry.has(candidateId) || PubSub.hasChannel(candidateId)
      ? candidateId
      : DEFAULT_EXECUTION_ID

    const pubsub = PubSub.getChannel(channelId)
    pubsub.publishHumanInputResponse(payload)

    Logging.log('ExecutionHandler', `Forwarded human input response to ${channelId}`)
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

    const syntheticPayload: ExecutionAwarePayload = {
      executionId: metadata?.executionId,
      tabIds: typeof tabId === 'number' ? [tabId] : undefined,
      metadata
    }
    const executionId = this.resolveExecutionId(syntheticPayload, undefined, tabId)
    const execution = this.registry.getOrCreate(executionId)

    Logging.log('ExecutionHandler',
      `Received query from newtab for tab ${tabId}: "${query}" (execution ${executionId})`)

    Logging.logMetric('query_initiated', {
      query,
      source: metadata?.source || 'newtab',
      mode: 'browse',
      executionId,
      executionMode: metadata?.executionMode || 'dynamic'
    })

    try {
      if (typeof tabId === 'number') {
        this.portManager?.updateExecutionForTab(tabId, executionId)
      }

      await chrome.sidePanel.open({ tabId })
      await new Promise(resolve => setTimeout(resolve, 200))

      chrome.runtime.sendMessage({
        type: MessageType.EXECUTION_STARTING,
        source: 'newtab',
        executionId
      }).catch(() => {
        // Sidepanel might not be ready yet; ignore
      })

      if (execution.isRunning()) {
        Logging.log('ExecutionHandler', `Cancelling previous task for ${executionId}`)
        execution.cancel()
      }

      execution.updateOptions({
        mode: 'browse',
        tabIds: typeof tabId === 'number' ? [tabId] : undefined,
        metadata,
        debug: false
      })

      await execution.run(query, metadata)

      sendResponse({ ok: true, executionId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ExecutionHandler',
        `Failed to handle newtab query for ${executionId}: ${errorMessage}`, 'error')
      sendResponse({ ok: false, error: errorMessage, executionId })
    }
  }
}

