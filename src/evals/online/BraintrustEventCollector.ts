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
 * - Automatic LLM tracking via wrapOpenAI
 */

// Lazy load heavy dependencies to avoid module loading issues
let initLogger: any;
let wrapOpenAI: any;
let wrapTraced: any;
let OpenAI: any;
import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'
import { ENABLE_TELEMETRY, BRAINTRUST_API_KEY } from '@/config'
import { EventEnricher } from './EventEnricher'

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
  context: z.any().optional()  // Enhanced context from EventEnricher
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
  private sampleRate: number = 1.0  // Percentage of sessions to track (0-1)
  private initialized: boolean = false  // Track if we've initialized Braintrust
  
  // Pre-wrapped OpenAI client that automatically tracks LLM calls
  // Use this instead of raw OpenAI client to get automatic telemetry
  public openai: any = null
  
  // Enhanced telemetry components
  private eventEnricher: EventEnricher | null = null
  private executionContext: any = null  // Will be set when session starts
  
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
  private _ensureInitialized(): void {
    // Only initialize once
    if (this.initialized) return;
    
    // Check if we should be enabled
    this.enabled = this._checkIfEnabled();
    if (this.enabled) {
      this._initialize();
    }
    
    // Mark as initialized even if disabled (to avoid repeated checks)
    this.initialized = true;
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
   * Initializes Braintrust logger and wrapped OpenAI client
   * Only called if eval mode is enabled
   */
  private _initialize(): void {
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
      if (!initLogger || !wrapOpenAI) {
        const braintrust = require('braintrust');
        initLogger = braintrust.initLogger;
        wrapOpenAI = braintrust.wrapOpenAI;
        wrapTraced = braintrust.wrapTraced;
      }
      
      // Create Braintrust logger instance (not Experiment)
      // Logger pattern is lighter weight than full experiments
      this.logger = initLogger({
        apiKey,
        projectName: 'browseros-agent-online'
        // Note: SDK handles batching and retry logic automatically
      })
      
      // Wrap OpenAI client for automatic LLM telemetry
      const openaiKey = this._getOpenAIKey()
      if (openaiKey) {
        if (!OpenAI) {
          OpenAI = require('openai').default;
        }
        this.openai = wrapOpenAI(new OpenAI({ apiKey: openaiKey }))
      }
      
      // Telemetry initialized successfully
      console.log('%c✓ Telemetry ready (API key found)', 'color: #00ff00; font-size: 10px');
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
   * Retrieves OpenAI API key for LLM tracking
   * Only needed if you want automatic LLM call telemetry
   */
  private _getOpenAIKey(): string | null {
    // OpenAI key still comes from environment (via webpack)
    return (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) || null
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
  setExecutionContext(context: any): void {
    this.executionContext = context
    if (context && this.enabled) {
      this.eventEnricher = new EventEnricher(context)
    }
  }
  
  /**
   * Run a function inside a traced span for proper waterfall visualization
   * This wraps the actual work, not just the logging
   * 
   * @param name - Name of the span (e.g., tool name)
   * @param parent - Parent span ID for nesting
   * @param fn - The async function to execute and measure
   * @returns Result of the function
   */
  async runInSpan<T>(
    name: string,
    parent: string | undefined,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    this._ensureInitialized()
    if (!this.enabled || !this.logger || !parent) {
      // If telemetry disabled or no parent, just run the function
      return fn(null)
    }
    
    // Wrap the actual work in a traced span
    return this.logger.traced(
      async (span: any) => {
        try {
          // Execute the function and pass the span for optional logging
          const result = await fn(span)
          return result
        } catch (error) {
          // Log error to the span before re-throwing
          span.log({
            error: error instanceof Error ? error.message : String(error),
            metadata: { type: 'error', name }
          })
          throw error
        }
      },
      { parent, name }
    )
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
   * Set sampling rate for statistical sampling
   * Useful for high-traffic scenarios to reduce data volume
   * @param rate - Value between 0 (no tracking) and 1 (track all)
   */
  setSampleRate(rate: number): void {
    this.sampleRate = Math.max(0, Math.min(1, rate))
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
    
    // Apply sampling rate without affecting global enabled state
    // This allows per-session sampling decisions
    if (Math.random() > this.sampleRate) {
      return { parent: undefined }
    }
    
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
      }, { 
        name: 'agent_session'
      })
      
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
      
      // Add enriched context if available
      if (this.eventEnricher && !validatedEvent.context) {
        // Get context based on event type
        if (event.type === 'tool_execution' || event.type === 'decision_point') {
          const enrichedContext = await this.eventEnricher.getFullContext()
          validatedEvent.context = enrichedContext
        } else if (event.type === 'browser_action') {
          // Lighter context for browser actions
          validatedEvent.context = await this.eventEnricher.enrichWithBrowserState()
        }
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
        if (validatedEvent.context?.messageHistoryLength !== undefined) {
          metrics.message_history_length = validatedEvent.context.messageHistoryLength
        }
        
        // Update the span with proper structure
        span.log({
          input: validatedEvent.data?.input || validatedEvent.name,
          output: validatedEvent.data?.output,
          metadata: {
            type: validatedEvent.type,
            timestamp: validatedEvent.timestamp,
            // Full enriched context for dev telemetry
            ...validatedEvent.context,
            // Tool-specific data
            phase: validatedEvent.data?.phase,
            error: validatedEvent.data?.error,
            // Keep raw event data for debugging
            eventData: validatedEvent.data
          },
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          scores: validatedEvent.data?.success !== undefined ? {
            success: validatedEvent.data.success ? 1 : 0
          } : undefined
        })
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
      // Log final span with results using proper Braintrust structure
      await this.logger.traced(async (span: any) => {
        span.log({
          output: result.summary || (result.success ? 'Task completed successfully' : 'Task failed'),
          metadata: {
            type: 'session_end',
            sessionId,
            success: result.success,
            error: result.error
          },
          metrics: {
            duration_ms: result.duration_ms
          },
          scores: {
            success: result.success ? 1 : 0,
            ...(result.userScore !== undefined && { user_score: result.userScore })
          }
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
  
  /**
   * Gracefully shutdown the collector
   * Flushes remaining events and disables collection
   */
  async shutdown(): Promise<void> {
    if (this.logger) {
      await this.logger.flush()
    }
    this.enabled = false
  }
}
