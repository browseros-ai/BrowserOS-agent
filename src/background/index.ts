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

// Simple panel state for singleton
let isPanelOpen = false
let isPanelToggling = false

/**
 * Register all message handlers with the router
 */
function registerHandlers(): void {
  // Execution handlers
  messageRouter.registerHandler(
    MessageType.EXECUTE_QUERY,
    (msg, port) => executionHandler.handleExecuteQuery(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.CANCEL_TASK,
    (msg, port) => executionHandler.handleCancelTask(msg, port)
  )
  
  messageRouter.registerHandler(
    MessageType.RESET_CONVERSATION,
    (msg, port) => executionHandler.handleResetConversation(msg, port)
  )

  messageRouter.registerHandler(
    MessageType.HUMAN_INPUT_RESPONSE,
    (msg, port) => executionHandler.handleHumanInputResponse(msg, port)
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
  
  
  // Plan generation handlers (for AI plan generation in newtab)
  messageRouter.registerHandler(
    MessageType.GENERATE_PLAN,
    (msg, port) => planHandler.handleGeneratePlan(msg, port)
  )

  messageRouter.registerHandler(
    MessageType.REFINE_PLAN,
    (msg, port) => planHandler.handleRefinePlan(msg, port)
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
      try {
        isPanelOpen = false
        
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
  
  // Handle sidepanel connections
  if (port.name === 'sidepanel') {
    isPanelOpen = true
    Logging.log('Background', `Side panel connected`)
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
    
    // Update panel state if this was the sidepanel
    if (port.name === 'sidepanel') {
      isPanelOpen = false
      Logging.log('Background', `Side panel disconnected`)
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
  if (isPanelToggling) return
  
  isPanelToggling = true
  
  try {
    if (isPanelOpen) {
      // Panel is open, close it (browser handles this)
      isPanelOpen = false
      Logging.log('Background', 'Panel toggled off')
    } else {
      // Open the panel for this tab
      await chrome.sidePanel.open({ tabId })
      isPanelOpen = true
      Logging.log('Background', 'Panel toggled on')
      Logging.logMetric('side_panel_toggled')
    }
  } catch (error) {
    Logging.log('Background', `Error toggling side panel: ${error}`, 'error')
    
    // Try fallback with windowId
    if (!isPanelOpen) {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (tab.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId })
          isPanelOpen = true
        }
      } catch (fallbackError) {
        Logging.log('Background', `Fallback failed: ${fallbackError}`, 'error')
      }
    }
  } finally {
    // Reset toggle flag
    setTimeout(() => {
      isPanelToggling = false
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
    // With singleton execution, just log the tab removal
    Logging.log('Background', `Tab ${tabId} removed`)
  })
  
  // Handle messages from newtab
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEWTAB_EXECUTE_QUERY') {
      executionHandler.handleNewtabQuery(message, sendResponse)
      return true  // Keep message channel open for async response
    }
  })
  
  Logging.log('Background', 'Nxtscape extension initialized successfully')
}

// Initialize the extension
initialize()

