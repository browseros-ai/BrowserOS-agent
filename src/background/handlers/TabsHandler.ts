import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { ExecutionManager } from '@/lib/execution/ExecutionManager'

/**
 * Handles tab-related messages:
 * - GET_ACTIVE_TAB: Get current active tab
 * - GET_ALL_TABS: Get all open tabs
 * - UPDATE_TABS: Update tab selection for execution
 * - FOCUS_TAB: Focus a specific tab
 * - CLOSE_TAB: Close a tab
 */
export class TabsHandler {
  private executionManager: ExecutionManager

  constructor() {
    this.executionManager = ExecutionManager.getInstance()
  }

  /**
   * Handle GET_ACTIVE_TAB message
   */
  async handleGetActiveTab(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const [activeTab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      })
      
      if (!activeTab) {
        throw new Error('No active tab found')
      }
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { 
            tab: {
              id: activeTab.id,
              url: activeTab.url,
              title: activeTab.title,
              active: true
            }
          }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TabsHandler', `Error getting active tab: ${errorMessage}`, 'error')
      
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
   * Handle GET_ALL_TABS message
   */
  async handleGetAllTabs(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true })
      
      const tabData = tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        index: tab.index
      }))
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { tabs: tabData }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TabsHandler', `Error getting all tabs: ${errorMessage}`, 'error')
      
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
   * Handle UPDATE_TABS message - Update selected tabs for an execution
   */
  handleUpdateTabs(
    message: PortMessage,
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    try {
      const { tabIds } = message.payload as { tabIds: number[] }
      const execId = executionId || 'default'
      
      // Get execution and update its tab context
      const execution = this.executionManager.get(execId)
      if (execution) {
        // Update execution's tab IDs
        execution.updateTabIds(tabIds)
        
        Logging.log('TabsHandler', 
          `Updated tabs for execution ${execId}: [${tabIds.join(', ')}]`)
      } else {
        // Store for future execution creation
        Logging.log('TabsHandler', 
          `Stored tab selection for future execution ${execId}: [${tabIds.join(', ')}]`)
      }
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: `Tab selection updated`,
          executionId: execId
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TabsHandler', `Error updating tabs: ${errorMessage}`, 'error')
      
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
   * Handle FOCUS_TAB message
   */
  async handleFocusTab(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { tabId } = message.payload as { tabId: number }
      
      // Update tab to be active
      await chrome.tabs.update(tabId, { active: true })
      
      // Get the tab's window and focus it
      const tab = await chrome.tabs.get(tabId)
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true })
      }
      
      Logging.log('TabsHandler', `Focused tab ${tabId}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: `Tab ${tabId} focused`
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TabsHandler', `Error focusing tab: ${errorMessage}`, 'error')
      
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
   * Handle CLOSE_TAB message
   */
  async handleCloseTab(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { tabId } = message.payload as { tabId: number }
      
      await chrome.tabs.remove(tabId)
      
      Logging.log('TabsHandler', `Closed tab ${tabId}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: `Tab ${tabId} closed`
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('TabsHandler', `Error closing tab: ${errorMessage}`, 'error')
      
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
   * Get statistics
   */
  async getStats(): Promise<any> {
    const tabs = await chrome.tabs.query({})
    return {
      totalTabs: tabs.length,
      activeTabs: tabs.filter(t => t.active).length,
      windowCount: new Set(tabs.map(t => t.windowId)).size
    }
  }
}