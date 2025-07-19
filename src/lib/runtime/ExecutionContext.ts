import { z } from 'zod'
import BrowserContext from '../browser/BrowserContext'
import MessageManager from '@/lib/runtime/MessageManager'
import { StreamEventBus } from '@/lib/events'

/**
 * Configuration options for ExecutionContext
 */
export const ExecutionContextOptionsSchema = z.object({
  browserContext: z.instanceof(BrowserContext),  // Browser context for page operations
  messageManager: z.instanceof(MessageManager),  // Message manager for communication
  abortController: z.instanceof(AbortController),  // Abort controller for task cancellation
  debugMode: z.boolean().default(false),  // Whether to enable debug logging
  eventBus: z.instanceof(StreamEventBus).optional()  // Event bus for streaming updates
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
  eventBus: StreamEventBus | null  // Event bus for streaming updates
  selectedTabIds: number[] | null = null  // Selected tab IDs
  private userInitiatedCancel: boolean = false  // Track if cancellation was user-initiated
  private _isExecuting: boolean = false  // Track actual execution state
  private _lockedTabId: number | null = null  // Tab that execution is locked to

  constructor(options: ExecutionContextOptions) {
    this.abortController = options.abortController
    this.browserContext = options.browserContext
    this.messageManager = options.messageManager
    this.debugMode = options.debugMode
    this.eventBus = options.eventBus || null
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
  public setEventBus(eventBus: StreamEventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Get the current event bus
   * @returns The event bus or null if not set
   */
  public getEventBus(): StreamEventBus | null {
    return this.eventBus;
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
  }
}
 