import { z } from "zod";
import { StreamEventBus } from "@/lib/events";
import { Logging } from "@/lib/utils/Logging";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import MessageManager, {
  MessageManagerSettingsSchema,
} from "@/lib/runtime/MessageManager";
import { profileStart, profileEnd, profileAsync } from "@/lib/utils/Profiler";
import { Agent } from "@/lib/agent/Agent";
import { AgentInput } from "@/lib/agent/IAgent";

/**
 * Configuration schema for Controller
 */
export const ControllerConfigSchema = z.object({
  debug: z.boolean().default(false).optional(), // Debug mode flag
});

/**
 * Configuration type for Controller
 */
export type ControllerConfig = z.infer<typeof ControllerConfigSchema>;


/**
 * Schema for run method options
 */
export const RunOptionsSchema = z.object({
  query: z.string(), // Natural language user query
  tabIds: z.array(z.number()).optional(), // Optional array of tab IDs for context (e.g., which tabs to summarize) - NOT for agent operation
  eventBus: z.instanceof(StreamEventBus), // EventBus for streaming updates
});

export type RunOptions = z.infer<typeof RunOptionsSchema>;

/**
 * Main controller for the Nxtscape framework.
 * Handles user queries and delegates to the Agent for execution.
 */
export class Controller {
  private readonly config: ControllerConfig;
  private browserContext: BrowserContext;
  private executionContext: ExecutionContext;
  private abortController: AbortController; // Track current execution for cancellation
  private messageManager: MessageManager; // Clean conversation history management using MessageManager
  private agent: Agent; // The agent for handling tasks

  // All agents now managed by AgentGraph

  private currentQuery: string | null = null; // Track current query for better cancellation messages

  /**
   * Creates a new Controller
   * @param config - Configuration for the Controller
   */
  constructor(config: ControllerConfig) {
    // Validate config with Zod schema
    this.config = ControllerConfigSchema.parse(config);

    // Initialize message manager with reasonable settings
    const messageSettings = MessageManagerSettingsSchema.parse({
      maxInputTokens: 128000, // Default max tokens
      estimatedCharactersPerToken: 3,
      includeAttributes: [],
    });
    this.messageManager = new MessageManager(messageSettings);

    // Create new browser context with vision configuration
    this.browserContext = new BrowserContext({
      useVision: true,
    });

    // create new abort controller for this execution
    this.abortController = new AbortController();

    // Create new execution context
    this.executionContext = new ExecutionContext({
      browserContext: this.browserContext,
      messageManager: this.messageManager,
      debugMode: this.config.debug || false,
      abortController: this.abortController,
    });

    // Initialize logging
    Logging.initialize({ debugMode: this.config.debug || false });
    
    // Initialize the agent
    this.agent = new Agent();
  }

  /**
   * Asynchronously initialize components that require async operations
   * like browser context and page creation. Only initializes once.
   */
  public async initialize(): Promise<void> {
    // Skip initialization if already initialized to preserve conversation state
    if (this.isInitialized()) {
      Logging.log("Controller", "Controller already initialized, skipping...");
      return;
    }

    await profileAsync("NxtScape.initialize", async () => {
      try {
        // BrowserContextV2 doesn't need initialization

        Logging.log(
          "Controller",
          "Controller initialization completed successfully",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Logging.log(
          "Controller",
          `Failed to initialize: ${errorMessage}`,
          "error",
        );

        // Clean up partial initialization
        this.browserContext = null as any;

        throw new Error(`Controller initialization failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Check if the agent is initialized and ready
   * @returns True if initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.browserContext !== null;
  }

  /**
   * Processes a user query with streaming support.
   * Always uses streaming execution for real-time progress updates.
   *
   * @param options - Run options including query, optional tabIds, and eventBus
   */
  public async run(options: RunOptions): Promise<void> {
    const parsedOptions = RunOptionsSchema.parse(options);
    const { query, tabIds, eventBus } = parsedOptions;

    profileStart("NxtScape.run");
    const runStartTime = Date.now();

    Logging.log(
      "Controller",
      `Processing user query: ${query}${
        tabIds ? ` (${tabIds.length} tabs)` : ""
      }`,
    );

    if (!this.isInitialized()) {
      await this.initialize();
    }

    if (!this.browserContext) {
      throw new Error("Controller.initialize() must be awaited before run()");
    }

    if (this.isRunning()) {
      Logging.log(
        "Controller",
        "Another task is already running. Cleaning up...",
      );
      this._internalCancel();
    }

    // Only reset abort controller for new conversations or after user cancellation
    // NOT for follow-up tasks
    const isFollowUp = this.messageManager.getMessages().length > 0;
    if (!isFollowUp || this.executionContext.isUserCancellation()) {
      this.resetAbortController();
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

    // Set the event bus for this execution
    this.executionContext.setEventBus(eventBus);

    // Set selected tab IDs for context (e.g., for summarizing multiple tabs)
    // These are NOT the tabs the agent operates on, just context for tools like ExtractTool
    this.executionContext.setSelectedTabIds(tabIds || [currentTabId]);
    this.currentQuery = query;

    if (!isFollowUp) {
      // If it a new conversation, add SystemMessage as the first message
      // System messages are now added at the agent level (position 0) in each agent's executeAgent method
      this.messageManager.addTaskMessage(query);
    } else {
      // TODO(nithin): Ideally it would be better if we remove the previous task message to not confuse dummer models like ollama.
      // If not for a follow up task, there'll be two task messages -- first one like "Your ultimate task is to list tabs after you complete terminate"
      // and the second one like "Your NEW ultimate task is to close tabs after you complete terminate"
      this.messageManager.addFollowUpTaskMessage(query);
    }

    // Create follow-up context - MessageManager is our single source of truth
    const followUpContext = isFollowUp
      ? {
          isFollowUp: true,
          previousTaskType: this.messageManager.getPreviousTaskType(),
          previousPlan: this.messageManager.getPreviousPlan() || null,
          previousQuery: this.currentQuery,
        }
      : null;

    // Use unified classification-based execution with follow-up awareness
    Logging.log(
      "Controller",
      isFollowUp
        ? `Processing follow-up task after ${this.messageManager.getPreviousTaskType()} agent`
        : "Starting new task",
    );

    const startTime = Date.now();

    try {
      // Execute the browse agent
      const agentInput: AgentInput = {
        query,
        context: {
          tabIds: tabIds || [],
        },
      };
      
      const result = await this.agent.execute(
        agentInput,
        this.executionContext,
        eventBus,
        this.abortController.signal
      );
      
      // Log the result
      if (result.success) {
        Logging.log("Controller", `Agent execution successful: ${result.message || "No message"}`);
      } else {
        Logging.log("Controller", `Agent execution failed: ${result.error || "Unknown error"}`, "error");
      }
      
      // Agent type is now stored immediately after classification
      // This ensures it's saved even if the task is interrupted
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wasCancelled = error instanceof Error && error.name === "AbortError";

      if (wasCancelled) {
        Logging.log("Controller", `Execution cancelled: ${errorMessage}`);
      } else {
        Logging.log("Controller", `Execution error: ${errorMessage}`, "error");
      }
    } finally {
      // Always mark execution as ended
      this.executionContext.endExecution();
      this.currentQuery = null;

      // Unlock browser context and update to active tab
      profileStart("NxtScape.cleanup");
      await this.browserContext.unlockExecution();

      // Highlights not implemented in BrowserContextV2

      profileEnd("NxtScape.cleanup");

      // Clean up abort controller
      this.resetAbortController();

      profileEnd("NxtScape.run");
      Logging.log(
        "Controller",
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
    if (this.abortController && !this.abortController.signal.aborted) {
      const cancelledQuery = this.currentQuery;
      Logging.log(
        "Controller",
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
    if (this.abortController && !this.abortController.signal.aborted) {
      Logging.log(
        "Controller",
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

    // Recreate MessageManager to clear history
    this.messageManager.clear();

    // Force reset abort controller for new conversation
    this.executionContext.resetAbortController();
    this.abortController = this.executionContext.abortController;

    // Update executionContext with new message manager (eventBus will be set during run)
    this.executionContext = new ExecutionContext({
      browserContext: this.browserContext,
      messageManager: this.messageManager,
      debugMode: this.config.debug || false,
      abortController: this.abortController,
    });

    Logging.log(
      "Controller",
      "Conversation history and state cleared completely",
    );
  }

  /**
   * Reset the abort controller and update ExecutionContext
   * This ensures both NxtScape and ExecutionContext have fresh, non-aborted controllers
   */
  private resetAbortController(): void {
    this.executionContext.resetAbortController();
    this.abortController = this.executionContext.abortController;
    Logging.log("Controller", "Abort controller reset");
  }
}
