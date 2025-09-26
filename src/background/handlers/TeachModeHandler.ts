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
        handleStartRecording(message.tabId, message.options)
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

      case 'TEACH_MODE_SET_VOICE_DATA':
        try {
          teachModeService.setVoiceData(message.voiceData)
          sendResponse({ success: true })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          sendResponse({ success: false, error: errorMessage })
        }
        return true

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
async function handleStartRecording(tabId?: number, options?: { captureVoice?: boolean }): Promise<any> {
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

    // Start recording with options
    await teachModeService.startRecording(tabId, options)

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
    const executionId = PubSub.generateId('teach')
    const browserContext = new BrowserContext()

    // Get model capabilities for proper context setup
    const modelCapabilities = await langChainProvider.getModelCapabilities()
    const messageManager = new MessageManager(modelCapabilities.maxTokens)

    // Always use the main channel for teach mode
    const pubsub = PubSub.getChannel('main')

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

      return {
        success: true,
        executionId: executionId,
        message: `Workflow "${workflow.metadata.goal}" executed successfully`
      }
    } catch (execError) {
      throw execError
    }
  } catch (error) {
    Logging.log('teachModeHandler', `Failed to execute workflow: ${error}`, 'error')
    throw error
  }
}
