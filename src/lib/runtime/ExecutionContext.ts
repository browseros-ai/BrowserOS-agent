import { z } from 'zod'
import BrowserContext from '../browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { getLLM as getLLMFromProvider } from '@/lib/llm/LangChainProvider'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TodoStore } from '@/lib/runtime/TodoStore'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'
import { PubSub } from '@/lib/pubsub'

/**
 * Configuration options for ExecutionContext
 */
export const ExecutionContextOptionsSchema = z.object({
  browserContext: z.instanceof(BrowserContext),  // Browser context for page operations
  messageManager: z.instanceof(MessageManager),  // Message manager for communication
  debugMode: z.boolean().default(false),  // Whether to enable debug logging
  todoStore: z.instanceof(TodoStore).optional()  // TODO store for complex task management
})

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
  private userInitiatedCancel: boolean = false  // Track if cancellation was user-initiated
  private _isExecuting: boolean = false  // Track actual execution state
  private _lockedTabId: number | null = null  // Tab that execution is locked to
  private _currentTask: string | null = null  // Current user task being executed
  private _chatMode: boolean = false  // Whether ChatAgent mode is enabled

  constructor(options: ExecutionContextOptions) {
    // Validate options at runtime
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
  }

  /**
   * Get the current task being executed
   * @returns The current task or null
   */
  public getCurrentTask(): string | null {
    return this._currentTask;
  }

  /**
   * Get KlavisAPIManager singleton for MCP operations
   * @returns The KlavisAPIManager instance
   */
  public getKlavisAPIManager(): KlavisAPIManager {
    return KlavisAPIManager.getInstance()
  }
}
 
