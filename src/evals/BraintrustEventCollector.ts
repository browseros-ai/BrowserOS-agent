/**
 * BraintrustEventCollector - Centralized telemetry for online evaluation
 * 
 * This module collects real-world usage data for improving the agent.
 * It integrates with Braintrust for experiment tracking and analysis.
 * 
 * Key concepts:
 * - Singleton pattern ensures one collector instance across the app
 * - Lazy initialization only when eval mode is enabled
 * - Parent/child span relationships for tracing execution flow
 * - Automatic tool tracking via wrapTraced
 */

// Lazy load heavy dependencies to avoid module loading issues
let initLogger: any;
let wrapTraced: any;
import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { ENABLE_TELEMETRY, BRAINTRUST_API_KEY, OPENAI_API_KEY_FOR_SCORING } from '@/config'

// Event types we track during agent execution
// Each type represents a different aspect of agent behavior
export const EventSchema = z.object({
  type: z.enum([
    'session_start',      // When user starts a task
    'session_end',        // When task completes/fails
    'tool_execution',     // Each tool the agent uses
    'decision_point',     // Agent's decision-making moments
    'error',              // Errors during execution
    'browser_action',     // DOM interactions, navigation
    'user_feedback'       // User satisfaction signals
    // Note: 'llm_call' removed - wrapOpenAI handles LLM tracking automatically
  ]),
  name: z.string(),      // Human-readable event name
  data: z.any(),         // Event-specific payload
  timestamp: z.number().optional(),  // When event occurred
  context: z.any().optional(),  // Lightweight metadata context
  scores: z.record(z.string(), z.number()).optional(),  // Top-level scores for Braintrust
  scoring_details: z.any().optional(),  // Detailed scoring information
  error: z.object({  // Structured error for Braintrust error tracking
    name: z.string(),
    message: z.string(),
    stack: z.string().optional()
  }).optional()
})

export type BraintrustEvent = z.infer<typeof EventSchema>

// Metadata captured at session start
// Provides context for analyzing agent behavior
const SessionMetadataSchema = z.object({
  sessionId: z.string(),            // Unique session identifier
  task: z.string(),                 // What the user asked the agent to do
  timestamp: z.number(),            // When session started
  tabContext: z.any().optional(),   // Which tabs are selected
  browserInfo: z.object({           // Browser environment details
    version: z.string().optional(),
    tabCount: z.number().optional()
  }).optional()
})

type SessionMetadata = z.infer<typeof SessionMetadataSchema>

/**
 * Singleton collector class for event tracking
 * Uses lazy initialization to avoid overhead when not in eval mode
 */
export class BraintrustEventCollector {
  private static instance: BraintrustEventCollector | null = null
  private enabled: boolean = false
  private logger: any = null
  private initialized: boolean = false  // Track if we've initialized Braintrust
  
  // Direct access to execution context
  private executionContext: ExecutionContext | null = null  // Will be set when session starts
  
  // Track tool error counts per session
  private toolErrorCounts: Map<string, number> = new Map()
  
  /**
   * Private constructor enforces singleton pattern
   * Note: Initialization is now lazy - happens on first use, not construction
   */
  private constructor() {
    // Don't check or initialize here - do it lazily on first use
    // This allows environment variables to be set after construction
  }
  
  /**
   * Lazily check if enabled and initialize if needed
   * This is called on every public method to ensure we pick up env changes
   */
  private async _ensureInitialized(): Promise<void> {
    // Only initialize once
    if (this.initialized) return;
    this.initialized = true;  // Set immediately to prevent concurrent calls
    
    // Check if we should be enabled
    this.enabled = this._checkIfEnabled();
    if (this.enabled) {
      await this._initialize();
    }
  }
  
  /**
   * Determines if evaluation mode is active
   * Simply checks the ENABLE_TELEMETRY flag from config
   */
  private _checkIfEnabled(): boolean {
    // Simple flag check - no environment variables needed
    const isEnabled = ENABLE_TELEMETRY;
    
    // Set global flag for debugging
    if (typeof window !== 'undefined') {
      (window as any).__BROWSEROS_TELEMETRY_ENABLED = isEnabled;
    }
    
    return isEnabled;
  }
  
  /**
   * Initializes Braintrust logger
   * Only called if eval mode is enabled
   */
  private async _initialize(): Promise<void> {
    try {
      // Retrieve API key securely
      const apiKey = this._getApiKey()
      
      if (!apiKey) {
        // Only show warning if telemetry was supposed to be enabled
        if (ENABLE_TELEMETRY) {
          console.warn('%c⚠️ Telemetry enabled but no API key set. Add BRAINTRUST_API_KEY in config.ts', 'color: #ff9900; font-size: 11px');
        }
        this.enabled = false;
        return;
      }
      
      // Lazy load braintrust module only when we have an API key
      if (!initLogger || !wrapTraced) {
        const braintrust = require('braintrust');
        initLogger = braintrust.initLogger;
        wrapTraced = braintrust.wrapTraced;
      }
      
      // Create Braintrust logger instance (not Experiment)
      // Logger pattern is lighter weight than full experiments
      this.logger = initLogger({
        apiKey,
        projectName: 'browseros-agent-online'
        // Note: SDK handles batching and retry logic automatically
      })
      
      // LangChain integration removed - not available in current package version
      
      // Telemetry initialized successfully
      console.log('%c✓ Telemetry ready (API key found)', 'color: #00ff00; font-size: 10px');
      
      // Check and log OpenAI scoring key status
      if (OPENAI_API_KEY_FOR_SCORING && OPENAI_API_KEY_FOR_SCORING.trim()) {
        console.log('%c✓ LLM Scoring ready (OpenAI key found)', 'color: #9c27b0; font-size: 10px');
      } else {
        console.log('%c⚠ LLM Scoring disabled (no OpenAI key in config)', 'color: #ffaa00; font-size: 10px');
      }
    } catch (error) {
      // Silently disable on initialization failure
      this.enabled = false;
    }
  }
  
  /**
   * Retrieves Braintrust API key from config
   */
  private _getApiKey(): string | null {
    // Use API key from config file
    // Return null if empty string or not set
    return BRAINTRUST_API_KEY && BRAINTRUST_API_KEY.trim() ? BRAINTRUST_API_KEY : null
  }
  
  /**
   * Get or create the singleton instance
   * Ensures only one collector exists across the entire application
   */
  static getInstance(): BraintrustEventCollector {
    if (!BraintrustEventCollector.instance) {
      BraintrustEventCollector.instance = new BraintrustEventCollector()
    }
    return BraintrustEventCollector.instance
  }
  
  /**
   * Set the execution context for event enrichment
   * Called when a new session starts
   */
  setExecutionContext(context: ExecutionContext): void {
    this.executionContext = context
  }
  
  /**
   * Get lightweight metadata directly from ExecutionContext
   * Only pulls metrics and references, not full content
   */
  private async getEventMetadata(): Promise<any> {
    if (!this.executionContext) return {}
    
    try {
      // Get current browser state if available
      let currentUrl: string | null = null
      let currentTitle: string | null = null
      try {
        const page = await this.executionContext.browserContext.getCurrentPage()
        if (page) {
          currentUrl = await page.url()
          currentTitle = await page.title()
        }
      } catch (e) {
        // Browser state might not be available
      }
      
      return {
        // Metrics only - no content
        taskNumber: this.executionContext.getCurrentTaskNumber(),
        messageCount: this.executionContext.messageManager.getMessages().length,
        tokenCount: this.executionContext.messageManager.getTokenCount(),
        todoCount: this.executionContext.todoStore.getAll().length,
        todosCompleted: this.executionContext.todoStore.getAll().filter(t => t.status === 'done').length,
        tabCount: this.executionContext.selectedTabIds?.length || 0,
        
        // References only - no content
        currentUrl,
        currentTitle,
        isUserCancellation: this.executionContext.isUserCancellation()
      }
    } catch (error) {
      // Don't let metadata errors break telemetry
      return {}
    }
  }
  
  /**
   * Get wrapTraced function for wrapping tools with automatic tracing
   * This is the recommended way to trace tools in Braintrust
   * 
   * @returns The wrapTraced function or null if not available
   */
  getWrapTraced(): typeof wrapTraced | null {
    this._ensureInitialized()
    if (!this.enabled || !wrapTraced) {
      return null
    }
    return wrapTraced
  }
  
  /**
   * Check if event collection is currently active
   * This now checks and initializes lazily
   */
  isEnabled(): boolean {
    this._ensureInitialized();
    return this.enabled
  }
  
  /**
   * Start a new evaluation session
   * Creates a parent span that all subsequent events will be nested under
   * This establishes the execution trace hierarchy
   * 
   * @param metadata - Context about the session (task, browser state, etc.)
   * @returns Parent span ID to pass to child events
   */
  async startSession(metadata: SessionMetadata): Promise<{ parent?: string }> {
    this._ensureInitialized();
    if (!this.enabled || !this.logger) return { parent: undefined }
    
    // Reset tool error counts for new session
    this.toolErrorCounts.clear()
    
    console.log('%c→ Telemetry: Starting session', 'color: #888; font-size: 11px');
    
    try {
      // Validate metadata against schema
      const validatedMetadata = SessionMetadataSchema.parse(metadata)
      
      // Create root span for this session using Braintrust's traced API
      // The span.export() returns a parent ID for nesting child events
      const parent = await this.logger.traced(async (span: any) => {
        span.log({
          input: validatedMetadata.task,  // User's task as input
          metadata: {
            sessionId: validatedMetadata.sessionId,
            timestamp: validatedMetadata.timestamp,
            tabContext: validatedMetadata.tabContext,
            browserInfo: validatedMetadata.browserInfo,
            type: 'session_start',
            conversation: true  // Mark this as a conversation session
          }
        })
        // Export returns the span ID for parent-child relationships
        return await span.export()
      }, { name: 'agent_session' })
      
      return { parent }
    } catch (error) {
      Logging.log('BraintrustEventCollector', `Failed to start session: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return { parent: undefined }
    }
  }
  
  /**
   * Log an individual event within a session
   * Events are nested under the parent span for trace visualization
   * 
   * @param event - The event data to log
   * @param options.parent - Parent span ID from startSession
   * @param options.name - Override event name for better trace readability
   */
  async logEvent(event: BraintrustEvent, options: { parent?: string; name?: string } = {}): Promise<void> {
    this._ensureInitialized();
    if (!this.enabled || !this.logger) return
    
    // Log event type in a compact format
    console.log(`%c→ ${event.type}`, 'color: #888; font-size: 10px');
    
    try {
      // Validate and add timestamp
      const validatedEvent = EventSchema.parse(event)
      validatedEvent.timestamp = validatedEvent.timestamp || Date.now()
      
      
      // Add lightweight metadata if available
      if (this.executionContext && !validatedEvent.context) {
        // Get lightweight metadata for all event types
        validatedEvent.context = await this.getEventMetadata()
      }
      
      // Track tool errors
      if (validatedEvent.type === 'tool_execution' && validatedEvent.data?.success === false) {
        const toolName = validatedEvent.data.toolName || 'unknown'
        const errorCount = (this.toolErrorCounts.get(toolName) || 0) + 1
        this.toolErrorCounts.set(toolName, errorCount)
        
        // Log error to console for visibility
        console.log(`%c⚠ Tool error #${errorCount} for ${toolName}: ${validatedEvent.data.error}`, 'color: #ff6600; font-size: 10px')
      }
      
      // Use traced with currentSpan() pattern as per Braintrust docs
      await this.logger.traced(async (span: any) => {
        // Extract numeric fields for metrics
        const metrics: Record<string, number> = {}
        if (validatedEvent.data?.duration_ms !== undefined) {
          metrics.duration_ms = validatedEvent.data.duration_ms
        }
        if (validatedEvent.data?.metrics) {
          Object.entries(validatedEvent.data.metrics).forEach(([key, value]) => {
            if (typeof value === 'number') {
              metrics[key] = value
            }
          })
        }
        // Add context metrics if numeric
        if (validatedEvent.context?.conversationTurn !== undefined) {
          metrics.conversation_turn = validatedEvent.context.conversationTurn
        }
        
        // Add tool error metrics
        if (validatedEvent.type === 'tool_execution' && validatedEvent.data?.success === false) {
          const toolName = validatedEvent.data.toolName || 'unknown'
          metrics.tool_error = 1  // Binary flag for this event
          metrics[`${toolName}_error_count`] = this.toolErrorCounts.get(toolName) || 1
          metrics.total_tool_errors = Array.from(this.toolErrorCounts.values()).reduce((sum, count) => sum + count, 0)
        }
        
        // Build logs object for Braintrust reserved slots
        const logs: Record<string, any[]> = {}
        
        // Track tool calls in reserved "Tool calls" slot
        if (validatedEvent.type === 'tool_execution') {
          const toolName = validatedEvent.data?.toolName || 'unknown'
          const toolCall = {
            name: toolName,
            input: validatedEvent.data?.input,
            output: validatedEvent.data?.output,
            duration_ms: validatedEvent.data?.duration_ms,
            timestamp: validatedEvent.timestamp
          }
          
          // Add to Tool calls slot
          logs['Tool calls'] = [toolCall]
          
          // If it's an error, also add to Tool errors slot
          if (validatedEvent.data?.success === false) {
            logs['Tool errors'] = [{
              name: toolName,
              error: validatedEvent.data?.error || 'Unknown error',
              errorType: validatedEvent.data?.errorType || 'tool_error',
              input: validatedEvent.data?.input,
              timestamp: validatedEvent.timestamp
            }]
          }
        }
        
        // Build scores object - normalize from various formats
        let scores: Record<string, number> | undefined = undefined
        
        // 1. Check for new top-level scores format
        if ((validatedEvent as any).scores) {
          scores = (validatedEvent as any).scores
        }
        // 2. Lift legacy holistic_score from data.metrics
        else if (validatedEvent.data?.metrics?.holistic_score !== undefined) {
          scores = { task_completion: validatedEvent.data.metrics.holistic_score }
          // Remove from metrics to avoid duplication
          delete metrics.holistic_score
        }
        // 3. Add task_completed score if data.success is present but not already in scores
        // Note: 'success' score now represents quality (weighted_total), not binary completion
        if (validatedEvent.data?.success !== undefined && scores && !scores.task_completed) {
          scores.task_completed = validatedEvent.data.success ? 1 : 0
        }
        
        // Extract scoring details if present
        const scoringDetails = (validatedEvent as any).scoring_details
        
        // Build the span log object
        const spanLogData: any = {
          input: validatedEvent.data?.input || validatedEvent.name,
          output: validatedEvent.data?.output,
          metadata: {
            type: validatedEvent.type,
            timestamp: validatedEvent.timestamp,
            // Full enriched context for dev telemetry
            ...validatedEvent.context,
            // Tool-specific data
            phase: validatedEvent.data?.phase,
            // Keep raw event data for debugging (but not the error - it goes top-level)
            eventData: { ...validatedEvent.data, error: undefined },
            // Include scoring details if present
            ...(scoringDetails && { scoring_details: scoringDetails })
          },
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          scores: scores,  // Now properly normalized at top level
          logs: Object.keys(logs).length > 0 ? logs : undefined  // Add logs for reserved slots
        }
        
        // CRITICAL: Add error at top level for Braintrust error tracking
        // Check both event.error (new format) and event.data.error (legacy)
        if ((validatedEvent as any).error) {
          spanLogData.error = (validatedEvent as any).error
        } else if (validatedEvent.data?.error) {
          // Legacy format - still in data
          spanLogData.error = validatedEvent.data.error
        }
        
        // Update the span with proper structure
        span.log(spanLogData)
      }, {
        parent: options.parent,  // Links to parent span
        name: options.name || validatedEvent.type  // Span name in trace view
      })
    } catch (error) {
      // Silent failure prevents eval errors from breaking agent execution
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        console.debug('Failed to log event:', error)
      }
    }
  }
  
  /**
   * Complete a session with final results
   * Logs summary metrics and ensures all events are flushed
   * 
   * @param parent - Parent span ID from startSession
   * @param sessionId - Session identifier for correlation
   * @param result - Final session outcome and metrics
   */
  async endSession(parent: string | undefined, sessionId: string, result: {
    success: boolean        // Did the task complete successfully?
    summary?: string        // Human-readable summary
    error?: string         // Error message if failed
    userScore?: number     // User satisfaction (0-1)
    duration_ms?: number   // Total execution time
  }): Promise<void> {
    this._ensureInitialized();
    if (!this.enabled || !this.logger) return
    
    console.log('%c← Telemetry: Session complete', 'color: #888; font-size: 11px');
    
    try {
      // Calculate total tool errors for the session
      const totalToolErrors = Array.from(this.toolErrorCounts.values()).reduce((sum, count) => sum + count, 0)
      
      // Log tool error summary if there were any errors
      if (totalToolErrors > 0) {
        const errorSummary = Array.from(this.toolErrorCounts.entries())
          .map(([tool, count]) => `${tool}: ${count}`)
          .join(', ')
        console.log(`%c📊 Session tool errors: ${errorSummary} (Total: ${totalToolErrors})`, 'color: #ff6600; font-size: 11px')
      }
      
      // Log final span with results using proper Braintrust structure
      await this.logger.traced(async (span: any) => {
        const sessionMetrics: Record<string, number> = {}
        if (result.duration_ms !== undefined) {
          sessionMetrics.duration_ms = result.duration_ms
        }
        
        // Add tool error metrics to session
        if (totalToolErrors > 0) {
          sessionMetrics.total_tool_errors = totalToolErrors
          // Add per-tool error counts
          this.toolErrorCounts.forEach((count, toolName) => {
            sessionMetrics[`${toolName}_errors`] = count
          })
        }
        
        // Build logs for reserved slots
        const sessionLogs: Record<string, any[]> = {}
        if (totalToolErrors > 0) {
          // Add all tool errors to the Tool errors slot
          const toolErrorsList: any[] = []
          this.toolErrorCounts.forEach((count, toolName) => {
            toolErrorsList.push({
              name: toolName,
              error_count: count,
              type: 'session_summary'
            })
          })
          sessionLogs['Tool errors'] = toolErrorsList
        }
        
        span.log({
          output: result.summary || (result.success ? 'Task completed successfully' : 'Task failed'),
          metadata: {
            type: 'session_end',
            sessionId,
            success: result.success,
            error: result.error,
            tool_error_summary: totalToolErrors > 0 ? Object.fromEntries(this.toolErrorCounts) : undefined
          },
          metrics: sessionMetrics,
          scores: {
            // Use userScore as the primary success metric (average of all weighted_totals)
            success: result.userScore !== undefined ? result.userScore : (result.success ? 1 : 0),
            session_completed: result.success ? 1 : 0,  // Binary: did session complete?
            ...(result.userScore !== undefined && { avg_weighted_total: result.userScore }),
            // Add tool error rate as a score (0 = no errors, 1 = all tools errored)
            tool_success_rate: totalToolErrors > 0 ? Math.max(0, 1 - (totalToolErrors / 20)) : 1  // Assume 20 tool calls is high
          },
          logs: Object.keys(sessionLogs).length > 0 ? sessionLogs : undefined  // Add logs for reserved slots
        })
      }, {
        parent,
        name: 'session_end'
      })
      
      // Force flush to ensure data is sent
      await this.logger.flush()
      console.log('%c✓ Telemetry data sent', 'color: #888; font-size: 10px');
    } catch (error) {
      Logging.log('BraintrustEventCollector', `Failed to end session: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }
  
  /**
   * Manually flush pending events to Braintrust
   * Usually not needed as SDK auto-batches, but useful before shutdown
   */
  async flush(): Promise<void> {
    this._ensureInitialized();
    if (!this.enabled || !this.logger) return
    await this.logger.flush()
  }
}
