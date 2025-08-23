import { z } from "zod";
import { PubSub } from "@/lib/pubsub";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/profiler";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";

// Import telemetry module - only used if enabled
import { BraintrustEventCollector } from "@/evals/online/BraintrustEventCollector";
// Import LLMJudge statically to avoid dynamic import issues in service worker
import { LLMJudge } from "@/evals/online/scoring/LLMJudge";
import { ExecutionMetadata } from "@/lib/types/messaging";

/**
 * Configuration schema for NxtScape agent
 */
export const NxtScapeConfigSchema = z.object({
  debug: z.boolean().default(false).optional(), // Debug mode flag
});

/**
 * Configuration type for NxtScape agent
 */
export type NxtScapeConfig = z.infer<typeof NxtScapeConfigSchema>;


/**
 * Schema for run method options
 */
export const RunOptionsSchema = z.object({
  query: z.string(), // Natural language user query
  mode: z.enum(['chat', 'browse']).optional(), // Execution mode
  tabIds: z.array(z.number()).optional(), // Optional array of tab IDs for context (e.g., which tabs to summarize) - NOT for agent operation
  metadata: z.any().optional(), // Execution metadata for controlling execution mode
});

export type RunOptions = z.infer<typeof RunOptionsSchema>;

/**
 * Result schema for NxtScape execution
 */
export const NxtScapeResultSchema = z.object({
  success: z.boolean(), // Whether the operation succeeded
  error: z.string().optional(), // Error message if failed
});

/**
 * Result type for NxtScape execution
 */
export type NxtScapeResult = z.infer<typeof NxtScapeResultSchema>;

/**
 * Main orchestration class for the NxtScape framework.
 * Manages execution context and delegates task execution to BrowserAgent.
 */
export class NxtScape {
  private readonly config: NxtScapeConfig;
  private browserContext: BrowserContext;
  private executionContext!: ExecutionContext; // Will be initialized in initialize()
  private messageManager!: MessageManager; // Will be initialized in initialize()
  private browserAgent: BrowserAgent | null = null; // The browser agent for task execution

  private currentQuery: string | null = null; // Track current query for better cancellation messages
  
  // Telemetry session management for conversation tracking
  private telemetrySessionId: string | null = null;
  private telemetryParentSpan: string | null = null;
  private telemetry: BraintrustEventCollector | null = null; // Direct use of BraintrustEventCollector
  private conversationStartTime: number = 0;
  private taskCount: number = 0; // Track number of tasks in conversation
  private taskStartTime: number = 0; // Track individual task timing
  private sessionWeightedTotals: number[] = []; // Track all weighted_total scores for session average

  /**
   * Creates a new NxtScape orchestration agent
   * @param config - Configuration for the NxtScape agent
   */
  constructor(config: NxtScapeConfig) {
    // Validate config with Zod schema
    this.config = NxtScapeConfigSchema.parse(config);

    // Create new browser context with vision configuration
    this.browserContext = new BrowserContext({
      useVision: true,
    });

    // Initialize logging
    Logging.initialize({ debugMode: this.config.debug || false });
  }

  /**
   * Asynchronously initialize components that require async operations
   * like browser context and page creation. Only initializes once.
   */
  public async initialize(): Promise<void> {
    // Skip initialization if already initialized to preserve conversation state
    if (this.isInitialized()) {
      Logging.log("NxtScape", "NxtScape already initialized, skipping...");
      return;
    }

    await profileAsync("NxtScape.initialize", async () => {
      try {
        // BrowserContextV2 doesn't need initialization
        
        // Get model capabilities to set appropriate token limit
        const modelCapabilities = await langChainProvider.getModelCapabilities();
        const maxTokens = modelCapabilities.maxTokens;
        
        Logging.log("NxtScape", `Initializing MessageManager with ${maxTokens} token limit`);
        
        // Initialize message manager with correct token limit
        this.messageManager = new MessageManager(maxTokens);
        
        // Create execution context with properly configured message manager
        this.executionContext = new ExecutionContext({
          browserContext: this.browserContext,
          messageManager: this.messageManager,
          debugMode: this.config.debug || false,
        });
        
        // Initialize the browser agent with execution context
        this.browserAgent = new BrowserAgent(this.executionContext);
        
        // Note: Telemetry session initialization is deferred until first task execution
        // This prevents creating empty sessions when extension is just opened/closed

        Logging.log(
          "NxtScape",
          "NxtScape initialization completed successfully",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Logging.log(
          "NxtScape",
          `Failed to initialize: ${errorMessage}`,
          "error",
        );

        // Clean up partial initialization
        this.browserContext = null as any;
        this.browserAgent = null;

        throw new Error(`NxtScape initialization failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Check if the agent is initialized and ready
   * @returns True if initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.browserContext !== null && this.browserAgent !== null;
  }

  /**
   * Set chat mode (for backward compatibility)
   * @param enabled - Whether chat mode is enabled
   */
  public setChatMode(enabled: boolean): void {
    this.executionContext.setChatMode(enabled);
  }

  /**
   * Prepares the execution environment
   * @private
   */
  private async _prepareExecution(options: RunOptions): Promise<{
    query: string;
    mode: 'chat' | 'browse';
    tabIds: number[] | undefined;
    metadata: any;
    currentTabId: number;
    startTime: number;
  }> {
    // Ensure initialization
    if (!this.isInitialized()) {
        await this.initialize();
    }

    const parsedOptions = RunOptionsSchema.parse(options);
    const { query, tabIds, mode = 'browse', metadata } = parsedOptions;

    const startTime = Date.now();

    Logging.log(
      "NxtScape",
      `Processing user query with unified classification: ${query}${
        tabIds ? ` (${tabIds.length} tabs)` : ""
      }`,
    );

    if (!this.browserContext) {
      throw new Error("NxtScape.initialize() must be awaited before run()");
    }

    if (this.isRunning()) {
      Logging.log(
        "NxtScape",
        "Another task is already running. Cleaning up...",
      );
      this._internalCancel();
    }

    // Reset abort controller if it's aborted (from pause or previous execution)
    if (this.executionContext.abortController.signal.aborted) {
      this.executionContext.resetAbortController();
    }

    // Always get the current page from browser context - this is the tab the agent will operate on
    profileStart("NxtScape.getCurrentPage");
    const currentPage = await this.browserContext.getCurrentPage();
    const currentTabId = currentPage.tabId;
    profileEnd("NxtScape.getCurrentPage");

    // Lock browser context to the current tab to prevent tab switches during execution
    this.browserContext.lockExecutionToTab(currentTabId);

    // Mark execution as started
    this.executionContext.startExecution(currentTabId);

    // Set selected tab IDs for context (e.g., for summarizing multiple tabs)
    // These are NOT the tabs the agent operates on, just context for tools like ExtractTool
    this.executionContext.setSelectedTabIds(tabIds || [currentTabId]);

    // Publish running status
    PubSub.getInstance().publishExecutionStatus('running');

    return { query, mode, tabIds, metadata, currentTabId, startTime };
  }

  /**
   * Executes the appropriate agent based on mode
   * @private
   */
  private async _executeAgent(query: string, mode: 'chat' | 'browse', metadata?: any, tabIds?: number[]): Promise<void> {
    // Chat mode is not currently implemented, always use browse mode
    if (mode === 'chat') {
      throw new Error('Chat mode is not currently implemented');
    }
    this.currentQuery = query;
    
    // Initialize telemetry session on first task if not already initialized
    // This ensures we only create sessions when there's actual work
    if (!this.telemetrySessionId) {
      await this._initializeTelemetrySession();
    }
    
    // Track task start with telemetry
    if (this.telemetry?.isEnabled() && this.telemetryParentSpan) {
      try {
        // Log this task as a child of the conversation
        this.taskCount++;
        this.taskStartTime = Date.now();
        
        // Log task start event
        await this.telemetry.logEvent({
          type: 'decision_point',
          name: `task_${this.taskCount}_start`,
          data: {
            task: query,
            taskNumber: this.taskCount,
            selectedTabIds: tabIds || [],
            conversationSessionId: this.telemetrySessionId,
            phase: 'task_start'
          }
        }, {
          parent: this.telemetryParentSpan,
          name: `task_${this.taskCount}_start`
        });
        
        console.log(`%c→ Task ${this.taskCount}: "${query.substring(0, 40)}..."`, 'color: #00ff00; font-size: 10px');
      } catch (error) {
        console.warn('Failed to create task span:', error);
      }
    }
    
    // Pass telemetry to execution context for BrowserAgent
    this.executionContext.telemetry = this.telemetry;
    this.executionContext.parentSpanId = this.telemetryParentSpan;
    
    // Ensure execution context is set in telemetry for enrichment
    if (this.telemetry && this.executionContext) {
      this.telemetry.setExecutionContext(this.executionContext);
    }

    try {
      // Check that browser agent is initialized
      if (!this.browserAgent) {
        throw new Error("BrowserAgent not initialized");
      }

      // Execute the browser agent with the task
      await this.browserAgent.execute(query, metadata as ExecutionMetadata | undefined);
      
      // Log task completion with telemetry and holistic scoring
      if (this.telemetry?.isEnabled() && this.telemetryParentSpan) {
        const taskDuration = Date.now() - this.taskStartTime;
        
        // Finalize task with scoring and telemetry
        await this._finalizeTask("success", query, "Task completed successfully");
      }
      
      // BrowserAgent handles all logging and result management internally
      Logging.log("NxtScape", "Agent execution completed");
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wasCancelled = error instanceof Error && error.name === "AbortError";

      if (wasCancelled) {
        Logging.log("NxtScape", `Execution cancelled: ${errorMessage}`);
      } else {
        Logging.log("NxtScape", `Execution error: ${errorMessage}`, "error");
      }
      
      // Publish error status
      PubSub.getInstance().publishExecutionStatus('error', errorMessage);
      
      // Publish user-facing error message
      const errorMsg = PubSub.createMessage(
        `❌ Error: ${errorMessage}`,
        'error'
      );
      PubSub.getInstance().publishMessage(errorMsg);
    }
  }

  /**
   * Cleans up after execution
   * @private
   */
  private async _cleanupExecution(startTime: number): Promise<void> {
    // End execution context
    this.executionContext.endExecution();
    
    // Unlock browser context
    profileStart("NxtScape.cleanup");
    await this.browserContext.unlockExecution();
    profileEnd("NxtScape.cleanup");
    
    // Log execution time
    Logging.log(
      "NxtScape",
      `Total execution time: ${Date.now() - startTime}ms`,
    );
  }

  /**
   * Processes a user query with streaming support.
   * Always uses streaming execution for real-time progress updates.
   *
   * @param options - Run options including query, optional tabIds, and mode
   */
  public async run(options: RunOptions): Promise<void> {
    profileStart("NxtScape.run");
    
    let executionContext: {
      query: string;
      mode: 'chat' | 'browse';
      tabIds: number[] | undefined;
      metadata: any;
      currentTabId: number;
      startTime: number;
    } | null = null;

    try {
      // Phase 1: Prepare execution
      executionContext = await this._prepareExecution(options);
      
      // Phase 2: Execute agent
      await this._executeAgent(executionContext.query, executionContext.mode, executionContext.metadata, executionContext.tabIds);
      
      // Success: Publish done status
      PubSub.getInstance().publishExecutionStatus('done');
      
    } catch (error) {
      // Phase 3: Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wasCancelled = error instanceof Error && error.name === "AbortError";
      
      if (wasCancelled) {
        Logging.log("NxtScape", `Execution cancelled: ${errorMessage}`);
      } else {
        Logging.log("NxtScape", `Execution error: ${errorMessage}`, "error");
      }
      
      // Publish error status
      PubSub.getInstance().publishExecutionStatus('error', errorMessage);
      
      // Log task error with telemetry and holistic scoring
      if (this.telemetry?.isEnabled() && this.telemetryParentSpan && !wasCancelled && executionContext) {
        // Finalize task with scoring and telemetry - pass the full error object
        await this._finalizeTask("error", executionContext.query, "Task failed", error);
      }
    } finally {
      // Phase 4: Always cleanup
      if (executionContext) {
        await this._cleanupExecution(executionContext.startTime);
      }
      profileEnd("NxtScape.run");
    }
  }


  public isRunning(): boolean {
    return this.executionContext.isExecuting();
  }

  /**
   * Cancel the currently running task
   * @returns Object with cancellation info including the query that was cancelled
   */
  public async cancel(): Promise<{ wasCancelled: boolean; query?: string }> {
    if (this.executionContext && !this.executionContext.abortController.signal.aborted) {
      const cancelledQuery = this.currentQuery;
      Logging.log(
        "NxtScape",
        `User cancelling current task execution: "${cancelledQuery}"`,
      );
      
      // Log task paused event with telemetry and holistic scoring
      if (this.telemetry?.isEnabled() && this.telemetryParentSpan && this.taskCount > 0) {
        const taskDuration = Date.now() - this.taskStartTime;
        
        // Finalize task with scoring and telemetry
        await this._finalizeTask("paused", cancelledQuery || "", "Task paused by user");
      }
      
      this.executionContext.cancelExecution(
        /*isUserInitiatedsCancellation=*/ true,
      );
      
      // Emit a friendly pause message so UI shows clear state
      PubSub.getInstance().publishMessage(
        PubSub.createMessageWithId(
          'pause_message_id',
          '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!',
          'assistant'
        )
      );
      
      return { wasCancelled: true, query: cancelledQuery || undefined };
    }

    return { wasCancelled: false };
  }

  /**
   * Internal cancellation method for cleaning up previous executions
   * This is NOT user-initiated and is used when starting a new task
   * to ensure clean state by cancelling any ongoing work.
   * @private
   */
  private _internalCancel(): void {
    if (this.executionContext && !this.executionContext.abortController.signal.aborted) {
      Logging.log(
        "NxtScape",
        "Internal cleanup: cancelling previous execution",
      );
      // false = not user-initiated, this is internal cleanup
      this.executionContext.cancelExecution(false);
    }
  }

  /**
   * Get the current execution status
   * @returns Object with execution status information
   */
  public getExecutionStatus(): {
    isRunning: boolean;
    lockedTabId: number | null;
    query: string | null;
  } {
    return {
      isRunning: this.isRunning(),
      lockedTabId: this.executionContext.getLockedTabId(),
      query: this.currentQuery,
    };
  }

  /**
   * Clear conversation history (useful for reset functionality)
   */
  public reset(): void {
    // stop the current task if it is running
    if (this.isRunning()) {
      this.cancel();
    }

    // Clear current query to ensure clean state
    this.currentQuery = null;

    // End current telemetry session if one exists
    if (this.telemetrySessionId) {
      this._endTelemetrySession('user_reset');
    }
    this.taskCount = 0; // Reset task counter for new conversation
    // Note: New session will be created on next task execution

    // Recreate MessageManager to clear history
    this.messageManager.clear();

    // reset the execution context
    this.executionContext.reset();

    // forces initalize of nextscape again
    // this would pick-up new mew message mangaer context length, etc
    this.browserAgent = null;

    Logging.log(
      "NxtScape",
      "Conversation history and state cleared completely",
    );
  }
  
  /**
   * Initialize telemetry session for conversation tracking
   * This creates a parent session that spans multiple tasks
   */
  private async _initializeTelemetrySession(): Promise<void> {
    try {
      // Get telemetry instance (singleton)
      this.telemetry = BraintrustEventCollector.getInstance();
      
      // Check if telemetry is enabled (this now does lazy initialization)
      if (!this.telemetry.isEnabled()) {
        // Silent when disabled - no logs
        this.telemetry = null;
        return;
      }
      this.conversationStartTime = Date.now();
      this.telemetrySessionId = crypto.randomUUID();
      
      // Reset session scores for new conversation
      this.sessionWeightedTotals = [];
      
      // Start conversation-level session with actual user query
      const { parent } = await this.telemetry.startSession({
        sessionId: this.telemetrySessionId,
        task: this.currentQuery || 'No query provided',  // Use actual user query as task
        timestamp: this.conversationStartTime,
        browserInfo: {
          version: typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'unknown',
          tabCount: 0  // Will be updated with actual tab count later
        }
      });
      
      this.telemetryParentSpan = parent || null;
      
      // Set execution context for event enrichment
      if (this.executionContext) {
        this.telemetry.setExecutionContext(this.executionContext);
      }
      
      // Telemetry session started
      if (this.telemetryParentSpan) {
        console.log('%c✓ Telemetry session initialized (first task)', 'color: #00ff00; font-size: 10px');
        console.log(`%c  Session ID: ${this.telemetrySessionId}`, 'color: #888; font-size: 10px');
      }
      
    } catch (error) {
      // Telemetry initialization failed silently
    }
  }
  
  /**
   * End the current telemetry session
   * @param reason - Why the session is ending (reset, close, timeout, etc.)
   */
  private async _endTelemetrySession(reason: string = 'unknown'): Promise<void> {
    if (!this.telemetry?.isEnabled() || !this.telemetrySessionId || !this.telemetryParentSpan) {
      return;
    }
    
    try {
      const duration = Date.now() - this.conversationStartTime;
      
      // Calculate average weighted_total for session success score
      const avgSuccess = this.sessionWeightedTotals.length > 0
        ? this.sessionWeightedTotals.reduce((sum, score) => sum + score, 0) / this.sessionWeightedTotals.length
        : 1.0  // Default to 1.0 if no scores available
      
      console.log(`%c📈 Session average success: ${avgSuccess.toFixed(2)} from ${this.sessionWeightedTotals.length} tasks`, 'color: #4caf50; font-weight: bold; font-size: 11px')
      
      await this.telemetry.endSession(this.telemetryParentSpan, this.telemetrySessionId, {
        success: true,
        summary: `Conversation ended: ${reason}`,
        duration_ms: duration,
        userScore: avgSuccess  // Pass average as userScore for now
      });
      
      console.log(`%c← Telemetry session ended (${reason})`, 'color: #888; font-size: 10px');
      
      // Clear telemetry state
      this.telemetrySessionId = null;
      this.telemetryParentSpan = null;
      this.sessionWeightedTotals = [];  // Reset scores for next session
    } catch (error) {
      console.warn('Failed to end telemetry session:', error);
    }
  }
  
  /**
   * Finalize task with scoring and telemetry (deduplicates code)
   * Used by success, error, and paused paths
   */
  private async _finalizeTask(
    outcome: 'success' | 'error' | 'paused',
    query: string,
    message: string,
    error?: any  // Can be Error object or string
  ): Promise<void> {
    if (!this.telemetry?.isEnabled()) return
    
    const taskDuration = Date.now() - this.taskStartTime
    
    // No need for EventEnricher - LLMJudge will access ExecutionContext directly
    const taskPhase = outcome === 'error' ? 'task_error' : outcome === 'paused' ? 'task_paused' : 'task_complete'
    
    // Score the task completion with LLM judge using full ExecutionContext
    let multiDimensionalScores: Record<string, number> | undefined
    let scoringDetails: any = undefined
    
    try {
      const judge = new LLMJudge()
      
      // Use the new method that accepts ExecutionContext directly
      if (this.executionContext) {
        const result = await judge.scoreTaskCompletionWithContext(
          query,
          this.executionContext,
          {
            outcome: outcome,
            duration_ms: taskDuration
          }
        )
        
        // Handle multi-dimensional scores
        if (result.scores && Object.keys(result.scores).length > 0) {
          multiDimensionalScores = result.scores
          scoringDetails = result.scoringDetails
        } else if (result.score >= 0) {
          // Fallback to single score if multi-dimensional not available
          multiDimensionalScores = {
            task_completion: result.score,
            weighted_total: result.score
          }
          scoringDetails = result.scoringDetails
        } else {
          console.log('%c→ No holistic score (API key missing or error)', 'color: #888; font-size: 10px')
        }
      }
    } catch (error) {
      console.error('Holistic scoring failed:', error)
    }
    
    // Build scores object with all dimensions
    const scores: Record<string, number> = {}
    
    // Add all multi-dimensional scores first (including weighted_total for this task)
    if (multiDimensionalScores) {
      Object.assign(scores, multiDimensionalScores)
      
      // Track weighted_total for session average calculation
      if (multiDimensionalScores.weighted_total !== undefined && multiDimensionalScores.weighted_total >= 0) {
        this.sessionWeightedTotals.push(multiDimensionalScores.weighted_total)
        console.log(`%c📊 Session scores so far: [${this.sessionWeightedTotals.map(s => s.toFixed(2)).join(', ')}]`, 'color: #9c27b0; font-size: 10px')
      }
    }
    
    // Add binary completion status as a separate metric
    scores.task_completed = outcome === 'success' ? 1.0 : 0.0
    
    // Don't set 'success' here - it will be calculated at session end as avg of all weighted_totals
    
    // Debug log to see what scores are being sent to Braintrust
    console.log('%c📤 Scores being sent to Braintrust:', 'color: #4caf50; font-weight: bold; font-size: 11px')
    console.log(JSON.stringify(scores, null, 2))
    
    // Determine event type and name based on outcome
    const eventType = outcome === 'error' ? 'error' : 'decision_point'
    const eventName = `task_${this.taskCount}_${outcome}`
    const phase = outcome === 'error' ? 'task_error' :
                 outcome === 'paused' ? 'task_paused' :
                 'task_complete'
    
    // Build event data with proper error structure for Braintrust
    const eventData: any = {
      task: query,
      taskNumber: this.taskCount,
      duration_ms: taskDuration,
      success: outcome === 'success',
      phase,
      ...(outcome === 'paused' && { reason: 'User clicked pause button' })
    }
    
    // Build the event object
    const event: any = {
      type: eventType,
      name: eventName,
      data: eventData,
      scores,
      ...(scoringDetails && { scoring_details: scoringDetails })
    }
    
    // Add structured error for Braintrust if this is an error outcome
    if (outcome === 'error' && error) {
      let errorName = 'TaskExecutionError'
      let errorMessage: string
      let errorStack: string | undefined
      
      // Handle Error objects vs string errors
      if (error instanceof Error) {
        errorName = error.name || 'Error'
        errorMessage = error.message
        errorStack = error.stack
      } else {
        // String error - try to parse it
        errorMessage = String(error)
        
        // Check if it's an LLM error (e.g., BadRequestError)
        if (errorMessage.includes('BadRequestError') || errorMessage.includes('Exception')) {
          errorName = 'LLMError'
          // Extract the actual error message
          const match = errorMessage.match(/(\w+Error): (.+?)(?:No fallback|$)/s)
          if (match) {
            errorName = match[1]
            errorMessage = match[2].trim()
          }
        }
      }
      
      // Add structured error for Braintrust's error tracking
      event.error = {
        name: errorName,
        message: errorMessage,
        stack: errorStack
      }
      
      // Also keep the original error in data for backward compatibility
      eventData.error = error instanceof Error ? error.message : error
    }
    
    // Log telemetry event
    await this.telemetry.logEvent(event, {
      parent: this.telemetryParentSpan || undefined,
      name: eventName
    })
    
    // Log status to console
    const statusIcon = outcome === 'success' ? '✓' : outcome === 'error' ? '✗' : '⏸'
    const statusColor = outcome === 'success' ? '#00ff00' : outcome === 'error' ? '#ff0000' : '#ffaa00'
    const statusMsg = outcome === 'error' ? `failed: ${error}` : outcome
    console.log(`%c${statusIcon} Task ${this.taskCount} ${statusMsg} (${taskDuration}ms)`, `color: ${statusColor}; font-size: 10px`)
  }

}
