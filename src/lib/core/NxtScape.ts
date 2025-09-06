import { z } from "zod";
import { PubSub } from "@/lib/pubsub";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/profiler";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";

// Import evals2 components
import { SimpleBraintrustEventManager, SimplifiedScorer } from "@/evals2";
import { TokenCounter } from "@/lib/utils/TokenCounter";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { ENABLE_EVALS2 } from "@/config";

/**
 * Configuration schema for NxtScape agent
 */
export const NxtScapeConfigSchema = z.object({
  debug: z.boolean().default(false).optional(), // Debug mode flag
  experimentId: z.string().optional(), // Optional experiment ID for logging to experiments
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
  
  // Evals2 simplified evaluation components
  private evals2Manager: SimpleBraintrustEventManager | null = null;
  private evals2Enabled: boolean = false;
  private telemetrySessionId: string | null = null; // For evals2 session tracking
  private telemetryParentSpan: string | null = null; // For evals2 parent span
  private taskStartTime: number = 0; // Track individual task timing
  private taskCount: number = 0; // Track number of tasks in conversation

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
    
    // Track task start for evals2
    if (this.evals2Enabled) {
      this.taskCount++;
      this.taskStartTime = Date.now();
      console.log(`%c→ Task ${this.taskCount}: "${query.substring(0, 40)}..."`, 'color: #00ff00; font-size: 10px');
    }
    
    // Pass evals2 parent span to execution context for tool wrapping
    this.executionContext.parentSpanId = this.telemetryParentSpan;
    

    try {
      // Check that browser agent is initialized
      if (!this.browserAgent) {
        throw new Error("BrowserAgent not initialized");
      }

      // Execute the browser agent with the task
      await this.browserAgent.execute(query, metadata as ExecutionMetadata | undefined);
      
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
    } finally {
      // Add evals2 scoring if enabled - runs even if task was paused or errored
      if (this.evals2Enabled && this.evals2Manager) {
        const taskEndTime = Date.now();
        const duration = this.taskStartTime ? taskEndTime - this.taskStartTime : 0;
        
        try {
          // Score the task
          const scorer = new SimplifiedScorer();
          const messages = this.messageManager.getMessages();
          const score = await scorer.scoreFromMessages(
            messages,
            query,
            this.executionContext.toolMetrics,  // Pass tool metrics for duration data
            duration  // Pass actual task execution duration
          );
          
          // Calculate context metrics using TokenCounter for accuracy
          const messageCount = messages.length;
          const totalCharacters = messages.reduce((sum, msg) => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return sum + content.length;
          }, 0);
          const estimatedTokens = TokenCounter.countMessages(messages); // Use proper token counting
          
          // Log to console with more details
          console.log('Evals2 Score:', {
            goal: score.goalCompletion.toFixed(2),
            plan: score.planCorrectness.toFixed(2),
            errors: score.errorFreeExecution.toFixed(2),
            context: score.contextEfficiency.toFixed(2),
            total: score.weightedTotal.toFixed(2),
            messages: messageCount,
            tokens: estimatedTokens
          });
          
          // Upload to Braintrust with parent span and context metrics
          const { braintrustLogger } = await import('@/evals2/BraintrustLogger');
          await braintrustLogger.logTaskScore(
            query,
            score,
            duration,
            {
              selectedTabIds: tabIds || [],
              mode: mode || 'browse'
            },
            this.telemetryParentSpan || undefined,
            {
              messageCount,
              totalCharacters,
              estimatedTokens
            }
          );
          
          // Add score to session manager for averaging
          this.evals2Manager.addTaskScore(score.weightedTotal);
          
        } catch (error) {
          console.warn('Evals2 scoring failed:', error);
          // Don't break execution if scoring fails
        }
      }
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
      
      // Error scoring handled by evals2 if enabled
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
      
      // Pause scoring handled by evals2 if enabled
      
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
   * Initialize evals2 session for conversation tracking
   * This creates a parent session that spans multiple tasks
   */
  private async _initializeTelemetrySession(): Promise<void> {
    // Check if evals2 is enabled
    this.evals2Enabled = ENABLE_EVALS2;
    
    if (!this.evals2Enabled) {
      return;
    }
    
    // Use simplified evals2 system
    try {
      this.evals2Manager = SimpleBraintrustEventManager.getInstance();
      
      if (!this.evals2Manager.isEnabled()) {
        this.evals2Manager = null;
        this.evals2Enabled = false;
        return;
      }
      
      const sessionId = crypto.randomUUID();
      const { parent } = await this.evals2Manager.startSession({
        sessionId,
        task: this.currentQuery || 'No query provided',
        timestamp: Date.now(),
        agentVersion: typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'unknown'
      });
      
      this.telemetrySessionId = sessionId;
      this.telemetryParentSpan = parent || null;
      
      // Also update execution context for tool wrapping
      if (this.executionContext) {
        this.executionContext.parentSpanId = this.telemetryParentSpan;
      }
    } catch (error) {
      // Silent failure
      this.evals2Enabled = false;
    }
  }
  
  /**
   * End the current evals2 session
   * @param reason - Why the session is ending (reset, close, timeout, etc.)
   */
  private async _endTelemetrySession(reason: string = 'unknown'): Promise<void> {
    // Handle evals2 session end
    if (this.evals2Enabled && this.evals2Manager) {
      await this.evals2Manager.endSession(reason);
      this.telemetrySessionId = null;
      this.telemetryParentSpan = null;
    }
  }
  
}
