import { TeachModeService } from '@/lib/services/TeachModeService'
import { TeachAgent } from '@/lib/agent/TeachAgent'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { PubSub } from '@/lib/pubsub'
import { langChainProvider } from '@/lib/llm/LangChainProvider'
import { Logging } from '@/lib/utils/Logging'

/**
 * Setup teach mode handler for background script
 * Listens for pubsub messages to start/stop recording
 */
export function setupTeachModeHandler(): void {
  const teachModeService = TeachModeService.getInstance()

  // Listen for pubsub messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle teach mode messages and workflow execution
    if (!message.action?.startsWith('TEACH_MODE_') &&
        message.action !== 'GET_WORKFLOW' &&
        message.action !== 'EXECUTE_WORKFLOW') {
      return
    }

    Logging.log('teachModeHandler', `Received message: ${message.action}`)

    switch (message.action) {
      case 'TEACH_MODE_START':
        handleStartRecording(message.tabId)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true  // Keep channel open for async response

      case 'TEACH_MODE_STOP':
        handleStopRecording()
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true  // Keep channel open for async response

      case 'TEACH_MODE_STATUS':
        sendResponse({
          success: true,
          isRecording: teachModeService.isRecording(),
          tabId: teachModeService.getCurrentSession()?.getActiveTabId()
        })
        break

      // Storage management actions
      case 'TEACH_MODE_LIST':
        teachModeService.getRecordings()
          .then(recordings => sendResponse({ success: true, recordings }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_GET':
        teachModeService.getRecording(message.recordingId)
          .then(recording => sendResponse({ success: true, recording }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_DELETE':
        teachModeService.deleteRecording(message.recordingId)
          .then(result => sendResponse({ success: result }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        Logging.log('teachModeHandler', `Deleted recording: ${message.recordingId}`)
        teachModeService.deleteWorkflow(message.recordingId)
          .then(result => sendResponse({ success: result }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        Logging.log('teachModeHandler', `Deleted workflow: ${message.recordingId}`)
        return true

      case 'TEACH_MODE_CLEAR':
        teachModeService.clearAllRecordings()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_EXPORT':
        teachModeService.exportRecording(message.recordingId)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_IMPORT':
        teachModeService.importRecording(message.json, message.title)
          .then(recordingId => sendResponse({ success: true, recordingId }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_STATS':
        teachModeService.getStorageStats()
          .then(stats => sendResponse({ success: true, stats }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'TEACH_MODE_SEARCH':
        teachModeService.searchRecordings(message.query)
          .then(recordings => sendResponse({ success: true, recordings }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      // Workflow execution actions
      case 'GET_WORKFLOW':
        teachModeService.getWorkflow(message.recordingId)
          .then(workflow => sendResponse({ success: true, workflow }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      case 'EXECUTE_WORKFLOW':
        handleExecuteWorkflow(message.workflow)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true

      default:
        return
    }
  })

  // Listen for tab close events
  chrome.tabs.onRemoved.addListener((tabId) => {
    teachModeService.handleTabClosed(tabId)
  })
}

/**
 * Handle start recording request
 */
async function handleStartRecording(tabId?: number): Promise<any> {
  try {
    const teachModeService = TeachModeService.getInstance()

    // Get active tab if not specified
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        throw new Error('No active tab found')
      }
      tabId = activeTab.id
    }

    // Start recording
    await teachModeService.startRecording(tabId)

    // Get the session ID from the current session
    const session = teachModeService.getCurrentSession()
    const sessionId = session ? session.getSession().id : undefined

    return {
      success: true,
      tabId,
      sessionId,
      message: 'Recording started'
    }
  } catch (error) {
    Logging.log('teachModeHandler', `Failed to start recording: ${error}`, 'error')
    throw error
  }
}

/**
 * Handle stop recording request
 */
async function handleStopRecording(): Promise<any> {
  try {
    const teachModeService = TeachModeService.getInstance()

    // Stop recording
    const recording = await teachModeService.stopRecording()

    if (!recording) {
      return {
        success: false,
        message: 'No active recording'
      }
    }

    return {
      success: true,
      recording,
      message: `Recording stopped with ${recording.events.length} events`
    }
  } catch (error) {
    Logging.log('teachModeHandler', `Failed to stop recording: ${error}`, 'error')
    throw error
  }
}

/**
 * Handle execute workflow request
 */
async function handleExecuteWorkflow(workflow: any): Promise<any> {
  try {
    Logging.log('teachModeHandler', `Executing workflow: ${workflow.metadata.goal}`)

    // Create execution context exactly like Execution.ts
    const executionId = `teach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const browserContext = new BrowserContext()

    // Get model capabilities for proper context setup
    const modelCapabilities = await langChainProvider.getModelCapabilities()
    const messageManager = new MessageManager(modelCapabilities.maxTokens)

    // Use a dedicated pubsub channel for teach mode
    const pubsub = PubSub.getChannel(executionId)

    // Also get main channel to relay events
    const mainPubsub = PubSub.getChannel('main')

    // Relay execution events to main channel as teach-mode-events
    const relayEventsToMain = () => {
      // Subscribe to execution channel and relay to main
      pubsub.subscribe((event) => {
        if (event.type === 'message' && event.payload.role === 'thinking') {
          // Extract step info from thinking messages
          const content = event.payload.content

          if (content.includes('Executing step')) {
            const stepMatch = content.match(/Executing step (\d+) of (\d+)/)
            if (stepMatch) {
              mainPubsub.publishTeachModeEvent({
                eventType: 'execution_step_started',
                sessionId: executionId,
                data: {
                  currentStep: parseInt(stepMatch[1]),
                  totalSteps: parseInt(stepMatch[2]),
                  message: content
                }
              })
            }
          } else if (content.includes('completed successfully')) {
            mainPubsub.publishTeachModeEvent({
              eventType: 'execution_step_completed',
              sessionId: executionId,
              data: { message: content }
            })
          }
        }
      })
    }

    // Set up event relay
    relayEventsToMain()

    // Emit execution started
    mainPubsub.publishTeachModeEvent({
      eventType: 'execution_started',
      sessionId: executionId,
      data: {
        workflowId: workflow.metadata.recordingId,
        goal: workflow.metadata.goal,
        totalSteps: workflow.steps.length
      }
    })

    // Determine if limited context mode should be enabled (< 32k tokens)
    const limitedContextMode = modelCapabilities.maxTokens < 32_000

    // Create abort controller for this execution
    const abortController = new AbortController()

    const executionContext = new ExecutionContext({
      executionId: executionId,
      browserContext: browserContext,
      messageManager: messageManager,
      pubsub: pubsub,
      abortSignal: abortController.signal,
      debugMode: true,
      supportsVision: modelCapabilities.supportsImages,
      limitedContextMode: limitedContextMode,
      maxTokens: modelCapabilities.maxTokens,
    })

    // Start execution with tab 0 (like Execution.ts)
    executionContext.startExecution(0)

    // Create and execute TeachAgent
    const agent = new TeachAgent(executionContext)

    // Execute workflow and handle result
    try {
      await agent.execute(workflow)

      // Emit execution completed
      mainPubsub.publishTeachModeEvent({
        eventType: 'execution_completed',
        sessionId: executionId,
        data: {
          workflowId: workflow.metadata.recordingId,
          success: true,
          message: `Workflow "${workflow.metadata.goal}" executed successfully`
        }
      })

      return {
        success: true,
        executionId: executionId,
        message: `Workflow "${workflow.metadata.goal}" executed successfully`
      }
    } catch (execError) {
      // Emit execution failed
      mainPubsub.publishTeachModeEvent({
        eventType: 'execution_failed',
        sessionId: executionId,
        data: {
          workflowId: workflow.metadata.recordingId,
          error: execError instanceof Error ? execError.message : String(execError)
        }
      })
      throw execError
    }
  } catch (error) {
    Logging.log('teachModeHandler', `Failed to execute workflow: ${error}`, 'error')
    throw error
  }
}
