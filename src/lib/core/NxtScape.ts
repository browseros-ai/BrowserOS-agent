import { z } from "zod";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/profiler";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { ChatAgent } from "@/lib/agent/ChatAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";

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
  mode: z.enum(['chat', 'browse']), // Execution mode: 'chat' for Q&A, 'browse' for automation
  tabIds: z.array(z.number()).optional(), // Optional array of tab IDs for context (e.g., which tabs to summarize) - NOT for agent operation
});

export type RunOptions = z.infer<typeof RunOptionsSchema>;

/**
 * Main orchestration class for the NxtScape framework.
 * Manages execution context and delegates task execution to BrowserAgent.
 */
export class NxtScape {
  private readonly config: NxtScapeConfig;
  private browserContext: BrowserContext;
  private executionContext!: ExecutionContext; // Will be initialized in initialize()
  private messageManager!: MessageManager; // Will be initialized in initialize()
  private browserAgent!: BrowserAgent; // Will be initialized in initialize()
  private chatAgent!: ChatAgent; // Will be initialized in initialize()

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
        this.chatAgent = new ChatAgent(this.executionContext);
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

        throw new Error(`NxtScape initialization failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Check if the agent is initialized and ready
   * @returns True if initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.browserContext !== null && !!this.browserAgent && !!this.chatAgent;
  }

  /**
   * Processes a user query with streaming support.
   * Always uses streaming execution for real-time progress updates.
   *
   * @param options - Run options including query, optional tabIds, and mode
   */
  public async run(options: RunOptions): Promise<void> {
    profileStart("NxtScape.run");
    // Ensure the agent is initialized before running
    if (!this.isInitialized()) {
        await this.initialize();
    }

    const parsedOptions = RunOptionsSchema.parse(options);
    const { query, tabIds, mode } = parsedOptions;

    const runStartTime = Date.now();

    Logging.log(
      "NxtScape",
      `Processing user query in ${mode} mode: ${query}${
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


    try {
      // Use explicit mode parameter for agent selection
      if (mode === 'chat') {
        await this.chatAgent.execute(query);
      } else {
        await this.browserAgent.execute(query);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wasCancelled = error instanceof Error && error.name === "AbortError";

      if (wasCancelled) {
        Logging.log("NxtScape", `Execution cancelled: ${errorMessage}`);
      } else {
        Logging.log("NxtScape", `Execution error: ${errorMessage}`, "error");
      }
      
      // Re-throw error so background script can handle if needed
      throw error;
    } finally {
      // Always mark execution as ended
      this.executionContext.endExecution();

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
   */
  public cancel(): void {
    if (this.executionContext) {
      Logging.log("NxtScape", "User cancelling current task execution");
      this.executionContext.cancelExecution(/*isUserInitiatedsCancellation=*/ true);
    }
  }

  /**
   * Internal cancellation method for cleaning up previous executions
   * This is NOT user-initiated and is used when starting a new task
   * to ensure clean state by cancelling any ongoing work.
   * @private
   */
  private _internalCancel(): void {
    if (this.executionContext) {
      Logging.log("NxtScape", "Internal cleanup: cancelling previous execution");
      // false = not user-initiated, this is internal cleanup
      this.executionContext.cancelExecution(false);
    }
  }

  /**
   * Enable or disable chat mode (Q&A mode)
   * @param enabled - Whether to enable chat mode
   */
  public setChatMode(enabled: boolean): void {
    if (this.executionContext) {
      this.executionContext.setChatMode(enabled);
      Logging.log("NxtScape", `Chat mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Check if chat mode is enabled
   * @returns Whether chat mode is enabled
   */
  public isChatMode(): boolean {
    return this.executionContext ? this.executionContext.isChatMode() : false;
  }

  /**
   * Get the current execution status
   * @returns Object with execution status information
   */
  public getExecutionStatus(): {
    isRunning: boolean;
    lockedTabId: number | null;
  } {
    return {
      isRunning: this.isRunning(),
      lockedTabId: this.executionContext.getLockedTabId(),
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

    // Recreate MessageManager to clear history
    this.messageManager.clear();

    // reset the execution context
    this.executionContext.reset();

    Logging.log(
      "NxtScape",
      "Conversation history and state cleared completely",
    );
  }

}
