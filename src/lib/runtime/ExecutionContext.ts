import { z } from 'zod'
import BrowserContext from '../browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { EventBus, EventProcessor } from '@/lib/events'
import { getLLM as getLLMFromProvider } from '@/lib/llm/LangChainProvider'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TodoStore } from '@/lib/runtime/TodoStore'

/**
 * Configuration options for ExecutionContext
 */
export const ExecutionContextOptionsSchema = z.object({
  browserContext: z.instanceof(BrowserContext),  // Browser context for page operations
  messageManager: z.instanceof(MessageManager),  // Message manager for communication
  debugMode: z.boolean().default(false),  // Whether to enable debug logging
  eventBus: z.instanceof(EventBus).optional(),  // Event bus for streaming updates
  eventProcessor: z.instanceof(EventProcessor).optional(),  // Event processor for high-level events
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
  eventBus: EventBus | null = null  // Event bus for streaming updates
  eventProcessor: EventProcessor | null = null  // Event processor for high-level events
  selectedTabIds: number[] | null = null  // Selected tab IDs
  todoStore: TodoStore  // TODO store for complex task management
  private userInitiatedCancel: boolean = false  // Track if cancellation was user-initiated
  private _isExecuting: boolean = false  // Track actual execution state
  private _lockedTabId: number | null = null  // Tab that execution is locked to
  private _currentTask: string | null = null  // Current user task being executed
  private _failedUrls: Set<string> = new Set()  // URLs that failed during this execution
  private _pageSelectionHistory: Map<string, Map<string, Set<number>>> = new Map()  // pageUrl -> description -> tried nodeIds

  constructor(options: ExecutionContextOptions) {
    // Validate options at runtime
    const validatedOptions = ExecutionContextOptionsSchema.parse(options)
    
    // Create our own AbortController - single source of truth
    this.abortController = new AbortController()
    this.browserContext = validatedOptions.browserContext
    this.messageManager = validatedOptions.messageManager
    this.debugMode = validatedOptions.debugMode || false
    this.eventBus = validatedOptions.eventBus || null
    this.eventProcessor = validatedOptions.eventProcessor || null
    this.todoStore = validatedOptions.todoStore || new TodoStore()
    this.userInitiatedCancel = false
  }
  
  public setSelectedTabIds(tabIds: number[]): void {
    this.selectedTabIds = tabIds;
  }

  public getSelectedTabIds(): number[] | null {
    return this.selectedTabIds;
  }

  /**
   * Set the event bus for streaming updates
   * @param eventBus - The event bus to use
   */
  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Get the current event bus
   * @returns The event bus
   * @throws Error if event bus is not set
   */
  public getEventBus(): EventBus {
    if (!this.eventBus) {
      throw new Error('EventBus not set. Call setEventBus first.');
    }
    return this.eventBus;
  }

  /**
   * Set the event processor for high-level event handling
   * @param eventProcessor - The event processor to use
   */
  public setEventProcessor(eventProcessor: EventProcessor): void {
    this.eventProcessor = eventProcessor;
  }

  /**
   * Get the current event processor
   * @returns The event processor
   * @throws Error if event processor is not set
   */
  public getEventProcessor(): EventProcessor {
    if (!this.eventProcessor) {
      throw new Error('EventProcessor not set. Call setEventProcessor first.');
    }
    return this.eventProcessor;
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
    this._failedUrls.clear();
    this._pageSelectionHistory.clear();
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
   * Record a URL that led to failure, so selectors can avoid it later
   */
  public addFailedUrl (url: string): void {
    const normalized = (url || '').trim().toLowerCase()
    if (normalized) this._failedUrls.add(normalized)
  }

  /**
   * Get the list of failed URLs for this execution
   */
  public getFailedUrls (): string[] {
    return Array.from(this._failedUrls)
  }

  // ===== Selection history helpers =====
  public markTriedElement (pageUrl: string, description: string, nodeId: number): void {
    const urlKey = (pageUrl || '').trim().toLowerCase()
    const descKey = (description || '').trim().toLowerCase()
    if (!urlKey || !descKey || !Number.isFinite(nodeId)) return
    let byDesc = this._pageSelectionHistory.get(urlKey)
    if (!byDesc) {
      byDesc = new Map<string, Set<number>>()
      this._pageSelectionHistory.set(urlKey, byDesc)
    }
    let ids = byDesc.get(descKey)
    if (!ids) {
      ids = new Set<number>()
      byDesc.set(descKey, ids)
    }
    ids.add(nodeId)
  }

  public getTriedNodeIds (pageUrl: string, description: string): Set<number> {
    const urlKey = (pageUrl || '').trim().toLowerCase()
    const descKey = (description || '').trim().toLowerCase()
    const byDesc = this._pageSelectionHistory.get(urlKey)
    if (!byDesc) return new Set<number>()
    const ids = byDesc.get(descKey)
    return ids ? new Set<number>(ids) : new Set<number>()
  }
}
 
