import { MessageType, LogMessage, ExecuteQueryMessage, AgentStreamUpdateMessage, CancelTaskMessage, ResetConversationMessage, GetTabsMessage } from '@/lib/types/messaging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { langChainProvider } from '@/lib/llm/LangChainProvider'
import { BrowserOSProvidersConfigSchema, BROWSEROS_PREFERENCE_KEYS } from '@/lib/llm/settings/browserOSTypes'
import { PortName, PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { NxtScape } from '@/lib/core/NxtScape'
import { isDevelopmentMode } from '@/config'
import { GlowAnimationService } from '@/lib/services/GlowAnimationService'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'
import { MCP_SERVERS } from '@/config/mcpServers'
import { PubSub, PubSubEvent } from '@/lib/pubsub'

/**
 * Background script for the ParallelManus extension
 */

// Initialize LogUtility first
Logging.initialize({ debugMode: isDevelopmentMode() })

// Initialize NxtScape agent with Claude
const nxtScape = new NxtScape({
  debug: isDevelopmentMode()
})

// Global initialization flag to ensure we only initialize once
let isNxtScapeInitialized = false


/**
 * Ensure NxtScape is initialized only once globally
 */
async function ensureNxtScapeInitialized(): Promise<void> {
  if (!isNxtScapeInitialized) {
    await nxtScape.initialize()
    isNxtScapeInitialized = true
    debugLog('NxtScape initialized successfully')
  }
}


/**
 * Log messages using the centralized LogUtility
 * @param message - Message to log
 * @param level - Log level
 */
function debugLog(message: string, level: 'info' | 'error' | 'warning' = 'info'): void {
  Logging.log('Background', message, level)
}

// Active tabs map (tabId -> information)
const activeTabs = new Map<number, { url: string }>()

// Navigation history tracking (tabId -> array of navigation entries)
const tabHistory = new Map<number, Array<{
  url: string
  title: string
  timestamp: number
}>>()

// Connected ports (name -> port)  
const connectedPorts = new Map<string, chrome.runtime.Port>();

// Side panel state tracking
let isPanelOpen = false;
let isToggling = false; // Prevent rapid toggle issues
let providersPollIntervalId: number | null = null
let lastProvidersConfigJson: string | null = null



// Get the GlowAnimationService instance
const glowService = GlowAnimationService.getInstance()

// Get PubSub instance and set up forwarding
const pubsub = PubSub.getInstance()

// Subscribe to PubSub events and forward to sidepanel
pubsub.subscribe((event: PubSubEvent) => {
  // Forward to all connected sidepanels
  for (const [name, port] of connectedPorts) {
    if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
      try {
        port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: {
            step: 0,
            action: 'PUBSUB_EVENT',
            status: 'executing',
            details: event
          }
        })
      } catch (error) {
        debugLog(`Failed to forward PubSub event to ${name}: ${error}`, 'warning')
      }
    }
  }
})

// Initialize the extension
function initialize(): void {
  debugLog('ParallelManus extension initialized')
  
  // Log extension initialization metric
  Logging.logMetric('extension_initialized')
  
  // Initialize NxtScape once at startup to preserve conversation across queries
  ensureNxtScapeInitialized().catch(error => {
    debugLog(`Failed to initialize NxtScape at startup: ${error}`, 'error')
  })
  
  
  // Register port connection listener (port-based messaging only)
  chrome.runtime.onConnect.addListener(handlePortConnection)
  
  // Register tab removal listener for glow cleanup
  chrome.tabs.onRemoved.addListener((tabId) => {
    glowService.handleTabClosed(tabId)
  })
  
  // Listen for provider changes saved to chrome.storage.local (Chromium settings)
  try {
    chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local') return
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
      const change = changes[key]
      if (!change) return
      try {
        const raw = typeof change.newValue === 'string' ? JSON.parse(change.newValue) : change.newValue
        const config = BrowserOSProvidersConfigSchema.parse(raw)
        lastProvidersConfigJson = JSON.stringify(config)
        try { langChainProvider.clearCache() } catch (_) {}
        broadcastProvidersConfig(config)
      } catch (_e) {
        // Ignore parse/validation errors
      }
    })
  } catch (_e) {
    // storage.onChanged may not be available in all contexts
  }
  
  
  // Register action click listener to toggle side panel
  chrome.action.onClicked.addListener(async (tab) => {
    debugLog('Extension icon clicked, toggling side panel')
    
    try {
      // Toggle the side panel for the current tab
      if (tab.id) {
        await toggleSidePanel(tab.id)
      } else {
        // No active tab found for side panel
      }
    } catch (error) {
      debugLog(`Error toggling side panel: ${error instanceof Error ? error.message : String(error)}`, 'error')
      // Log error if side panel fails
      debugLog('Side panel failed to open', 'error')
    }
  })
  
  // Register keyboard shortcut listener
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-panel') {
      debugLog('Toggle panel keyboard shortcut triggered (Cmd+E/Ctrl+E)')
      
      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      if (activeTab?.id) {
        await toggleSidePanel(activeTab.id)
      } else {
        // No active tab found for keyboard shortcut
      }
    }
  })
  
}

/**
 * Toggle the side panel for a specific tab with debouncing
 * @param tabId - The tab ID to toggle the panel for
 */
async function toggleSidePanel(tabId: number): Promise<void> {
  // Prevent rapid toggling
  if (isToggling) {
    // Toggle already in progress
    return
  }
  
  isToggling = true
  
  try {
    if (isPanelOpen) {
      // Panel is open, send close message
      // Sending close message to side panel
      
      const sidePanelPort = connectedPorts.get(PortName.SIDEPANEL_TO_BACKGROUND)
      if (sidePanelPort) {
        sidePanelPort.postMessage({
          type: MessageType.CLOSE_PANEL,
          payload: {
            reason: 'Keyboard shortcut toggle'
          }
        })
        
        // The panel will close itself and update isPanelOpen via disconnect handler
      } else {
        // Side panel port not found
      }
    } else {
      // Panel is closed, open it
      // Opening side panel
      
      await chrome.sidePanel.open({ tabId })

      // Log panel opened via toggle metric
      Logging.logMetric('side_panel_toggled', {})
      
      
      // State will be updated when the panel connects
      // Side panel open command sent
    }
  } catch (error) {
    debugLog(`Error toggling side panel: ${error instanceof Error ? error.message : String(error)}`, 'error')
    
    // Try opening without tab ID as fallback
    if (!isPanelOpen) {
      try {
        // Get the current window ID
        const window = await chrome.windows.getCurrent()
        if (window.id) {
          await chrome.sidePanel.open({ windowId: window.id })
          // Side panel opened with window ID as fallback
        }
      } catch (fallbackError) {
        debugLog(`Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`, 'error')
      }
    }
  } finally {
    // Reset toggle flag after a short delay to prevent rapid toggling
    setTimeout(() => {
      isToggling = false
    }, 300) // 300ms debounce
  }
}

/**
 * Handles port connections
 * @param port - Port that connected
 */
function handlePortConnection(port: chrome.runtime.Port): void {
  const portName = port.name;
  // Port connected
  
  // Store the port
  connectedPorts.set(portName, port);
  
  // Update panel state if side panel connected
  if (portName === PortName.SIDEPANEL_TO_BACKGROUND) {
    isPanelOpen = true
    debugLog('Side panel connected, updating state')
    Logging.logMetric('side_panel_opened', {
      source: 'port_connection'
    })
    // Kick a fetch and start polling for external changes
    startProvidersPolling()
  }
  
  // Register the port with LogUtility for centralized logging
  Logging.registerPort(portName, port);
  
  // Set up port message listener
  port.onMessage.addListener((message: PortMessage, port: chrome.runtime.Port) => {
    handlePortMessage(message, port);
  });
  
  // Set up disconnect listener
  port.onDisconnect.addListener(() => {
    // Port disconnected
    connectedPorts.delete(portName);
    
    // Update panel state if side panel disconnected
    if (portName === PortName.SIDEPANEL_TO_BACKGROUND) {
      isPanelOpen = false
      debugLog('Side panel disconnected, updating state')
      Logging.logMetric('side_panel_closed', {
        source: 'port_disconnection'
      })
      stopProvidersPolling()
    }
    
    // Unregister the port from LogUtility
    Logging.unregisterPort(portName);
  });
}

/**
 * Handles messages received via port
 * @param message - The message received
 * @param port - The port that sent the message
 */
function handlePortMessage(message: PortMessage, port: chrome.runtime.Port): void {
  try {
    const { type, payload, id } = message
    // Port message received (non-heartbeat)
    
    if (type === MessageType.EXECUTE_QUERY) {
      debugLog(`🎯 EXECUTE_QUERY received from ${port.name}`)
    }
    
    switch (type as MessageType) {
      case MessageType.LOG:
        handleLogMessage(payload as LogMessage['payload'])
        break
        
      case MessageType.EXECUTE_QUERY:
        handleExecuteQueryPort(payload as ExecuteQueryMessage['payload'], port, id)
        break
        
        
      case MessageType.HEARTBEAT:
        handleHeartbeatMessage(payload as { timestamp: number }, port)
        break
        
      case MessageType.CANCEL_TASK:
        handleCancelTaskPort(payload as CancelTaskMessage['payload'], port, id)
        break
        
      case MessageType.RESET_CONVERSATION:
        handleResetConversationPort(payload as ResetConversationMessage['payload'], port, id)
        break
        
      case MessageType.GET_TABS:
        // GET_TABS message received
        handleGetTabsPort(payload as GetTabsMessage['payload'], port, id)
        break

      case MessageType.GET_LLM_PROVIDERS:
        handleGetLlmProvidersPort(port, id)
        break

      case MessageType.SAVE_LLM_PROVIDERS:
        handleSaveLlmProvidersPort(payload, port, id)
        break
        
      case MessageType.GET_TAB_HISTORY:
        // GET_TAB_HISTORY not used anymore
        break
        
      case MessageType.AGENT_STREAM_UPDATE:
        // This is an outgoing message type, not incoming
        // Received AGENT_STREAM_UPDATE (shouldn't happen)
        break
        
      case MessageType.GLOW_START:
        handleGlowStartPort(payload as { tabId: number }, port, id)
        break
        
      case MessageType.GLOW_STOP:
        handleGlowStopPort(payload as { tabId: number }, port, id)
        break
      
      case MessageType.MCP_INSTALL_SERVER:
        handleMCPInstallServerPort(payload as { serverId: string }, port, id)
        break
        
      default:
        // Unknown port message type
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { error: `Unknown message type: ${type}` },
          id
        })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling port message: ${errorMessage}`, 'error')
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      id: message.id,
      payload: { error: errorMessage }
    })
  }
}

/**
 * Handles log messages
 * @param payload - Log message payload
 */
function handleLogMessage(payload: LogMessage['payload']): void {
  const { source, message, level = 'info' } = payload;
  // Forward log message from other components
}

/**
 * Helper function to determine status from action string
 */
function getStatusFromAction(action: string): 'thinking' | 'executing' | 'completed' | 'error' {
  if (action.includes('Error') || action.includes('Failed')) {
    return 'error'
  } else if (action.includes('Thinking') || action.includes('Processing')) {
    return 'thinking'
  } else if (action.includes('Executing')) {
    return 'executing'
  } else {
    return 'executing'
  }
}


/**
 * Handles query execution from port messages
 * @param payload - Query execution payload
 * @param port - Port that sent the message  
 * @param id - Message ID for response tracking
 */
async function handleExecuteQueryPort(
  payload: { query: string; tabIds?: number[]; source?: string; chatMode?: boolean },
  port: chrome.runtime.Port,
  id?: string
): Promise<void> {
  try {
    // Enhanced debug logging
    debugLog(`🎯 [Background] Received query execution from ${payload.source || 'unknown'}`)
    
    Logging.logMetric('query_initiated', {
      query: payload.query,
      source: payload.source || 'unknown',
      mode: payload.chatMode ? 'chat' : 'browse',
    })
    
    // Initialize NxtScape if not already done
    await ensureNxtScapeInitialized()
    
    // Note: We now pass mode explicitly to run(), but keep setChatMode for backward compatibility
    if (payload.chatMode !== undefined) {
      nxtScape.setChatMode(payload.chatMode)  // Keep for any ExecutionContext dependencies
      debugLog(`Mode set to ${payload.chatMode ? 'chat' : 'browse'} for this query`)
    }
    // Clear previous messages when starting new execution
    pubsub.clearBuffer()
    
    // Execute the query using NxtScape
    // Starting NxtScape execution
    
    await nxtScape.run({
      query: payload.query,
      mode: payload.chatMode ? 'chat' : 'browse',  // Convert boolean to explicit mode
      tabIds: payload.tabIds,
    })
    
    // NxtScape execution completed - all messaging handled via PubSub
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`[Background] Error executing query: ${errorMessage}`, 'error')
  }
}


// Broadcast latest providers config to all connected UIs
function broadcastProvidersConfig(config: unknown): void {
  for (const [name, port] of connectedPorts) {
    if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
      try {
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'success', data: { providersConfig: config } }
        })
      } catch (error) {
        debugLog(`Failed to broadcast providers config to ${name}: ${error}`, 'warning')
      }
    }
  }
}


/**
 * Handles heartbeat messages to keep port connection alive
 * @param payload - Heartbeat payload with timestamp
 * @param port - Port to send acknowledgment through
 */
function handleHeartbeatMessage(payload: { timestamp: number }, port: chrome.runtime.Port): void {
  // Send heartbeat acknowledgment back to keep connection alive
  port.postMessage({
    type: MessageType.HEARTBEAT_ACK,
    payload: { timestamp: payload.timestamp }
  })
}

/**
 * Handles conversation reset requests via port messaging
 * @param payload - Reset conversation payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleResetConversationPort(
  payload: ResetConversationMessage['payload'],
  port: chrome.runtime.Port,
  id?: string
): void {
  try {
    nxtScape.reset()
    Logging.logMetric('conversation_reset')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling conversation reset: ${errorMessage}`, 'error')
  }
}

/**
 * Handles GET_TABS requests to fetch browser tabs via port messaging
 * @param payload - Get tabs payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleGetTabsPort(
  payload: GetTabsMessage['payload'],
  port: chrome.runtime.Port,
  id?: string
): void {
  try {
    const { currentWindowOnly = true } = payload
    
    // Getting tabs
    
    // Query tabs based on the currentWindowOnly flag
    const queryOptions: chrome.tabs.QueryInfo = currentWindowOnly 
      ? { currentWindow: true }
      : {}
    
    chrome.tabs.query(queryOptions, (tabs) => {
      // Filter to only HTTP/HTTPS tabs as these are the ones we can interact with
      const httpTabs = tabs.filter(tab => 
        tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
      )
      
      // Found HTTP/HTTPS tabs
      
      // Map tabs to a simplified format for the frontend
      const tabData = httpTabs.map(tab => ({
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || null,
        active: tab.active || false,
        pinned: tab.pinned || false,
        windowId: tab.windowId
      }))
      
      // Send success response with tab data
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          data: {
            tabs: tabData,
            totalCount: httpTabs.length,
            currentWindowOnly
          }
        },
        id
      })
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling GET_TABS request: ${errorMessage}`, 'error')
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { 
        status: 'error',
        error: `Failed to get tabs: ${errorMessage}`
      },
      id
    })
  }
}

// Get LLM providers configuration
async function handleGetLlmProvidersPort(
  port: chrome.runtime.Port,
  id?: string
): Promise<void> {
  try {
    const config = await LLMSettingsReader.readAllProviders()
    lastProvidersConfigJson = JSON.stringify(config)
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { status: 'success', data: { providersConfig: config } },
      id
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling GET_LLM_PROVIDERS: ${errorMessage}`, 'error')
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { status: 'error', error: `Failed to read providers: ${errorMessage}` },
      id
    })
  }
}

// Save LLM providers configuration
function handleSaveLlmProvidersPort(
  payload: unknown,
  port: chrome.runtime.Port,
  id?: string
): void {
  try {
    const config = BrowserOSProvidersConfigSchema.parse(payload)
    const browserOS = (chrome as any)?.browserOS as { setPref?: (name: string, value: any, pageId?: string, cb?: (ok: boolean) => void) => void } | undefined
    if (browserOS?.setPref) {
      browserOS.setPref(
        BROWSEROS_PREFERENCE_KEYS.PROVIDERS,
        JSON.stringify(config),
        undefined,
        (success?: boolean) => {
          if (success) {
            try { langChainProvider.clearCache() } catch (_) {}
            lastProvidersConfigJson = JSON.stringify(config)
            broadcastProvidersConfig(config)
          }
          port.postMessage({
            type: MessageType.WORKFLOW_STATUS,
            payload: success ? { status: 'success' } : { status: 'error', error: 'Save failed' },
            id
          })
        }
      )
    } else {
      // Fallback to chrome.storage.local for dev
      try {
        const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
        chrome.storage?.local?.set({ [key]: JSON.stringify(config) }, () => {
          try { langChainProvider.clearCache() } catch (_) {}
          lastProvidersConfigJson = JSON.stringify(config)
          broadcastProvidersConfig(config)
          port.postMessage({
            type: MessageType.WORKFLOW_STATUS,
            payload: { status: 'success' },
            id
          })
        })
      } catch (_e) {
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'error', error: 'Save failed' },
          id
        })
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { status: 'error', error: errorMessage },
      id
    })
  }
}


/**
 * Handles task cancellation requests via port messaging
 * @param payload - Cancel task payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleCancelTaskPort(
  payload: CancelTaskMessage['payload'],
  port: chrome.runtime.Port,
  id?: string
): void {
  try {
    nxtScape.cancel()
    Logging.logMetric('task_cancelled')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling task cancellation: ${errorMessage}`, 'error')
  }
}




/**
 * Handles glow start requests via port messaging
 * @param payload - Glow start payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleGlowStartPort(
  payload: { tabId: number },
  port: chrome.runtime.Port,
  id?: string
): void {
  const { tabId } = payload
  
  debugLog(`Glow start requested for tab ${tabId}`)
  
  glowService.startGlow(tabId)
    .then(() => {
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          message: `Glow started on tab ${tabId}`
        },
        id
      })
    })
    .catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: `Failed to start glow: ${errorMessage}`
        },
        id
      })
    })
}

/**
 * Handles glow stop requests via port messaging
 * @param payload - Glow stop payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleGlowStopPort(
  payload: { tabId: number },
  port: chrome.runtime.Port,
  id?: string
): void {
  const { tabId } = payload
  
  debugLog(`Glow stop requested for tab ${tabId}`)
  
  glowService.stopGlow(tabId)
    .then(() => {
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          message: `Glow stopped on tab ${tabId}`
        },
        id
      })
    })
    .catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: `Failed to stop glow: ${errorMessage}`
        },
        id
      })
    })
}

/**
 * Handle MCP Install Server message
 */
async function handleMCPInstallServerPort(
  payload: { serverId: string },
  port: chrome.runtime.Port,
  id?: string
): Promise<void> {
  const { serverId } = payload
  
  debugLog(`MCP server installation requested: ${serverId}`)
  
  try {
    // Get the server name from config
    const serverConfig = MCP_SERVERS.find(s => s.id === serverId)
    if (!serverConfig) {
      throw new Error(`Unknown server ID: ${serverId}`)
    }
    
    // Install the server using KlavisAPIManager
    const manager = KlavisAPIManager.getInstance()
    const result = await manager.installServer(serverConfig.name)
    
    // Check if authentication was successful
    if (result.oauthUrl && !result.authSuccess) {
      // OAuth was required but failed
      port.postMessage({
        type: MessageType.MCP_SERVER_STATUS,
        payload: {
          serverId,
          status: 'auth_failed',
          serverUrl: result.serverUrl,
          instanceId: result.instanceId,
          error: 'Authentication required but not completed. Please try installing again and complete the authentication.'
        },
        id
      })
      
      debugLog(`MCP server installed but auth failed: ${serverId} (${result.instanceId})`)
      return
    }
    
    // Send success message
    port.postMessage({
      type: MessageType.MCP_SERVER_STATUS,
      payload: {
        serverId,
        status: 'success',
        serverUrl: result.serverUrl,
        instanceId: result.instanceId,
        authenticated: result.authSuccess !== false
      },
      id
    })
    
    debugLog(`MCP server installed successfully: ${serverId} (${result.instanceId}), authenticated: ${result.authSuccess !== false}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Installation failed'
    
    // Send error message
    port.postMessage({
      type: MessageType.MCP_SERVER_STATUS,
      payload: {
        serverId,
        status: 'error',
        error: errorMessage
      },
      id
    })
    
    debugLog(`MCP server installation failed: ${serverId} - ${errorMessage}`, 'error')
  }
}

// Initialize the extension
initialize()

// Poll providers when panel is open; compare and broadcast on change
async function pollProvidersOnce(): Promise<void> {
  try {
    const config = await LLMSettingsReader.readAllProviders()
    const json = JSON.stringify(config)
    if (json !== lastProvidersConfigJson) {
      lastProvidersConfigJson = json
      try { langChainProvider.clearCache() } catch (_) {}
      broadcastProvidersConfig(config)
    }
  } catch (_e) {}
}

function startProvidersPolling(): void {
  if (providersPollIntervalId !== null) return
  // Immediate poll then interval
  void pollProvidersOnce()
  providersPollIntervalId = setInterval(() => { void pollProvidersOnce() }, 1500) as unknown as number
}

function stopProvidersPolling(): void {
  if (providersPollIntervalId !== null) {
    clearInterval(providersPollIntervalId as unknown as number)
    providersPollIntervalId = null
  }
}
