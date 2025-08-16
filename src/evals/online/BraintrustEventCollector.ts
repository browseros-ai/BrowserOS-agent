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

import { initLogger, wrapOpenAI } from 'braintrust'
import OpenAI from 'openai'
import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'

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
  
  // Pre-wrapped OpenAI client that automatically tracks LLM calls
  // Use this instead of raw OpenAI client to get automatic telemetry
  public openai: any = null
  
  /**
   * Private constructor enforces singleton pattern
   * Checks if eval mode is enabled and initializes if needed
   */
  private constructor() {
    this.enabled = this._checkIfEnabled()
    if (this.enabled) {
      this._initialize()
    }
  }
  
  /**
   * Determines if evaluation mode is active
   * Checks multiple sources to avoid accidental data collection
   */
  private _checkIfEnabled(): boolean {
    // Check environment-specific flags
    if (typeof window !== 'undefined') {
      // Browser: Use sessionStorage (not localStorage) for security
      // sessionStorage is cleared when tab closes, preventing persistent tracking
      const isEnabled = (
        sessionStorage.getItem('BROWSEROS_EVAL_MODE') === 'true' ||
        new URLSearchParams(window.location.search).has('eval')  // URL param override
      )
      
      if (isEnabled) {
        Logging.log('BraintrustEventCollector', 'Eval mode enabled in browser', 'info')
      }
      
      return isEnabled
    } else {
      // Node.js: Check environment variable (for testing)
      return process.env.BROWSEROS_EVAL_MODE === 'true'
    }
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
        Logging.log('BraintrustEventCollector', 'No API key found, disabling', 'warning')
        this.enabled = false
        return
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
        this.openai = wrapOpenAI(new OpenAI({ apiKey: openaiKey }))
      }
      
      Logging.log('BraintrustEventCollector', 'Successfully initialized with logger', 'info')
    } catch (error) {
      Logging.log('BraintrustEventCollector', `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`, 'error')
      this.enabled = false
    }
  }
  
  /**
   * Retrieves Braintrust API key from secure storage
   * In production, should route through background script to avoid exposing keys
   */
  private _getApiKey(): string | null {
    // TODO: In production, use SecureAPIKeyHandler to route through background script
    if (typeof window !== 'undefined') {
      // Browser: Currently using sessionStorage (temporary)
      // Production should use chrome.storage.local via background script
      return sessionStorage.getItem('BRAINTRUST_API_KEY') || null
    } else {
      // Node.js: Use environment variable
      return process.env.BRAINTRUST_API_KEY || null
    }
  }
  
  /**
   * Retrieves OpenAI API key for LLM tracking
   * Only needed if you want automatic LLM call telemetry
   */
  private _getOpenAIKey(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('OPENAI_API_KEY') || null
    } else {
      return process.env.OPENAI_API_KEY || null
    }
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
   */
  isEnabled(): boolean {
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
    if (!this.enabled || !this.logger) return { parent: undefined }
    
    // Apply sampling rate without affecting global enabled state
    // This allows per-session sampling decisions
    if (Math.random() > this.sampleRate) {
      return { parent: undefined }
    }
    
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
    if (!this.enabled || !this.logger) return
    
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
      if (process.env.NODE_ENV === 'development') {
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
    if (!this.enabled || !this.logger) return
    
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
    } catch (error) {
      Logging.log('BraintrustEventCollector', `Failed to end session: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }
  
  /**
   * Manually flush pending events to Braintrust
   * Usually not needed as SDK auto-batches, but useful before shutdown
   */
  async flush(): Promise<void> {
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
