import { MessageType, LogMessage, ExecuteQueryMessage, AgentStreamUpdateMessage, CancelTaskMessage, ResetConversationMessage, GetTabsMessage, GetTabHistoryMessage } from '@/lib/types/messaging'
import { PortName, PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { NxtScape } from '@/lib/core/NxtScape'
import { StreamEventBus } from '@/lib/events'
import { UIEventHandler } from '@/lib/events/UIEventHandler'
// Removed deprecated IStreamingCallbacks import
import { IntentPredictionOrchestrator } from '@/lib/orchestrators/IntentPredictionOrchestrator'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import BrowserContext from '@/lib/browser/BrowserContext'
import MessageManager from '@/lib/runtime/MessageManager'
import posthog from 'posthog-js'
import { isDevelopmentMode } from '@/config'

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

// Intent prediction setup
let intentPredictionOrchestrator: IntentPredictionOrchestrator | null = null
const intentPredictionDebounce = new Map<number, NodeJS.Timeout>()
const INTENT_PREDICTION_DELAY = 0 // No delay - run immediately

/**
 * Ensure NxtScape is initialized only once globally
 */
async function ensureNxtScapeInitialized(): Promise<void> {
  if (!isNxtScapeInitialized) {
    debugLog('Initializing NxtScape for the first time...')
    await nxtScape.initialize()
    isNxtScapeInitialized = true
    debugLog('NxtScape initialized successfully')
  }
}

/**
 * Initialize intent prediction orchestrator
 */
async function ensureIntentPredictionInitialized(): Promise<void> {
  if (!intentPredictionOrchestrator) {
    debugLog('Initializing IntentPredictionOrchestrator...')
    // Create minimal execution context for intent prediction
    const browserContext = new BrowserContext({})
    const messageManager = new MessageManager()
    const abortController = new AbortController()
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: isDevelopmentMode()
    })
    
    intentPredictionOrchestrator = new IntentPredictionOrchestrator(executionContext)
    debugLog('IntentPredictionOrchestrator initialized successfully')
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


/**
 * Handle intent bubble click from content script
 */
async function handleIntentBubbleClick(intent: string, tabId?: number): Promise<void> {
  try {
    if (!tabId) {
      debugLog('No tabId provided for intent bubble click', 'error')
      return
    }
    
    debugLog(`Intent bubble clicked: "${intent}" on tab ${tabId}`)
    
    // Open the side panel for this tab
    await chrome.sidePanel.open({ tabId })
    
    // Wait a bit for the panel to be ready
    setTimeout(() => {
      // Send the intent to the side panel
      const message = {
        type: MessageType.INTENT_BUBBLE_CLICKED,
        payload: { intent }
      }
      
      // Broadcast to side panel
      for (const [name, port] of connectedPorts) {
        if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
          try {
            port.postMessage(message)
            debugLog(`Sent intent bubble click to side panel: ${intent}`)
          } catch (error) {
            debugLog(`Failed to send intent bubble click to ${name}: ${error}`, 'warning')
          }
        }
      }
    }, 200) // Small delay to ensure panel is connected
    
  } catch (error) {
    debugLog(`Error handling intent bubble click: ${error}`, 'error')
  }
}

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
  
  // Register message listener for content script messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageType.INTENT_BUBBLE_CLICKED) {
      handleIntentBubbleClick(message.payload.intent, sender.tab?.id)
      sendResponse({ success: true })
    }
    return false
  })
  
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
  
  // Track tabs
  chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
    if (tab.id) {
      activeTabs.set(tab.id, { url: tab.url || '' })
      // Tab created
    }
  })
  
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      activeTabs.set(tabId, { url: tab.url })
      // Tab updated
      
      // Update navigation history
      // if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
      //   // Get or create history for this tab
      //   let history = tabHistory.get(tabId) || []
      //
      //   // Add new entry (avoid duplicate consecutive URLs)
      //   if (history.length === 0 || history[history.length - 1].url !== tab.url) {
      //     history.push({
      //       url: tab.url,
      //       title: tab.title || '',
      //       timestamp: Date.now()
      //     })
      //
      //     // Keep only last 5 entries
      //     if (history.length > 5) {
      //       history = history.slice(-5)
      //     }
      //
      //     tabHistory.set(tabId, history)
      //     // Updated navigation history
      //
      //     // Trigger debounced intent prediction
      //     triggerIntentPrediction(tabId)
      //   }
      //
      // }
    }
  })
  
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    activeTabs.delete(tabId)
    tabHistory.delete(tabId)
    // Clear any pending intent predictions
    const timeout = intentPredictionDebounce.get(tabId)
    if (timeout) {
      clearTimeout(timeout)
      intentPredictionDebounce.delete(tabId)
    }
    // Tab removed
  })
  
  // Also trigger prediction when user switches tabs
  chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
    const { tabId } = activeInfo
    
    // Check if we have history for this tab
    // const history = tabHistory.get(tabId)
    // if (history && history.length > 0) {
    //   // Trigger prediction for the newly active tab
    //   triggerIntentPrediction(tabId)
    // }
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
        
      case MessageType.GET_TAB_HISTORY:
        // GET_TAB_HISTORY message received
        handleGetTabHistoryPort(payload as GetTabHistoryMessage['payload'], port, id)
        break
        
      case MessageType.AGENT_STREAM_UPDATE:
        // This is an outgoing message type, not incoming
        // Received AGENT_STREAM_UPDATE (shouldn't happen)
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
 * Create EventBus and UIEventHandler for streaming
 * @returns EventBus and cleanup function
 */
function createStreamingEventBus(): { eventBus: StreamEventBus; cleanup: () => void } {
  const eventBus = new StreamEventBus();
  
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
    
    captureEvent('query_executed', {
      source: payload.source || 'unknown'
    })
    
    // Initialize NxtScape if not already done
    await ensureNxtScapeInitialized()
    
    
    // Create EventBus for streaming
    const { eventBus, cleanup: cleanupFn } = createStreamingEventBus()
    cleanup = cleanupFn
    
    // Execute the query using NxtScape with EventBus
    // Starting NxtScape execution
    
    const result = await nxtScape.run({
      query: payload.query,
      tabIds: payload.tabIds,
      eventBus: eventBus
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

/**
 * Handles GET_TAB_HISTORY requests to fetch navigation history for a tab
 * @param payload - Get tab history payload
 * @param port - Port to send response through
 * @param id - Optional message ID for correlation
 */
function handleGetTabHistoryPort(
  payload: GetTabHistoryMessage['payload'],
  port: chrome.runtime.Port,
  id?: string
): void {
  try {
    const { tabId, limit = 5 } = payload
    
    // Getting navigation history
    
    // Get history for the specified tab
    const history = tabHistory.get(tabId) || []
    
    // Return the most recent entries up to the limit
    const recentHistory = history.slice(-limit).reverse() // Most recent first
    
    // Found history entries
    
    // Send success response with history data
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: {
        status: 'success',
        data: {
          tabId,
          history: recentHistory,
          totalCount: recentHistory.length
        }
      },
      id
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling GET_TAB_HISTORY request: ${errorMessage}`, 'error')
    
    port.postMessage({
      type: MessageType.WORKFLOW_STATUS,
      payload: { 
        status: 'error',
        error: `Failed to get tab history: ${errorMessage}`
      },
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
 * Trigger intent prediction with debouncing
 */
function triggerIntentPrediction(tabId: number): void {
  // Clear existing timeout for this tab
  const existingTimeout = intentPredictionDebounce.get(tabId)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }
  
  // Set new timeout
  const timeout = setTimeout(async () => {
    intentPredictionDebounce.delete(tabId)
    
    try {
      // Get tab info and history
      const tab = await chrome.tabs.get(tabId)
      const history = tabHistory.get(tabId) || []
      
      if (!tab.url || history.length === 0) {
        // Skipping intent prediction: no URL or history
        return
      }
      
      // Only run prediction if tab history has at most 3 items
      if (history.length < 3) {
        // Skipping intent prediction: history too short
        return
      }
      
      // Check if we should predict for this URL
      if (!IntentPredictionOrchestrator.shouldPredictForUrl(tab.url)) {
        // Skipping intent prediction: URL not suitable
        return
      }
      
      // Ensure orchestrator is initialized
      await ensureIntentPredictionInitialized()
      
      if (!intentPredictionOrchestrator) {
        debugLog('Intent prediction orchestrator not available', 'error')
        return
      }
      
      // Running intent prediction
      
      // Create event bus for intent prediction if in debug mode
      let intentEventBus: StreamEventBus | undefined;
      if (isDevelopmentMode()) {
        intentEventBus = new StreamEventBus({ debugMode: true });
        
        // Set up debug message listener to broadcast to side panels
        intentEventBus.onStreamEvent('debug.message', (event) => {
          const { message, data } = event.data as any;
          
          // Broadcast to side panels that are open
          const debugUpdate: AgentStreamUpdateMessage['payload'] = {
            step: 0,
            action: 'Debug',
            status: 'debug' as any,
            details: {
              messageType: 'DebugMessage',
              content: `[Intent Prediction] ${message}`,
              data: data,
              timestamp: new Date().toISOString()
            }
          };
          
          broadcastStreamUpdate(debugUpdate);
        });
      }
      
      // Run prediction with optional event bus
      const result = await intentPredictionOrchestrator.predictIntents({
        tabId,
        tabHistory: history
      }, intentEventBus)
      
      if (result.intents.length > 0) {
        debugLog(`✅ Predicted ${result.intents.length} intents for tab ${tabId}: ${result.intents.join(', ')}`)
        
        // Store in chrome.storage.session
        await chrome.storage.session.set({
          [`intent_${tabId}`]: result
        })
        
        // Broadcast to side panels
        broadcastIntentPredictions(result)
      } else {
        // No intents predicted
      }
      
    } catch (error) {
      debugLog(`Error predicting intents for tab ${tabId}: ${error}`, 'error')
    }
  }, INTENT_PREDICTION_DELAY)
  
  intentPredictionDebounce.set(tabId, timeout)
}

/**
 * Broadcast intent predictions to all connected side panels
 */
function broadcastIntentPredictions(predictions: any): void {
  const message = {
    type: MessageType.INTENT_PREDICTION_UPDATED,
    payload: {
      tabId: predictions.tabId,
      url: predictions.url,
      intents: predictions.intents,
      confidence: predictions.confidence,
      timestamp: predictions.timestamp
    }
  }
  
  // Broadcast to all connected side panels
  for (const [name, port] of connectedPorts) {
    if (name === PortName.SIDEPANEL_TO_BACKGROUND) {
      try {
        port.postMessage(message)
        // Broadcasted intent predictions
      } catch (error) {
        debugLog(`Failed to broadcast intent predictions to ${name}: ${error}`, 'warning')
      }
    }
  }
  
  // Also send to content script if we have a valid tabId
  if (predictions.tabId && predictions.intents.length > 0) {
    chrome.tabs.sendMessage(predictions.tabId, {
      type: MessageType.INTENT_BUBBLES_SHOW,
      payload: {
        intents: predictions.intents,
        confidence: predictions.confidence
      }
    }).catch((error) => {
      debugLog(`Failed to send intent bubbles to tab ${predictions.tabId}: ${error}`, 'warning')
    })
  }
}

// Initialize the extension
initialize()
