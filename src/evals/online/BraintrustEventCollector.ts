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
let OpenAI: any;
import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'
import { ENABLE_TELEMETRY, BRAINTRUST_API_KEY } from '@/config'

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
  timestamp: z.number().optional()  // When event occurred
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
          type: 'session_start',
          metadata: validatedMetadata
        })
        // Export returns the span ID for parent-child relationships
        return await span.export()
      }, { 
        name: 'agent_session',
        event: {
          input: { task: validatedMetadata.task },  // Task becomes the "input" in Braintrust UI
          metadata: validatedMetadata
        }
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
      
      // Create child span under parent
      await this.logger.traced(async (span: any) => {
        span.log(validatedEvent)
      }, {
        parent: options.parent,  // Links to parent span
        name: options.name || validatedEvent.type,  // Span name in trace view
        event: {
          metadata: { timestamp: validatedEvent.timestamp }
        }
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
    toolsUsed?: string[]   // Which tools were invoked
    duration_ms?: number   // Total execution time
  }): Promise<void> {
    this._ensureInitialized();
    if (!this.enabled || !this.logger) return
    
    console.log('%c← Telemetry: Session complete', 'color: #888; font-size: 11px');
    
    try {
      // Log final span with results
      await this.logger.traced(async (span: any) => {
        span.log({
          type: 'session_end',
          sessionId,
          data: result
        })
      }, {
        parent,
        name: 'session_end',
        event: {
          output: result.summary || (result.success ? 'Success' : 'Failed'),  // Shows in Braintrust UI
          scores: result.userScore ? { user_score: result.userScore } : undefined,  // Metrics for analysis
          metadata: result
        }
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
