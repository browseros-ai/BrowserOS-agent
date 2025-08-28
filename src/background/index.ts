import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { isDevelopmentMode } from '@/config'

// Import router and managers
import { MessageRouter } from './router/MessageRouter'
import { PortManager } from './router/PortManager'

// Import handlers
import { ExecutionHandler } from './handlers/ExecutionHandler'
import { ProvidersHandler } from './handlers/ProvidersHandler'
import { MCPHandler } from './handlers/MCPHandler'
import { TabsHandler } from './handlers/TabsHandler'
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
const tabsHandler = new TabsHandler()
const planHandler = new PlanHandler()

// Side panel state
let isPanelOpen = false
let isToggling = false

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
  
  // Tab handlers
  messageRouter.registerHandler(
    MessageType.GET_ACTIVE_TAB,
    (msg, port) => tabsHandler.handleGetActiveTab(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.GET_ALL_TABS,
    (msg, port) => tabsHandler.handleGetAllTabs(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.UPDATE_TABS,
    (msg, port, execId) => tabsHandler.handleUpdateTabs(msg, port, execId)
  )
  
  messageRouter.registerHandler(
    MessageType.FOCUS_TAB,
    (msg, port) => tabsHandler.handleFocusTab(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.CLOSE_TAB,
    (msg, port) => tabsHandler.handleCloseTab(msg, port)
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
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.windowId) {
          // Use chrome.sidePanel API to close
          // Note: There's no direct close API, so we rely on the panel closing itself
          port.postMessage({
            type: MessageType.WORKFLOW_STATUS,
            payload: { status: 'success', message: 'Panel closing' },
            id: msg.id
          })
        }
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
  
  // Update panel state for sidepanel connections
  if (port.name.startsWith('sidepanel')) {
    isPanelOpen = true
    Logging.log('Background', 'Side panel connected')
    Logging.logMetric('side_panel_opened', { source: 'port_connection' })
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
    
    // Update panel state
    if (port.name.startsWith('sidepanel')) {
      isPanelOpen = false
      Logging.log('Background', 'Side panel disconnected')
      Logging.logMetric('side_panel_closed', { source: 'port_disconnection' })
    }
    
    // Unregister from logging
    Logging.unregisterPort(port.name)
  })
}

/**
 * Toggle the side panel
 */
async function toggleSidePanel(tabId: number): Promise<void> {
  if (isToggling) return
  
  isToggling = true
  
  try {
    if (isPanelOpen) {
      // Send close message to panel
      const ports = Array.from(portManager.getExecutionPorts('default'))
      for (const port of ports) {
        if (port.name.startsWith('sidepanel')) {
          port.postMessage({
            type: MessageType.CLOSE_PANEL,
            payload: { reason: 'toggle' }
          })
        }
      }
    } else {
      // Open the panel
      await chrome.sidePanel.open({ tabId })
      Logging.logMetric('side_panel_toggled', {})
    }
  } catch (error) {
    Logging.log('Background', `Error toggling side panel: ${error}`, 'error')
    
    // Try fallback with windowId
    if (!isPanelOpen) {
      try {
        const window = await chrome.windows.getCurrent()
        if (window.id) {
          await chrome.sidePanel.open({ windowId: window.id })
        }
      } catch (fallbackError) {
        Logging.log('Background', `Fallback failed: ${fallbackError}`, 'error')
      }
    }
  } finally {
    // Reset toggle flag
    setTimeout(() => {
      isToggling = false
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
  chrome.tabs.onRemoved.addListener((tabId) => {
    // Handlers can clean up tab-specific resources
    Logging.log('Background', `Tab ${tabId} removed`)
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
      tabs: tabsHandler,
      plan: planHandler
    }
  }
}