import { z } from "zod";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/profiler";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { ChatAgent } from "@/lib/agent/ChatAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";
import { PubSub } from "@/lib/pubsub/PubSub";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { initializeMemorySystem } from "@/lib/memory";
import { MemoryManager } from "@/lib/memory/MemoryManager";
import { getMemoryConfig } from "@/lib/memory/config";


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
  metadata: z.any().optional(), // Execution metadata for controlling execution mode
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
  private browserAgent: BrowserAgent | null = null; // The browser agent for task execution
  private memoryManager: MemoryManager | null = null; // Memory manager for task continuity
  private chatAgent: ChatAgent | null = null; // The chat agent for Q&A mode

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

        // Initialize memory system (optional, continues if fails)
        try {
          console.log("Initializing memory system...");
          const memoryConfig = getMemoryConfig();
          // console.log("Memory Configuration",memoryConfig);
          if (memoryConfig.enabled && memoryConfig.apiKey) {
            this.memoryManager = await initializeMemorySystem(
              memoryConfig.apiKey,
              `nxtscape`
            );
            Logging.log("NxtScape", "Memory system initialized successfully");
          } else {
            Logging.log(
              "NxtScape",
              "Memory system disabled (no API key or disabled in config)"
            );
          }
        } catch (error) {
          Logging.log(
            "NxtScape",
            `Memory system initialization failed: ${error}`,
            "warning"
          );
          this.memoryManager = null;
        }

        // Create execution context with properly configured message manager
        this.executionContext = new ExecutionContext({
          browserContext: this.browserContext,
          messageManager: this.messageManager,
          debugMode: this.config.debug || false,
          memoryManager: this.memoryManager || undefined,
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

    // Refresh token limit in case provider settings changed
    const modelCapabilities = await langChainProvider.getModelCapabilities();
    if (modelCapabilities.maxTokens !== this.messageManager.getMaxTokens()) {
      Logging.log("NxtScape", 
        `Updating MessageManager token limit from ${this.messageManager.getMaxTokens()} to ${modelCapabilities.maxTokens}`);
      this.messageManager.setMaxTokens(modelCapabilities.maxTokens);
    }

    const parsedOptions = RunOptionsSchema.parse(options);
    const { query, tabIds, mode, metadata } = parsedOptions;
    const startTime = Date.now();

    Logging.log(
      "NxtScape",
      `Processing user query in ${mode} mode: ${query}${
        tabIds ? ` (${tabIds.length} tabs)` : ""
      }`,
    );

    // Validate browser context
    if (!this.browserContext) {
      throw new Error("NxtScape.initialize() must be awaited before run()");
    }

    // Clean up any running task (after initialization ensures executionContext exists)
    if (this.isRunning()) {
      Logging.log("NxtScape", "Another task is already running. Cleaning up...");
      this._internalCancel();
    }

    // Reset abort controller if needed (executionContext guaranteed to exist after init)
    if (this.executionContext && this.executionContext.abortController.signal.aborted) {
      this.executionContext.resetAbortController();
    }

    // Get current page and lock execution
    profileStart("NxtScape.getCurrentPage");
    const currentPage = await this.browserContext.getCurrentPage();
    const currentTabId = currentPage.tabId;
    profileEnd("NxtScape.getCurrentPage");

    // Lock browser context to current tab
    this.browserContext.lockExecutionToTab(currentTabId);

    // Start execution context
    this.executionContext.startExecution(currentTabId);

    // Set selected tab IDs for context
    this.executionContext.setSelectedTabIds(tabIds || [currentTabId]);

    // Publish running status
    PubSub.getInstance().publishExecutionStatus('running');

    return { query, mode, tabIds, metadata, currentTabId, startTime };
  }

  /**
   * Executes the appropriate agent based on mode
   * @private
   */
  private async _executeAgent(query: string, mode: 'chat' | 'browse', metadata?: any): Promise<void> {
    if (mode === 'chat') {
      if (!this.chatAgent) {
        throw new Error('Chat agent not initialized');
      }
      await this.chatAgent.execute(query);
    } else {
      if (!this.browserAgent) {
        throw new Error('Browser agent not initialized');
      }
      await this.browserAgent.execute(query, metadata as ExecutionMetadata | undefined);
    }

    Logging.log("NxtScape", "Agent execution completed");
  }

  /**
   * Handles execution errors and publishes appropriate status
   * @private
   */
  private _handleExecutionError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const wasCancelled = error instanceof Error && error.name === "AbortError";

    if (wasCancelled) {
      Logging.log("NxtScape", `Execution cancelled: ${errorMessage}`);
      PubSub.getInstance().publishExecutionStatus('cancelled', errorMessage);
    } else {
      Logging.log("NxtScape", `Execution error: ${errorMessage}`, "error");
      
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
      await this._executeAgent(executionContext.query, executionContext.mode, executionContext.metadata);
      
      // Success: Publish done status
      PubSub.getInstance().publishExecutionStatus('done');
      
    } catch (error) {
      // Phase 3: Handle errors
      this._handleExecutionError(error);
    } finally {
      // Phase 4: Always cleanup
      if (executionContext) {
        await this._cleanupExecution(executionContext.startTime);
      }
      profileEnd("NxtScape.run");
    }
  }


  public isRunning(): boolean {
    return this.executionContext && this.executionContext.isExecuting();
  }

  /**
   * Cancel the currently running task
   */
  public cancel(): void {
    if (this.executionContext) {
      Logging.log("NxtScape", "User cancelling current task execution");
      this.executionContext.cancelExecution( true);
      
      // Publish cancelled status with message
      PubSub.getInstance().publishExecutionStatus('cancelled', 'Task cancelled by user');
      // Emit a friendly pause message so UI shows clear state
      PubSub.getInstance().publishMessage(
        PubSub.createMessageWithId(
          'pause_message_id',
          '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!',
          'assistant'
        )
      );
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
    // 1. Stop current task if running
    if (this.isRunning()) {
      // Use internal cancel to avoid publishing status
      this._internalCancel();
    }
    
    // 2. Clean up existing agents (call cleanup to unsubscribe)
    if (this.browserAgent) {
      this.browserAgent.cleanup();
      this.browserAgent = null;
    }
    if (this.chatAgent) {
      this.chatAgent.cleanup();
      this.chatAgent = null;
    }
    
    // 3. Clear PubSub buffer only (NOT subscribers - UI needs to stay subscribed!)
    PubSub.getInstance().clearBuffer();

    // 4. Clear message history
    this.messageManager.clear();

    // 5. Reset execution context and abort controller
    this.executionContext.reset();
    // Ensure abort controller is reset for next run
    if (this.executionContext.abortController.signal.aborted) {
      this.executionContext.resetAbortController();
    }
    
    // 6. Recreate agents with fresh state (they will subscribe themselves)
    this.browserAgent = new BrowserAgent(this.executionContext);
    this.chatAgent = new ChatAgent(this.executionContext);

    Logging.log(
      "NxtScape",
      "Conversation history and state cleared completely",
    );
  }

}