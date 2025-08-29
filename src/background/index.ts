import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { isDevelopmentMode } from '@/config'
import { parsePortName } from '@/lib/utils/portUtils'

// Import router and managers
import { MessageRouter } from './router/MessageRouter'
import { PortManager } from './router/PortManager'

// Import handlers
import { ExecutionHandler } from './handlers/ExecutionHandler'
import { ProvidersHandler } from './handlers/ProvidersHandler'
import { MCPHandler } from './handlers/MCPHandler'
import { PlanHandler } from './handlers/PlanHandler'

/**
 * Background script for the Nxtscape extension
 * 
 * This is now a thin orchestration layer that:
 * 1. Sets up message routing
 * 2. Registers handlers for different message types
 * 3. Manages port connections
 */

// Initialize logging
Logging.initialize({ debugMode: isDevelopmentMode() })

// Create router and port manager
const messageRouter = new MessageRouter()
const portManager = new PortManager()

// Create handler instances
const executionHandler = new ExecutionHandler()
const providersHandler = new ProvidersHandler()
const mcpHandler = new MCPHandler()
const planHandler = new PlanHandler()

// Side panel state per tab
const tabPanelState = new Map<number, { isOpen: boolean; isToggling: boolean }>()
// Port to tab ID mapping
const portToTabMap = new Map<chrome.runtime.Port, number>()

/**
 * Register all message handlers with the router
 */
function registerHandlers(): void {
  // Execution handlers
  messageRouter.registerHandler(
    MessageType.EXECUTE_QUERY,
    (msg, port, execId) => executionHandler.handleExecuteQuery(msg, port, execId)
  )
  
  messageRouter.registerHandler(
    MessageType.CANCEL_TASK,
    (msg, port, execId) => executionHandler.handleCancelTask(msg, port, execId)
  )
  
  messageRouter.registerHandler(
    MessageType.RESET_CONVERSATION,
    (msg, port, execId) => executionHandler.handleResetConversation(msg, port, execId)
  )

  messageRouter.registerHandler(
    MessageType.HUMAN_INPUT_RESPONSE,
    (msg, port, execId) => executionHandler.handleHumanInputResponse(msg, port, execId)
  )
  
  // Provider handlers
  messageRouter.registerHandler(
    MessageType.GET_LLM_PROVIDERS,
    (msg, port) => providersHandler.handleGetProviders(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.SAVE_LLM_PROVIDERS,
    (msg, port) => providersHandler.handleSaveProviders(msg, port)
  )
  
  // MCP handlers
  messageRouter.registerHandler(
    MessageType.GET_MCP_SERVERS,
    (msg, port) => mcpHandler.handleGetMCPServers(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.CONNECT_MCP_SERVER,
    (msg, port) => mcpHandler.handleConnectMCPServer(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.DISCONNECT_MCP_SERVER,
    (msg, port) => mcpHandler.handleDisconnectMCPServer(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.CALL_MCP_TOOL,
    (msg, port) => mcpHandler.handleCallMCPTool(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.MCP_INSTALL_SERVER,
    (msg, port) => mcpHandler.handleInstallServer(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.MCP_DELETE_SERVER,
    (msg, port) => mcpHandler.handleDeleteServer(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.MCP_GET_INSTALLED_SERVERS,
    (msg, port) => mcpHandler.handleGetInstalledServers(msg, port)
  )
  
  
  // Plan handlers
  messageRouter.registerHandler(
    MessageType.GET_CURRENT_PLAN,
    (msg, port, execId) => planHandler.handleGetCurrentPlan(msg, port, execId)
  )
  
  messageRouter.registerHandler(
    MessageType.UPDATE_PLAN,
    (msg, port, execId) => planHandler.handleUpdatePlan(msg, port, execId)
  )
  
  messageRouter.registerHandler(
    MessageType.GET_PLAN_HISTORY,
    (msg, port, execId) => planHandler.handleGetPlanHistory(msg, port, execId)
  )
  
  // Log handler
  messageRouter.registerHandler(
    MessageType.LOG_MESSAGE,
    (msg, port) => {
      const logMsg = msg.payload as any
      Logging.log(logMsg.source || 'Unknown', logMsg.message, logMsg.level || 'info')
    }
  )
  
  // Metrics handler
  messageRouter.registerHandler(
    MessageType.LOG_METRIC,
    (msg, port) => {
      const { event, properties } = msg.payload as any
      Logging.logMetric(event, properties)
    }
  )
  
  // Heartbeat handler - acknowledge heartbeats to keep connection alive
  messageRouter.registerHandler(
    MessageType.HEARTBEAT,
    (msg, port) => {
      // Send heartbeat acknowledgment back
      port.postMessage({
        type: MessageType.HEARTBEAT_ACK,
        payload: { timestamp: Date.now() },
        id: msg.id
      })
    }
  )
  
  // Panel close handler
  messageRouter.registerHandler(
    MessageType.CLOSE_PANEL,
    async (msg, port) => {
      // Close the side panel
      try {
        const tabId = portToTabMap.get(port)
        if (tabId) {
          // Update state for specific tab
          const state = tabPanelState.get(tabId)
          if (state) {
            state.isOpen = false
          }
        }
        
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'success', message: 'Panel closing' },
          id: msg.id
        })
      } catch (error) {
        Logging.log('Background', `Error closing panel: ${error}`, 'error')
      }
    }
  )
  
  Logging.log('Background', 'All message handlers registered')
}

/**
 * Handle port connections
 */
function handlePortConnection(port: chrome.runtime.Port): void {
  const portId = portManager.registerPort(port)
  
  // Handle sidepanel connections with tab ID in port name
  const portInfo = parsePortName(port.name)
  if (portInfo.type === 'sidepanel' && portInfo.tabId) {
    const tabId = portInfo.tabId
    
    // Store the port-to-tab mapping
    portToTabMap.set(port, tabId)
    
    // Update panel state for this tab
    tabPanelState.set(tabId, { isOpen: true, isToggling: false })
    
    Logging.log('Background', `Side panel connected for tab ${tabId} with port name: ${port.name}`)
    Logging.logMetric('side_panel_opened', { source: 'port_connection', tabId })
  } else if (portInfo.type === 'sidepanel') {
    Logging.log('Background', `Side panel connected but no tab ID in port name: ${port.name}`)
  }
  
  // Register with logging system
  Logging.registerPort(port.name, port)
  
  // Set up message listener
  port.onMessage.addListener((message: PortMessage) => {
    messageRouter.routeMessage(message, port)
  })
  
  // Set up disconnect listener
  port.onDisconnect.addListener(() => {
    portManager.unregisterPort(port)
    
    // Clean up tab-specific state
    const tabId = portToTabMap.get(port)
    if (tabId) {
      // Remove from port-to-tab mapping
      portToTabMap.delete(port)
      
      // Update panel state
      const state = tabPanelState.get(tabId)
      if (state) {
        state.isOpen = false
      }
      
      Logging.log('Background', `Side panel disconnected for tab ${tabId}`)
      Logging.logMetric('side_panel_closed', { source: 'port_disconnection', tabId })
    }
    
    // Unregister from logging
    Logging.unregisterPort(port.name)
  })
}

/**
 * Toggle the side panel for a specific tab
 */
async function toggleSidePanel(tabId: number): Promise<void> {
  // Get or create state for this tab
  let state = tabPanelState.get(tabId)
  if (!state) {
    state = { isOpen: false, isToggling: false }
    tabPanelState.set(tabId, state)
  }
  
  if (state.isToggling) return
  
  state.isToggling = true
  
  try {
    if (state.isOpen) {
      // Find and close the panel for this specific tab
      for (const [port, mappedTabId] of portToTabMap.entries()) {
        if (mappedTabId === tabId) {
          port.postMessage({
            type: MessageType.CLOSE_PANEL,
            payload: { reason: 'toggle', tabId }
          })
          break
        }
      }
      state.isOpen = false
    } else {
      // Open the panel for this tab
      await chrome.sidePanel.open({ tabId })
      state.isOpen = true
      Logging.logMetric('side_panel_toggled', { tabId })
    }
  } catch (error) {
    Logging.log('Background', `Error toggling side panel for tab ${tabId}: ${error}`, 'error')
    
    // Try fallback with windowId
    if (!state.isOpen) {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (tab.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId })
          state.isOpen = true
        }
      } catch (fallbackError) {
        Logging.log('Background', `Fallback failed for tab ${tabId}: ${fallbackError}`, 'error')
      }
    }
  } finally {
    // Reset toggle flag
    setTimeout(() => {
      const currentState = tabPanelState.get(tabId)
      if (currentState) {
        currentState.isToggling = false
      }
    }, 300)
  }
}

/**
 * Initialize the extension
 */
function initialize(): void {
  Logging.log('Background', 'Nxtscape extension initializing')
  Logging.logMetric('extension_initialized')
  
  // Register all handlers
  registerHandlers()
  
  // Set up port connection listener
  chrome.runtime.onConnect.addListener(handlePortConnection)
  
  // Set up extension icon click handler
  chrome.action.onClicked.addListener(async (tab) => {
    Logging.log('Background', 'Extension icon clicked')
    if (tab.id) {
      await toggleSidePanel(tab.id)
    }
  })
  
  // Set up keyboard shortcut handler
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-panel') {
      Logging.log('Background', 'Toggle panel shortcut triggered (Cmd+E/Ctrl+E)')
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (activeTab?.id) {
        await toggleSidePanel(activeTab.id)
      }
    }
  })
  
  // Clean up on tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    // Clean up tab-specific panel state
    tabPanelState.delete(tabId)
    
    // Clean up tab execution
    await executionHandler.cleanupTabExecution(tabId)
    
    Logging.log('Background', `Tab ${tabId} removed, cleaned up panel state and execution`)
  })
  
  Logging.log('Background', 'Nxtscape extension initialized successfully')
}

// Initialize the extension
initialize()

// Export for debugging
if (isDevelopmentMode()) {
  (globalThis as any).__nxtscape = {
    router: messageRouter,
    portManager,
    handlers: {
      execution: executionHandler,
      providers: providersHandler,
      mcp: mcpHandler,
      plan: planHandler
    }
  }
}