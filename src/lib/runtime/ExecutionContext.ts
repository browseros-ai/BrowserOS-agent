import { z } from 'zod'
import BrowserContext from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { getLLM as getLLMFromProvider, LLMOptions } from '@/lib/llm/LangChainProvider'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TodoStore } from '@/lib/runtime/TodoStore'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { HumanInputResponse } from '@/lib/pubsub/types'
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

// ExecutionMetrics type from NewAgent.prompt.ts
export interface ExecutionMetrics {
  toolCalls: number;
  observations: number;
  errors: number;
  startTime: number;
  endTime: number;
  toolFrequency: Map<string, number>;  // Track frequency of each tool called
}

// ToolResult interface for parsing tool messages
interface ToolResult {
  ok: boolean;
  output?: any;
  error?: string;
}

/**
 * Configuration options for ExecutionContext
 */
export const ExecutionContextOptionsSchema = z.object({
  executionId: z.string().optional(), // Unique execution identifier (NEW)
  browserContext: z.instanceof(BrowserContext), // Browser context for page operations
  messageManager: z.instanceof(MessageManager), // Message manager for communication
  abortSignal: z.instanceof(AbortSignal).optional(), // Abort signal for cancellation
  debugMode: z.boolean().default(false), // Whether to enable debug logging
  todoStore: z.instanceof(TodoStore).optional(), // TODO store for complex task management
  pubsub: z.any().optional(), // Scoped PubSub channel (NEW - will be PubSubChannel)
  supportsVision: z.boolean().default(true), // Whether the model supports image inputs
  limitedContextMode: z.boolean().default(false), // Whether to use limited context mode for small models (<32k tokens)
  maxTokens: z.number().default(128000), // Maximum token limit of the model
});

export type ExecutionContextOptions = z.infer<
  typeof ExecutionContextOptionsSchema
>;

/**
 * Agent execution context containing browser context, message manager, and control state
 */
export class ExecutionContext {
  readonly executionId: string  // Unique execution identifier (NEW)
  abortSignal: AbortSignal  // Abort signal for task cancellation
  browserContext: BrowserContext  // Browser context for page operations
  messageManager: MessageManager  // Message manager for communication
  debugMode: boolean  // Whether debug logging is enabled
  selectedTabIds: number[] | null = null  // Selected tab IDs
  todoStore: TodoStore  // TODO store for complex task management
  parentSpanId: string | null = null  // Parent span ID for evals2 tracing
  private userInitiatedCancel: boolean = false  // Track if cancellation was user-initiated
  private _isExecuting: boolean = false  // Track actual execution state
  private _lockedTabId: number | null = null  // Tab that execution is locked to
  private _currentTask: string | null = null  // Current user task being executed
  private _todoList: string = ""; // Markdown formatted todo list for the current task
  private _chatMode: boolean = false  // Whether ChatAgent mode is enabled
  private _taskNumber: number = 0  // Track number of user tasks in this session
  private _humanInputRequestId: string | undefined  // Current human input request ID
  private _humanInputResponse: HumanInputResponse | undefined  // Human input response
  private _scopedPubSub: PubSubChannel | null = null  // Scoped PubSub channel
  private _supportsVision: boolean = true  // Whether the model supports vision/images
  private _limitedContextMode: boolean = false  // Whether limited context mode is enabled
  private _maxTokens: number = 128000  // Maximum token limit of the model
  private _reasoningHistory: string[] = []; // Planner reasoning history
  private _executionMetrics: ExecutionMetrics = {
    // Tool execution metrics
    toolCalls: 0,
    observations: 0,
    errors: 0,
    startTime: Date.now(),
    endTime: 0,
    toolFrequency: new Map<string, number>(),
  };
  
  // Tool metrics Map for evals2 lightweight tracking
  toolMetrics: Map<string, {
    toolName: string
    duration: number
    success: boolean
    timestamp: number
    error?: string
  }> | undefined

  constructor(options: ExecutionContextOptions) {
    // Validate options at runtime with proper type checking
    const validatedOptions = ExecutionContextOptionsSchema.parse(options)
    
    // Store execution ID (default to 'default' for backwards compatibility)
    this.executionId = validatedOptions.executionId || "default";

    // Use provided abort signal or create a default one (for backwards compat)
    this.abortSignal =
      validatedOptions.abortSignal || new AbortController().signal;
    this.browserContext = validatedOptions.browserContext;
    this.messageManager = validatedOptions.messageManager;
    this.debugMode = validatedOptions.debugMode || false;
    this.todoStore = validatedOptions.todoStore || new TodoStore();
    this.userInitiatedCancel = false;

    // Store scoped PubSub if provided
    this._scopedPubSub = validatedOptions.pubsub;

    // Store vision support flag
    this._supportsVision = validatedOptions.supportsVision;

    // Store limited context mode and max tokens
    this._limitedContextMode = validatedOptions.limitedContextMode;
    this._maxTokens = validatedOptions.maxTokens;
  }

  /**
   * Check if the model supports vision/image inputs
   */
  public supportsVision(): boolean {
    return this._supportsVision ;
  }

  /**
   * Check if limited context mode is enabled (for models with <32k tokens)
   */
  public isLimitedContextMode(): boolean {
    return this._limitedContextMode;
  }

  /**
   * Get the maximum token limit of the model
   */
  public getMaxTokens(): number {
    return this._maxTokens;
  }

  /**
   * Enable or disable ChatAgent mode
   */
  public setChatMode(enabled: boolean): void {
    this._chatMode = enabled;
  }

  /**
   * Check if ChatAgent mode is enabled
   */
  public isChatMode(): boolean {
    return this._chatMode;
  }

  public setSelectedTabIds(tabIds: number[]): void {
    this.selectedTabIds = tabIds;
  }

  public getSelectedTabIds(): number[] | null {
    return this.selectedTabIds;
  }

  /**
   * Get the PubSub channel for this execution
   * @returns The PubSub channel
   */
  public getPubSub(): PubSubChannel {
    if (!this._scopedPubSub) {
      throw new Error(
        `No PubSub channel provided for execution ${this.executionId}`,
      );
    }
    return this._scopedPubSub;
  }

  /**
   * Cancel execution with user-initiated flag
   * @param isUserInitiated - Whether the cancellation was initiated by the user
   */
  public cancelExecution(isUserInitiated: boolean = false): void {
    this.userInitiatedCancel = isUserInitiated;
    // Note: The abort signal is now controlled externally by Execution class
    // This method now just tracks the user-initiated flag
  }

  /**
   * Check if the current cancellation was user-initiated
   */
  public isUserCancellation(): boolean {
    return this.userInitiatedCancel && this.abortSignal.aborted;
  }

  /**
   * Reset abort controller for new task execution
   * @deprecated No longer needed - abort signal is provided fresh per run
   */
  public resetAbortController(): void {
    this.userInitiatedCancel = false;
    // Abort signal is now provided fresh by Execution class per run
  }

  /**
   * Mark execution as started and lock to a specific tab
   * @param tabId - The tab ID to lock execution to
   */
  public startExecution(tabId: number): void {
    this._isExecuting = true;
    this._lockedTabId = tabId;
  }

  /**
   * Mark execution as ended
   */
  public endExecution(): void {
    this._isExecuting = false;
    // Keep lockedTabId until reset() for debugging purposes
  }

  /**
   * Check if currently executing
   */
  public isExecuting(): boolean {
    return this._isExecuting;
  }

  /**
   * Get the tab ID that execution is locked to
   */
  public getLockedTabId(): number | null {
    return this._lockedTabId;
  }

  /**
   * Reset execution state
   */
  public reset(): void {
    this._isExecuting = false;
    this._lockedTabId = null;
    this.userInitiatedCancel = false;
    this._currentTask = null;
    this._todoList = "";
    this._reasoningHistory = []; // Clear reasoning history
    this.todoStore.reset();
    // Clear tool metrics for evals2
    this.toolMetrics?.clear();
    this.toolMetrics = undefined;
    // Reset metrics
    this._executionMetrics = {
      toolCalls: 0,
      observations: 0,
      errors: 0,
      startTime: Date.now(),
      endTime: 0,
      toolFrequency: new Map<string, number>(),
    };
  }

  /**
   * Get LLM instance for agent/tool usage
   * @param options - Optional LLM configuration
   * @returns Promise resolving to chat model
   */
  public async getLLM(options?: LLMOptions): Promise<BaseChatModel> {
    return getLLMFromProvider(options);
  }

  /**
   * Set the current task being executed
   * @param task - The user's task/goal
   */
  public setCurrentTask(task: string): void {
    this._currentTask = task;
    this._taskNumber++;  // Increment task counter when new user task starts
  }

  /**
   * Get the current task being executed
   * @returns The current task or null
   */
  public getCurrentTask(): string | null {
    return this._currentTask;
  }

  /**
   * Get the current task number (how many user tasks in this session)
   * @returns The current task number (1-based)
   */
  public getCurrentTaskNumber(): number {
    return this._taskNumber;
  }
  
  /**
   * Set the todo list for the current task
   * @param todos - The markdown formatted todo list
   */
  public setTodoList(todos: string): void {
    this._todoList = todos;
  }

  /**
   * Get the todo list for the current task
   * @returns The markdown formatted todo list
   */
  public getTodoList(): string {
    return this._todoList;
  }

  /**
   * Get KlavisAPIManager singleton for MCP operations
   * @returns The KlavisAPIManager instance
   */
  public getKlavisAPIManager(): KlavisAPIManager {
    return KlavisAPIManager.getInstance();
  }

  /**
   * Set the current human input request ID
   * @param requestId - The unique request identifier
   */
  public setHumanInputRequestId(requestId: string): void {
    this._humanInputRequestId = requestId;
    this._humanInputResponse = undefined; // Clear any previous response
  }

  /**
   * Get the current human input request ID
   * @returns The request ID or undefined
   */
  public getHumanInputRequestId(): string | undefined {
    return this._humanInputRequestId;
  }

  /**
   * Store human input response when received
   * @param response - The human input response
   */
  public setHumanInputResponse(response: HumanInputResponse): void {
    // Only accept if it matches current request
    if (response.requestId === this._humanInputRequestId) {
      this._humanInputResponse = response;
    }
  }

  /**
   * Check if human input response has been received
   * @returns The response or undefined
   */
  public getHumanInputResponse(): HumanInputResponse | undefined {
    return this._humanInputResponse;
  }

  /**
   * Clear human input state
   */
  public clearHumanInputState(): void {
    this._humanInputRequestId = undefined;
    this._humanInputResponse = undefined;
  }

  /**
   * Check if execution should abort
   * @returns True if abort signal is set
   */
  public shouldAbort(): boolean {
    return this.abortSignal.aborted;
  }

  /**
   * Get execution metrics
   * @returns The ExecutionMetrics object
   */
  public getExecutionMetrics(): ExecutionMetrics {
    return this._executionMetrics;
  }

  /**
   * Set execution metrics
   * @param metrics - The ExecutionMetrics to set
   */
  public setExecutionMetrics(metrics: ExecutionMetrics): void {
    this._executionMetrics = metrics;
  }

  /**
   * Increment a specific metric
   * @param metric - The metric to increment
   */
  public incrementMetric(
    metric: "toolCalls" | "observations" | "errors",
  ): void {
    this._executionMetrics[metric]++;
  }

  /**
   * incrementing the frequency count for a specific tool
   */
  public incrementToolUsageMetrics(toolName: string): void {
    const currentCount = this._executionMetrics.toolFrequency.get(toolName) || 0;
    this._executionMetrics.toolFrequency.set(toolName, currentCount + 1);
  }

  /**
   * Add reasoning from planner to history
   * @param reasoning - The reasoning text to add
   */
  public addReasoning(reasoning: string): void {
    this._reasoningHistory.push(reasoning);
    // Keep last 10 reasoning entries
    if (this._reasoningHistory.length > 10) {
      this._reasoningHistory.shift();
    }
  }

  /**
   * Get recent reasoning history
   * @param count - Number of recent reasoning entries to retrieve
   * @returns Array of reasoning strings
   */
  public getReasoningHistory(count: number = 5): string[] {
    return this._reasoningHistory.slice(-count);
  }

  /**
   * Get recent conversation history formatted as strings
   * @param count - Number of recent messages to retrieve
   * @returns Array of formatted message strings
   */
  public getSimplifiedMessageHistory(count: number = 5): string[] {
    // Get last N messages for context
    const messages = this.messageManager.getMessages();
    const recent = messages.slice(-count);
    const history = recent
      .map((msg) => {
        const msgType = msg._getType();
        let result = "";

        if (msgType === "human") {
          const humanMsg = msg as HumanMessage;
          // Handle multimodal content (screenshots)
          if (Array.isArray(humanMsg.content)) {
            const textParts = humanMsg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text);
            const hasImage = humanMsg.content.some(
              (c: any) => c.type === "image_url",
            );
            const prefix = hasImage ? "Human [with screenshot]" : "Human";
            result = `${prefix}: ${textParts.join(" ") || "Visual content only"}`;
          } else {
            result = `Human: ${humanMsg.content}`;
          }
          return result;
        } else if (msgType === "ai") {
          const aiMsg = msg as AIMessage;
          // Handle tool calls
          if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
            const tools = aiMsg.tool_calls
              .map((tc) => {
                // Include args for better context (limited to avoid verbosity)
                const argsStr = tc.args
                  ? JSON.stringify(tc.args).substring(0, 50)
                  : "";
                return argsStr.length > 45 ? `${tc.name}(...)` : `${tc.name}()`;
              })
              .join(", ");
            result = `AI called: ${tools}`;
          }
          // Handle system reminders wrapped in AI messages
          else if (
            typeof aiMsg.content === "string" &&
            aiMsg.content.includes("<system-reminder>")
          ) {
            result = `System reminder: ${aiMsg.content.replace(/<\/?system-reminder>/g, "")}`;
          } else {
            result = `AI: ${aiMsg.content || "Thinking..."}`;
          }
          return result;
        } else if (msgType === "tool") {
          const toolMsg = msg as ToolMessage;
          try {
            const parsed = JSON.parse(toolMsg.content as string) as ToolResult;
            // Include more context about tool results
            if (parsed.ok && parsed.output) {
              // Truncate output if too long
              const outputStr =
                typeof parsed.output === "string"
                  ? parsed.output
                  : JSON.stringify(parsed.output);
              const truncated =
                outputStr.length > 100
                  ? outputStr.substring(0, 100) + "..."
                  : outputStr;
              result = `Tool success: ${truncated}`;
            } else if (parsed.ok) {
              result = `Tool success`;
            } else {
              result = `Tool error: ${parsed.error || "Unknown error"}`;
            }
          } catch {
            // Handle non-JSON tool messages
            const content = String(toolMsg.content);
            result = `Tool: ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`;
          }
          return result;
        } else if (msgType === "system") {
          const sysMsg = msg as SystemMessage;
          // Usually not in recent history, but handle if present
          result = `System: ${String(sysMsg.content).substring(0, 100)}...`;
          return result;
        }

        return result;
      })
      .filter(Boolean);
    return history;
  }
}
