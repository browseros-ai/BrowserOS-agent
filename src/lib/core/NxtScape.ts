import { z } from "zod";
import { EventBus, EventProcessor } from "@/lib/events";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/profiler";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { PocAgent } from "@/lib/agent/PocAgent";
import { isPocMode } from "@/config";
import { langChainProvider } from "@/lib/llm/LangChainProvider";

// Import telemetry module - only used if enabled
import { BraintrustEventCollector } from "@/evals/online/BraintrustEventCollector";

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
  tabIds: z.array(z.number()).optional(), // Optional array of tab IDs for context (e.g., which tabs to summarize) - NOT for agent operation
  eventBus: z.instanceof(EventBus), // EventBus for streaming updates
  eventProcessor: z.instanceof(EventProcessor), // EventProcessor for high-level event handling
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
  private browserAgent: BrowserAgent | PocAgent | null = null; // The browser agent for task execution

  private currentQuery: string | null = null; // Track current query for better cancellation messages
  
  // Telemetry session management for conversation tracking
  private telemetrySessionId: string | null = null;
  private telemetryParentSpan: string | null = null;
  private telemetry: BraintrustEventCollector | null = null; // Direct use of BraintrustEventCollector
  private conversationStartTime: number = 0;
  private taskCount: number = 0; // Track number of tasks in conversation
  private taskStartTime: number = 0; // Track individual task timing

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
        // Use PocAgent if in POC mode, otherwise use BrowserAgent
        if (isPocMode()) {
          this.browserAgent = new PocAgent(this.executionContext);
          Logging.log("NxtScape", "Using PocAgent (POC mode enabled)");
        } else {
          this.browserAgent = new BrowserAgent(this.executionContext);
        }
        
        // Initialize telemetry session for conversation tracking (this logs status)
        await this._initializeTelemetrySession();

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
   * Processes a user query with streaming support.
   * Always uses streaming execution for real-time progress updates.
   *
   * @param options - Run options including query, optional tabIds, and eventBus
   * @returns Result of the processed query with success/error status
   */
  public async run(options: RunOptions): Promise<NxtScapeResult> {
    profileStart("NxtScape.run");
    // Ensure the agent is initialized before running
    if (!this.isInitialized()) {
        await this.initialize();
    }

    const parsedOptions = RunOptionsSchema.parse(options);
    const { query, tabIds, eventBus, eventProcessor } = parsedOptions;

    const runStartTime = Date.now();

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

    // Update the event bus and event processor for this execution
    this.executionContext.setEventBus(eventBus);
    this.executionContext.setEventProcessor(eventProcessor);

    // Set selected tab IDs for context (e.g., for summarizing multiple tabs)
    // These are NOT the tabs the agent operates on, just context for tools like ExtractTool
    this.executionContext.setSelectedTabIds(tabIds || [currentTabId]);
    this.currentQuery = query;
    
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
            selectedTabIds: tabIds || [currentTabId],
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

    try {
      // Check that browser agent is initialized
      if (!this.browserAgent) {
        throw new Error("BrowserAgent not initialized");
      }

      // Execute the browser agent with the task
      await this.browserAgent.execute(query);
      
      // Log task completion with telemetry
      if (this.telemetry?.isEnabled() && this.telemetryParentSpan) {
        const taskDuration = Date.now() - this.taskStartTime;
        await this.telemetry.logEvent({
          type: 'decision_point',
          name: `task_${this.taskCount}_complete`,
          data: {
            task: query,
            taskNumber: this.taskCount,
            duration_ms: taskDuration,
            success: true,
            phase: 'task_complete'
          }
        }, {
          parent: this.telemetryParentSpan,
          name: `task_${this.taskCount}_complete`
        });
        
        console.log(`%c✓ Task ${this.taskCount} complete (${taskDuration}ms)`, 'color: #00ff00; font-size: 10px');
      }
      
      // BrowserAgent handles all logging and result management internally
      Logging.log("NxtScape", "Agent execution completed");
      
      // Return success result
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wasCancelled = error instanceof Error && error.name === "AbortError";

      if (wasCancelled) {
        Logging.log("NxtScape", `Execution cancelled: ${errorMessage}`);
      } else {
        Logging.log("NxtScape", `Execution error: ${errorMessage}`, "error");
      }
      
      // Log task error with telemetry
      if (this.telemetry?.isEnabled() && this.telemetryParentSpan && !wasCancelled) {
        const taskDuration = Date.now() - this.taskStartTime;
        await this.telemetry.logEvent({
          type: 'error',
          name: `task_${this.taskCount}_error`,
          data: {
            task: query,
            taskNumber: this.taskCount,
            duration_ms: taskDuration,
            error: errorMessage,
            wasCancelled
          }
        }, {
          parent: this.telemetryParentSpan,
          name: `task_${this.taskCount}_error`
        });
        
        console.log(`%c✗ Task ${this.taskCount} failed: ${errorMessage}`, 'color: #ff0000; font-size: 10px');
      }
      
      // Return error result
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      // Always mark execution as ended
      this.executionContext.endExecution();
      this.currentQuery = null;

      // Unlock browser context and update to active tab
      profileStart("NxtScape.cleanup");
      await this.browserContext.unlockExecution();

      profileEnd("NxtScape.cleanup");
      profileEnd("NxtScape.run");
      Logging.log(
        "NxtScape",
        `Total execution time: ${Date.now() - runStartTime}ms`,
      );
    }
  }


  public isRunning(): boolean {
    return this.executionContext.isExecuting();
  }

  /**
   * Cancel the currently running task
   * @returns Object with cancellation info including the query that was cancelled
   */
  public cancel(): { wasCancelled: boolean; query?: string } {
    if (this.executionContext && !this.executionContext.abortController.signal.aborted) {
      const cancelledQuery = this.currentQuery;
      Logging.log(
        "NxtScape",
        `User cancelling current task execution: "${cancelledQuery}"`,
      );
      this.executionContext.cancelExecution(
        /*isUserInitiatedsCancellation=*/ true,
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

    // End current telemetry session and start a new one
    this._endTelemetrySession('user_reset');
    this.taskCount = 0; // Reset task counter for new conversation
    this._initializeTelemetrySession();

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
      
      // Start conversation-level session
      const { parent } = await this.telemetry.startSession({
        sessionId: this.telemetrySessionId,
        task: 'conversation_session',  // Special marker for conversation sessions
        timestamp: this.conversationStartTime,
        browserInfo: {
          version: typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'unknown',
          tabCount: 0  // Will be updated with actual tab count later
        }
      });
      
      this.telemetryParentSpan = parent || null;
      
      // Telemetry session started
      if (this.telemetryParentSpan) {
        console.log('%c✓ Telemetry session initialized', 'color: #00ff00; font-size: 10px');
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
      
      await this.telemetry.endSession(this.telemetryParentSpan, this.telemetrySessionId, {
        success: true,
        summary: `Conversation ended: ${reason}`,
        duration_ms: duration,
        toolsUsed: [`${this.taskCount} tasks completed`]
      });
      
      console.log(`%c← Telemetry session ended (${reason})`, 'color: #888; font-size: 10px');
      
      // Clear telemetry state
      this.telemetrySessionId = null;
      this.telemetryParentSpan = null;
    } catch (error) {
      console.warn('Failed to end telemetry session:', error);
    }
  }

}
