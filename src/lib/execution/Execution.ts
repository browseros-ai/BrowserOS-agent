import { z } from "zod";
import { BrowserContext } from "@/lib/browser/BrowserContext";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { BrowserAgent } from "@/lib/agent/BrowserAgent";
import { NewAgent } from "@/lib/agent/NewAgent";
import { NewAgent27 } from "@/lib/agent/Agent27";
import { ChatAgent } from "@/lib/agent/ChatAgent";
import { langChainProvider } from "@/lib/llm/LangChainProvider";
import { Logging } from "@/lib/utils/Logging";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { PubSub } from "@/lib/pubsub";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { getFeatureFlags } from "@/lib/utils/featureFlags";
// Evals2: session, scoring, and logging
import { ENABLE_EVALS2 } from "@/config";
import { BraintrustEventManager } from "@/evals2/BraintrustEventManager";
import { EvalsScorer } from "@/evals2/EvalScorer";
import { braintrustLogger } from "@/evals2/BraintrustLogger";

// Execution options schema (without executionId since it's now fixed)
export const ExecutionOptionsSchema = z.object({
  mode: z.enum(["chat", "browse"]), // Execution mode
  tabId: z.number().optional(), // Target tab ID
  tabIds: z.array(z.number()).optional(), // Multiple tab context
  metadata: z.any().optional(), // Additional execution metadata
  debug: z.boolean().default(false), // Debug mode flag
});

export type ExecutionOptions = z.infer<typeof ExecutionOptionsSchema>;

/**
 * Singleton execution instance.
 * Manages a single persistent conversation (MessageManager) and browser context.
 * Fresh ExecutionContext and agents are created per run.
 */
export class Execution {
  private static instance: Execution | null = null;
  private static readonly EXECUTION_ID = "main";  // Fixed execution ID
  
  readonly id: string;
  private browserContext: BrowserContext | null = null;
  private messageManager: MessageManager | null = null;
  private pubsub: PubSubChannel | null = null;
  private options: ExecutionOptions;
  private currentAbortController: AbortController | null = null;

  private constructor() {
    this.id = Execution.EXECUTION_ID;
    this.pubsub = PubSub.getChannel(Execution.EXECUTION_ID);
    // Initialize with default options
    this.options = {
      mode: "browse",
      debug: false
    };
    Logging.log(
      "Execution",
      `Created singleton execution instance`,
    );
  }

  /**
   * Get the singleton instance of Execution
   */
  static getInstance(): Execution {
    if (!Execution.instance) {
      Execution.instance = new Execution();
    }
    return Execution.instance;
  }

  /**
   * Update execution options before running
   * @param options - Partial options to update
   */
  updateOptions(options: Partial<ExecutionOptions>): void {
    this.options = { ...this.options, ...options };
    Logging.log(
      "Execution",
      `Updated options: mode=${this.options.mode}, tabIds=${this.options.tabIds?.length || 0}`,
    );
  }

  /**
   * Ensure persistent resources are initialized
   * Creates browser context and message manager if needed
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this.browserContext) {
      this.browserContext = new BrowserContext();
    }

    if (!this.messageManager) {
      const modelCapabilities = await langChainProvider.getModelCapabilities();
      this.messageManager = new MessageManager(modelCapabilities.maxTokens);
    }

    // Initialize feature flags (cached after first call)
    await getFeatureFlags().initialize();
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

      // Get model capabilities for vision support and context size
      const modelCapabilities = await langChainProvider.getModelCapabilities();

      // Determine if limited context mode should be enabled (< 32k tokens)
      const limitedContextMode = modelCapabilities.maxTokens < 32_000;

      if (limitedContextMode) {
        Logging.log(
          "Execution",
          `Limited context mode enabled (maxTokens: ${modelCapabilities.maxTokens})`,
          "info"
        );
      }

      // Create fresh execution context with new abort signal
      const executionContext = new ExecutionContext({
        executionId: this.id,
        browserContext: this.browserContext!,
        messageManager: this.messageManager!,
        pubsub: this.pubsub,
        abortSignal: this.currentAbortController.signal,
        debugMode: this.options.debug || false,
        supportsVision: modelCapabilities.supportsImages,
        limitedContextMode: limitedContextMode,
        maxTokens: modelCapabilities.maxTokens,
      });

      // Set selected tab IDs for context
      executionContext.setSelectedTabIds(this.options.tabIds || []);
      executionContext.startExecution(this.options.tabId || 0);

      // Evals2: start a session and attach parent span to context
      let parentSpanId: string | undefined;
      const evalsEventMgr = BraintrustEventManager.getInstance();
      if (ENABLE_EVALS2 && evalsEventMgr.isEnabled()) {
        try {
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const { parent } = await evalsEventMgr.startSession({
            sessionId,
            task: query,
            timestamp: Date.now(),
            agentVersion: 'v1'
          });
          parentSpanId = parent;
          if (parentSpanId) {
            executionContext.parentSpanId = parentSpanId;
          }
        } catch (e) {
          // Non-fatal: continue without evals session
        }
      }

      if (!getFeatureFlags().isEnabled('NEW_AGENT') && this.options.mode !== 'chat') {
        executionContext.getPubSub().publishMessage({
          msgId: "old_agent_notice",
          content: `⚠️ **Note**: You are using the older version of agent.

Upgrade to the latest BrowserOS version from [GitHub Releases](https://github.com/browseros-ai/BrowserOS/releases) to access the new and improved agent!`,
          role: "assistant",
          ts: Date.now(),
        });
      }

      // Create fresh agent
      const agent =
        this.options.mode === "chat"
          ? new ChatAgent(executionContext)
          : getFeatureFlags().isEnabled('NEW_AGENT')
            ? new NewAgent27(executionContext)
            : new BrowserAgent(executionContext);

      // Execute
      await agent.execute(query, metadata || this.options.metadata);

      // Evals2: post-execution scoring + upload
      if (ENABLE_EVALS2 && evalsEventMgr.isEnabled()) {
        try {
          const scorer = new EvalsScorer();
          const messages = executionContext.messageManager!.getMessages();
          const durationMs = Date.now() - startTime;
          let score;
          try {
            score = await scorer.scoreFromMessages(
              messages,
              query,
              executionContext.toolMetrics,
              durationMs
            );
          } catch (err) {
            // Fallback to heuristic scoring if LLM scoring unavailable (e.g., no Gemini key)
            (scorer as any).llm = null;
            score = await scorer.scoreFromMessages(
              messages,
              query,
              executionContext.toolMetrics,
              durationMs
            );
          }

          // Basic metadata for Braintrust
          const provider = langChainProvider.getCurrentProvider();
          const contextMetrics = {
            messageCount: messages.length,
            totalCharacters: messages.reduce((sum, m) => {
              const c: any = (m as any).content;
              if (typeof c === 'string') return sum + c.length;
              if (Array.isArray(c)) return sum + JSON.stringify(c).length;
              return sum;
            }, 0),
            estimatedTokens: 0
          };

          await braintrustLogger.logTaskScore(
            query,
            score,
            durationMs,
            {
              agent: this.options.mode === 'chat' ? 'ChatAgent' : (getFeatureFlags().isEnabled('NEW_AGENT') ? 'NewAgent' : 'BrowserAgent'),
              provider: provider?.name,
              model: provider?.modelId,
            },
            parentSpanId,
            contextMetrics
          );

          // Track session-level average and end session
          evalsEventMgr.addTaskScore(score.weightedTotal);
          await evalsEventMgr.endSession('completed');
        } catch (e) {
          // Non-fatal
          console.debug('Evals2 scoring/logging skipped:', e);
        }
      }

      Logging.log(
        "Execution",
        `Completed execution in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const wasCancelled =
        error instanceof Error && error.name === "AbortError";

      if (!wasCancelled) {
        this.pubsub?.publishMessage({
          msgId: `error_main`,
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
      Logging.log("Execution", `No active execution to cancel`);
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

    Logging.log("Execution", `Cancelled execution`);
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

    Logging.log("Execution", `Reset execution`);
  }

  /**
   * Dispose of the execution completely
   * Note: In singleton pattern, this is rarely used except for cleanup
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

    Logging.log("Execution", `Disposed execution`);
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
