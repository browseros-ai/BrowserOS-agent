import { PortMessage } from '@/lib/runtime/PortMessaging'
import { TeachModeService } from '@/lib/services/TeachModeService'
import { Logging } from '@/lib/utils/Logging'
import { MessageType } from '@/lib/types/messaging'

/**
 * Class-based handler for teach mode operations
 * Manages recording sessions and workflow storage
 */
export class TeachModeHandler {
  private teachModeService: TeachModeService

  constructor() {
    this.teachModeService = TeachModeService.getInstance()

    // Listen for tab close events
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.teachModeService.handleTabClosed(tabId)
    })
  }

  /**
   * Handle start recording request
   */
  async handleTeachModeStart(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { tabId } = message.payload as any
      let targetTabId = tabId

      // Get active tab if not specified
      if (!targetTabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!activeTab?.id) {
          throw new Error('No active tab found')
        }
        targetTabId = activeTab.id
      }

      // Start recording
      await this.teachModeService.startRecording(targetTabId)

      // Get the session ID from the current session
      const session = this.teachModeService.getCurrentSession()
      const sessionId = session ? session.getSession().id : undefined

      port.postMessage({
        type: MessageType.TEACH_MODE_STATUS,
        payload: {
          success: true,
          tabId: targetTabId,
          sessionId,
          message: 'Recording started'
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TeachModeHandler', `Failed to start recording: ${errorMessage}`, 'error')
      port.postMessage({
        type: MessageType.TEACH_MODE_STATUS,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle stop recording request
   */
  async handleTeachModeStop(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      // Extract audio data from payload
      const { audioData } = (message.payload as { audioData?: string }) || {}

      // Stop recording with audio data
      const recording = await this.teachModeService.stopRecording(audioData)

      if (!recording) {
        port.postMessage({
          type: MessageType.TEACH_MODE_STATUS,
          payload: {
            success: false,
            message: 'No active recording'
          },
          id: message.id
        })
        return
      }

      port.postMessage({
        type: MessageType.TEACH_MODE_STATUS,
        payload: {
          success: true,
          recording,
          message: `Recording stopped with ${recording.events.length} events`
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TeachModeHandler', `Failed to stop recording: ${errorMessage}`, 'error')
      port.postMessage({
        type: MessageType.TEACH_MODE_STATUS,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle status request
   */
  async handleTeachModeStatus(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    port.postMessage({
      type: MessageType.TEACH_MODE_STATUS,
      payload: {
        success: true,
        isRecording: this.teachModeService.isRecording(),
        tabId: this.teachModeService.getCurrentSession()?.getActiveTabId()
      },
      id: message.id
    })
  }

  /**
   * Handle list recordings request
   */
  async handleTeachModeList(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const recordings = await this.teachModeService.getRecordings()
      port.postMessage({
        type: MessageType.TEACH_MODE_LIST,
        payload: { success: true, recordings },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_LIST,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle get recording request
   */
  async handleTeachModeGet(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { recordingId } = message.payload as any
      const recording = await this.teachModeService.getRecording(recordingId)
      port.postMessage({
        type: MessageType.TEACH_MODE_GET,
        payload: { success: true, recording },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_GET,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle delete recording request
   */
  async handleTeachModeDelete(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { recordingId } = message.payload as any

      // Delete both recording and workflow
      await this.teachModeService.deleteRecording(recordingId)
      Logging.log('TeachModeHandler', `Deleted recording: ${recordingId}`)

      await this.teachModeService.deleteWorkflow(recordingId)
      Logging.log('TeachModeHandler', `Deleted workflow: ${recordingId}`)

      port.postMessage({
        type: MessageType.TEACH_MODE_DELETE,
        payload: { success: true },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_DELETE,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle clear all recordings request
   */
  async handleTeachModeClear(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      await this.teachModeService.clearAllRecordings()
      port.postMessage({
        type: MessageType.TEACH_MODE_CLEAR,
        payload: { success: true },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_CLEAR,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle export recording request
   */
  async handleTeachModeExport(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { recordingId } = message.payload as any
      await this.teachModeService.exportRecording(recordingId)
      port.postMessage({
        type: MessageType.TEACH_MODE_EXPORT,
        payload: { success: true },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_EXPORT,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle import recording request
   */
  async handleTeachModeImport(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { json, title } = message.payload as any
      const recordingId = await this.teachModeService.importRecording(json, title)
      port.postMessage({
        type: MessageType.TEACH_MODE_IMPORT,
        payload: { success: true, recordingId },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_IMPORT,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle get storage stats request
   */
  async handleTeachModeStats(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const stats = await this.teachModeService.getStorageStats()
      port.postMessage({
        type: MessageType.TEACH_MODE_STATS,
        payload: { success: true, stats },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_STATS,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle search recordings request
   */
  async handleTeachModeSearch(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { query } = message.payload as any
      const recordings = await this.teachModeService.searchRecordings(query)
      port.postMessage({
        type: MessageType.TEACH_MODE_SEARCH,
        payload: { success: true, recordings },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_SEARCH,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle get workflow request
   */
  async handleTeachModeGetWorkflow(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { recordingId } = message.payload as any
      const workflow = await this.teachModeService.getWorkflow(recordingId)
      port.postMessage({
        type: MessageType.TEACH_MODE_GET_WORKFLOW,
        payload: { success: true, workflow },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_GET_WORKFLOW,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Handle update workflow request
   */
  async handleTeachModeUpdateWorkflow(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { recordingId, updates } = message.payload as any
      const success = await this.teachModeService.updateWorkflow(recordingId, updates)
      port.postMessage({
        type: MessageType.TEACH_MODE_UPDATE_WORKFLOW,
        payload: { success },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.TEACH_MODE_UPDATE_WORKFLOW,
        payload: { success: false, error: errorMessage },
        id: message.id
      })
    }
  }
}