import { z } from 'zod'
import BrowserContext from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { getLLM as getLLMFromProvider } from '@/lib/llm/LangChainProvider'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TodoStore } from '@/lib/runtime/TodoStore'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'
import { PubSub } from '@/lib/pubsub'
import { HumanInputResponse } from '@/lib/pubsub/types'

/**
 * Configuration options for ExecutionContext
 */
export const ExecutionContextOptionsSchema = z.object({
  browserContext: z.instanceof(BrowserContext),  // Browser context for page operations
  messageManager: z.instanceof(MessageManager),  // Message manager for communication
  debugMode: z.boolean().default(false),  // Whether to enable debug logging
  todoStore: z.instanceof(TodoStore).optional()  // TODO store for complex task management
}).passthrough()  // Allow extra properties to be passed (like abortController from tests)

export type ExecutionContextOptions = z.infer<typeof ExecutionContextOptionsSchema>

/**
 * Agent execution context containing browser context, message manager, and control state
 */
export class ExecutionContext {
  abortController: AbortController  // Abort controller for task cancellation
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
  private _chatMode: boolean = false  // Whether ChatAgent mode is enabled
  private _taskNumber: number = 0  // Track number of user tasks in this session
  private _humanInputRequestId: string | undefined  // Current human input request ID
  private _humanInputResponse: HumanInputResponse | undefined  // Human input response
  
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
    
    // Create our own AbortController - single source of truth
    this.abortController = new AbortController()
    this.browserContext = validatedOptions.browserContext
    this.messageManager = validatedOptions.messageManager
    this.debugMode = validatedOptions.debugMode || false
    this.todoStore = validatedOptions.todoStore || new TodoStore()
    this.userInitiatedCancel = false
  }

  /**
   * Enable or disable ChatAgent mode
   */
  public setChatMode(enabled: boolean): void {
    this._chatMode = enabled
  }

  /**
   * Check if ChatAgent mode is enabled
   */
  public isChatMode(): boolean {
    return this._chatMode
  }
  
  public setSelectedTabIds(tabIds: number[]): void {
    this.selectedTabIds = tabIds;
  }

  public getSelectedTabIds(): number[] | null {
    return this.selectedTabIds;
  }


  /**
   * Get the PubSub instance (singleton)
   * @returns The PubSub instance
   */
  public getPubSub(): PubSub {
    return PubSub.getInstance();
  }

  /**
   * Cancel execution with user-initiated flag
   * @param isUserInitiated - Whether the cancellation was initiated by the user
   */
  public cancelExecution(isUserInitiated: boolean = false): void {
    this.userInitiatedCancel = isUserInitiated;
    this.abortController.abort();
  }

  /**
   * Check if the current cancellation was user-initiated
   */
  public isUserCancellation(): boolean {
    return this.userInitiatedCancel && this.abortController.signal.aborted;
  }

  /**
   * Reset abort controller for new task execution
   */
  public resetAbortController(): void {
    this.userInitiatedCancel = false;
    this.abortController = new AbortController();
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
    this.todoStore.reset();
    // Clear tool metrics for evals2
    this.toolMetrics?.clear();
    this.toolMetrics = undefined;
  }

  /**
   * Get LLM instance for agent/tool usage
   * @param options - Optional LLM configuration
   * @returns Promise resolving to chat model
   */
  public async getLLM(options?: { temperature?: number; maxTokens?: number }): Promise<BaseChatModel> {
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
   * Get KlavisAPIManager singleton for MCP operations
   * @returns The KlavisAPIManager instance
   */
  public getKlavisAPIManager(): KlavisAPIManager {
    return KlavisAPIManager.getInstance()
  }

  /**
   * Set the current human input request ID
   * @param requestId - The unique request identifier
   */
  public setHumanInputRequestId(requestId: string): void {
    this._humanInputRequestId = requestId
    this._humanInputResponse = undefined  // Clear any previous response
  }

  /**
   * Get the current human input request ID
   * @returns The request ID or undefined
   */
  public getHumanInputRequestId(): string | undefined {
    return this._humanInputRequestId
  }

  /**
   * Store human input response when received
   * @param response - The human input response
   */
  public setHumanInputResponse(response: HumanInputResponse): void {
    // Only accept if it matches current request
    if (response.requestId === this._humanInputRequestId) {
      this._humanInputResponse = response
    }
  }

  /**
   * Check if human input response has been received
   * @returns The response or undefined
   */
  public getHumanInputResponse(): HumanInputResponse | undefined {
    return this._humanInputResponse
  }

  /**
   * Clear human input state
   */
  public clearHumanInputState(): void {
    this._humanInputRequestId = undefined
    this._humanInputResponse = undefined
  }

  /**
   * Check if execution should abort
   * @returns True if abort signal is set
   */
  public shouldAbort(): boolean {
    return this.abortController.signal.aborted
  }
}
 
