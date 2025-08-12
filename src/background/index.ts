import { MessageType, LogMessage, ExecuteQueryMessage, AgentStreamUpdateMessage, CancelTaskMessage, ResetConversationMessage, GetTabsMessage } from '@/lib/types/messaging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { langChainProvider } from '@/lib/llm/LangChainProvider'
import { BrowserOSProvidersConfigSchema, BROWSEROS_PREFERENCE_KEYS } from '@/lib/llm/settings/browserOSTypes'
import { PortName, PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { NxtScape } from '@/lib/core/NxtScape'
import { EventBus, EventProcessor } from '@/lib/events'
import { UIEventHandler } from '@/lib/events/UIEventHandler'
// Removed deprecated IStreamingCallbacks import
import posthog from 'posthog-js'
import { isDevelopmentMode } from '@/config'
import { GlowAnimationService } from '@/lib/services/GlowAnimationService'

/**
 * Background script for the ParallelManus extension
 */

// Initialize LogUtility first
Logging.initialize({ debugMode: isDevelopmentMode() })

// Initialize PostHog for analytics only if API key is provided
const posthogApiKey = process.env.POSTHOG_API_KEY
if (posthogApiKey) {
  posthog.init(posthogApiKey, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
  })
}

// Function to capture events with ai_chat prefix
function captureEvent(eventName: string, properties?: Record<string, any>) {
  if (!posthogApiKey) {
    return // Skip if PostHog is not configured
  }
  const prefixedEventName = `ai_chat:${eventName}`
  posthog.capture(prefixedEventName, properties)
  // debugLog(`📊 PostHog event: ${prefixedEventName}`, 'info')
}

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

// Initialize the extension
function initialize(): void {
  debugLog('ParallelManus extension initialized')
  
  // Capture extension initialization event
  captureEvent('extension_initialized')
  
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

      // Capture panel opened via toggle event
      captureEvent('side_panel_toggled', {})
      
      
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
    captureEvent('side_panel_opened', {
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
      captureEvent('side_panel_closed', {
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
 * Create EventBus, EventProcessor and UIEventHandler for streaming
 * @returns EventBus, EventProcessor and cleanup function
 */
function createStreamingComponents(): { eventBus: EventBus; eventProcessor: EventProcessor; cleanup: () => void } {
  const eventBus = new EventBus();
  const eventProcessor = new EventProcessor(eventBus);
  
  // Create UI event handler that converts events to messages
  const uiHandler = new UIEventHandler(eventBus, (type: MessageType, payload: any) => {
    broadcastStreamUpdate(payload);
  });
  
  // Track high-level agent activities  
  eventBus.onStreamEvent('system.message', (event) => {
    const { message } = event.data as any;
    if (message.includes('Analyzing and planning your task')) {
      captureEvent('agent_activity', {
        agent_type: 'classification',
        activity: 'task_analysis'
      });
    } else if (message.includes('Execution Plan:')) {
      captureEvent('agent_activity', {
        agent_type: 'planner',
        activity: 'plan_created'
      });
    } else if (message.includes('Executing productivity task')) {
      captureEvent('agent_activity', {
        agent_type: 'productivity',
        activity: 'task_execution'
      });
    } else if (message.includes('Starting browse task')) {
      captureEvent('agent_activity', {
        agent_type: 'browse',
        activity: 'browse_execution'
      });
    } else if (message.includes('Validating task completion')) {
      captureEvent('agent_activity', {
        agent_type: 'validator',
        activity: 'validation'
      });
    }
  });
  
  // Track tool calls
  eventBus.onStreamEvent('tool.start', (event) => {
    const { toolName } = event.data as any;
    captureEvent('tool_call', {
      tool_name: toolName
    });
  });
  
  // Track errors (but not cancellations)
  eventBus.onStreamEvent('system.error', (event) => {
    const { error } = event.data as any;
    if (error && !error.includes('cancelled') && !error.includes('stopped') && !error.includes('Aborted')) {
      debugLog(`🔄 Stream error: ${error}`, 'error');
    }
  });
  
  return {
    eventBus,
    eventProcessor,
    cleanup: () => {
      uiHandler.destroy();
      eventBus.removeAllListeners();
    }
  };
}

/**
 * Handles query execution from port messages
 * @param payload - Query execution payload
 * @param port - Port that sent the message  
 * @param id - Message ID for response tracking
 */
async function handleExecuteQueryPort(
  payload: { query: string; tabIds?: number[]; source?: string },
  port: chrome.runtime.Port,
  id?: string
): Promise<void> {
  let cleanup: (() => void) | undefined;
  
  try {
    // Enhanced debug logging
    debugLog(`🎯 [Background] Received query execution from ${payload.source || 'unknown'}`)
    
    captureEvent('query_initiated', {
      query: payload.query,
      source: payload.source || 'unknown',
    })
    
    // Initialize NxtScape if not already done
    await ensureNxtScapeInitialized()
    
    
    // Create streaming components
    const { eventBus, eventProcessor, cleanup: cleanupFn } = createStreamingComponents()
    cleanup = cleanupFn
    
    // Execute the query using NxtScape with EventBus and EventProcessor
    // Starting NxtScape execution
    
    const result = await nxtScape.run({
      query: payload.query,
      tabIds: payload.tabIds,
      eventBus: eventBus,
      eventProcessor: eventProcessor
    })
    
    // NxtScape execution completed
    
    // Send workflow status based on result
    const statusPayload: any = {
      status: result.success ? 'completed' : 'failed',
      message: result.success ? 'Task completed successfully' : result.error || 'Task failed',
    }
    
    if (result.error) {
      statusPayload.error = result.error
    }
    
    
    // Check if it was cancelled
    if (result.error && (result.error.includes('cancelled') || result.error.includes('stopped'))) {
      statusPayload.cancelled = true
      statusPayload.cancelledQuery = payload.query
      // Override the error message to be more user-friendly
      statusPayload.error = undefined  // Don't show error for cancellations
    }
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: statusPayload,
      id
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`[Background] Error executing query: ${errorMessage}`, 'error')
    
    // Check if it's a cancellation error
    const isCancelled = error instanceof Error && (error.name === 'AbortError' || errorMessage.includes('cancelled') || errorMessage.includes('stopped'))
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: {
        status: isCancelled ? 'cancelled' : 'failed',
        message: undefined, // Message will be shown by agents only for user-initiated cancellation
        error: isCancelled ? undefined : errorMessage, // Don't send error for cancellations
        cancelled: isCancelled,
        cancelledQuery: isCancelled ? payload.query : undefined,
        userInitiatedCancel: false  // This is not user-initiated (error path)
      },
      id
    })
  }
}

/**
 * Broadcast streaming update to all connected UIs
 */
function broadcastStreamUpdate(update: AgentStreamUpdateMessage['payload']): void {
  for (const [name, port] of connectedPorts) {
    if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
      try {
        port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: update
        })
      } catch (error) {
        debugLog(`Failed to broadcast stream update to ${name}: ${error}`, 'warning')
      }
    }
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
    const { source } = payload
    
    debugLog(`Conversation reset requested from ${source || 'unknown'}`)
    
    // Clear conversation history in NxtScape
    nxtScape.reset()
    
    // Capture conversation reset event
    captureEvent('conversation_reset')
    
    // Send success response
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: {
        status: 'reset',
        message: 'Conversation history cleared'
      },
      id
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling conversation reset: ${errorMessage}`, 'error')
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { 
        status: 'error',
        error: `Failed to reset conversation: ${errorMessage}`
      },
      id
    })
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
    const { reason, source } = payload
    
    debugLog(`Task cancellation requested from ${source || 'unknown'}: ${reason || 'No reason provided'}`)
    
    // Attempt to cancel the current task
    const cancellationResult = nxtScape.cancel()
    
    if (cancellationResult.wasCancelled) {
      const cancelledQuery = cancellationResult.query || 'Unknown query';
      // Task successfully cancelled
      
      // Capture task cancelled event
      captureEvent('task_cancelled')
      
      // Create a user-friendly cancellation message
      const cancellationMessage = `Task cancelled: "${cancelledQuery}"`;
      
      // Send success response
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'cancelled',
          message: cancellationMessage
        },
        id
      })
      
      // Broadcast cancellation to all connected UIs with better messaging
      broadcastWorkflowStatus({
        success: false,
        cancelled: true,
        message: '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!',
        cancelledQuery,
        reason: reason || 'User requested cancellation',
        userInitiatedCancel: true  // Mark this as user-initiated cancellation
      })
      
    } else {
      // No running task to cancel
      
      // Send response indicating no task was running
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'idle',
          message: 'No running task to cancel'
        },
        id
      })
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling task cancellation: ${errorMessage}`, 'error')
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { 
        status: 'error',
        error: `Failed to cancel task: ${errorMessage}`
      },
      id
    })
  }
}

// Broadcast workflow status to all connected UIs
function broadcastWorkflowStatus(payload: Record<string, unknown> | unknown): void {
  // Send to all connected UIs (side panels)
  for (const [name, port] of connectedPorts) {
    if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload
      })
    }
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
