import { z } from "zod";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { NewAgent } from "@/lib/agent/NewAgent";
import { ChatAgent } from "@/lib/agent/ChatAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";
import { Logging } from "@/lib/utils/Logging";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { isPocMode } from "@/config";

// Execution options schema
export const ExecutionOptionsSchema = z.object({
  executionId: z.string(), // Unique execution identifier
  mode: z.enum(["chat", "browse"]), // Execution mode
  tabId: z.number().optional(), // Target tab ID
  tabIds: z.array(z.number()).optional(), // Multiple tab context
  metadata: z.any().optional(), // Additional execution metadata
  debug: z.boolean().default(false), // Debug mode flag
});

export type ExecutionOptions = z.infer<typeof ExecutionOptionsSchema>;

/**
 * Represents a single, isolated execution instance.
 * Each execution has its own persistent conversation (MessageManager) and browser context.
 * Fresh ExecutionContext and agents are created per run.
 */
export class Execution {
  readonly id: string;
  private browserContext: BrowserContext | null = null;
  private messageManager: MessageManager | null = null;
  private pubsub: PubSubChannel | null = null;
  private options: ExecutionOptions;
  private currentAbortController: AbortController | null = null;

  constructor(options: ExecutionOptions, pubsub: PubSubChannel) {
    this.options = ExecutionOptionsSchema.parse(options);
    this.id = this.options.executionId;
    this.pubsub = pubsub;
    Logging.log(
      "Execution",
      `Created execution ${this.id} in ${this.options.mode} mode`,
    );
  }

  /**
   * Ensure persistent resources are initialized
   * Creates browser context and message manager if needed
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this.browserContext) {
      this.browserContext = new BrowserContext({
        useVision: true,
      });
    }

    if (!this.messageManager) {
      const modelCapabilities = await langChainProvider.getModelCapabilities();
      this.messageManager = new MessageManager(modelCapabilities.maxTokens);
    }
  }

  /**
   * Run the execution with the given query
   * @param query - The user's query to execute
   * @param metadata - Optional execution metadata
   */
  async run(query: string, metadata?: ExecutionMetadata): Promise<void> {
    // Cancel any current execution
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // Ensure persistent resources exist
    await this._ensureInitialized();

    // Create fresh abort controller for this run
    this.currentAbortController = new AbortController();
    const startTime = Date.now();

    try {
      // Get a tab for execution
      let targetTabId = this.options.tabId;
      if (!targetTabId) {
        const currentPage = await this.browserContext?.getCurrentPage();
        targetTabId = currentPage?.tabId;
      }
      if (this.browserContext && targetTabId) {
        this.browserContext.lockExecutionToTab(targetTabId);
      } else {
        if (!this.browserContext) {
          throw new Error("browser context is not initialized");
        } else if (!targetTabId) {
          throw new Error("unable to get to a tab for execution");
        }
      }

      // Create fresh execution context with new abort signal
      const executionContext = new ExecutionContext({
        executionId: this.id,
        browserContext: this.browserContext!,
        messageManager: this.messageManager!,
        pubsub: this.pubsub,
        abortSignal: this.currentAbortController.signal,
        debugMode: this.options.debug || false,
      });

      // Set selected tab IDs for context
      executionContext.setSelectedTabIds(this.options.tabIds || []);
      executionContext.startExecution(this.options.tabId || 0);

      // Create fresh agent
      const agent =
        this.options.mode === "chat"
          ? new ChatAgent(executionContext)
          : isPocMode()
            ? new NewAgent(executionContext)
            : new BrowserAgent(executionContext);

      // Execute
      await agent.execute(query, metadata || this.options.metadata);

      Logging.log(
        "Execution",
        `Completed execution ${this.id} in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const wasCancelled =
        error instanceof Error && error.name === "AbortError";

      if (!wasCancelled) {
        this.pubsub?.publishMessage({
          msgId: `error_${this.id}`,
          content: `❌ Error: ${errorMessage}`,
          role: "error",
          ts: Date.now(),
        });
      }

      throw error;
    } finally {
      // Clear abort controller after run completes
      this.currentAbortController = null;

      // Unlock browser context after each run
      if (this.browserContext) {
        await this.browserContext.unlockExecution();
      }
    }
  }

  /**
   * Cancel the current execution
   * Preserves message history for continuation
   */
  cancel(): void {
    if (!this.currentAbortController) {
      Logging.log("Execution", `No active execution to cancel for ${this.id}`);
      return;
    }

    // Send pause message to the user
    if (this.pubsub) {
      this.pubsub.publishMessage({
        msgId: "pause_message_id",
        content:
          "✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!",
        role: "assistant",
        ts: Date.now(),
      });
    }

    // Abort the current execution with reason
    const abortReason = {
      userInitiated: true,
      message: "User cancelled execution",
    };
    this.currentAbortController.abort(abortReason);
    this.currentAbortController = null;

    Logging.log("Execution", `Cancelled execution ${this.id}`);
  }

  /**
   * Reset conversation history for a fresh start
   * Cancels current execution and clears message history
   */
  reset(): void {
    // Cancel current execution if running
    if (this.currentAbortController) {
      const abortReason = {
        userInitiated: true,
        message: "User cancelled execution",
      };
      this.currentAbortController.abort(abortReason);
      this.currentAbortController = null;
    }

    // Clear message history
    this.messageManager?.clear();

    // Clear PubSub buffer
    this.pubsub?.clearBuffer();

    Logging.log("Execution", `Reset execution ${this.id}`);
  }

  /**
   * Dispose of the execution completely
   * Called when execution is being removed from manager
   */
  async dispose(): Promise<void> {
    // Cancel if still running
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // Cleanup browser context
    if (this.browserContext) {
      await this.browserContext.cleanup();
      this.browserContext = null;
    }

    // Clear all references
    this.messageManager = null;
    this.pubsub = null;

    Logging.log("Execution", `Disposed execution ${this.id}`);
  }

  /**
   * Check if execution is running
   */
  isRunning(): boolean {
    return this.currentAbortController !== null;
  }

  /**
   * Get execution status info
   */
  getStatus(): {
    id: string;
    isRunning: boolean;
    mode: "chat" | "browse";
  } {
    return {
      id: this.id,
      isRunning: this.isRunning(),
      mode: this.options.mode,
    };
  }
}
