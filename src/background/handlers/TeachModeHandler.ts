import { TeachModeService } from '@/lib/services/TeachModeService'
import { Logging } from '@/lib/utils/Logging'

/**
 * Setup teach mode handler for background script
 * Listens for pubsub messages to start/stop recording
 */
export function setupTeachModeHandler(): void {
  const teachModeService = TeachModeService.getInstance()

  // Listen for pubsub messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle teach mode messages
    if (!message.action?.startsWith('TEACH_MODE_')) {
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
          tabId: teachModeService.getCurrentSession()?.getTabId()
        })
        break

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

    return {
      success: true,
      tabId,
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
