import { Execution, ExecutionOptions, ExecutionState } from './Execution'
import { PubSub } from '@/lib/pubsub'
import { Logging } from '@/lib/utils/Logging'

// Default execution ID for backwards compatibility
const DEFAULT_EXECUTION_ID = 'default'

// Maximum concurrent executions allowed
const MAX_CONCURRENT_EXECUTIONS = 10

// Execution cleanup timeout (5 minutes)
const EXECUTION_CLEANUP_TIMEOUT = 5 * 60 * 1000

/**
 * Manages all active execution instances.
 * Handles creation, retrieval, and lifecycle management.
 */
export class ExecutionManager {
  private executions: Map<string, Execution> = new Map()
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map()
  private static instance: ExecutionManager | null = null

  constructor() {
    Logging.log('ExecutionManager', 'Initialized ExecutionManager')
  }

  /**
   * Get singleton instance of ExecutionManager
   * (Note: This is the only singleton in the new architecture)
   */
  static getInstance(): ExecutionManager {
    if (!ExecutionManager.instance) {
      ExecutionManager.instance = new ExecutionManager()
    }
    return ExecutionManager.instance
  }

  /**
   * Create a new execution instance
   * @param executionId - Unique execution identifier
   * @param options - Execution configuration options
   * @returns The created execution instance
   */
  create(executionId: string, options: Omit<ExecutionOptions, 'executionId'>): Execution {
    // Check if execution already exists
    if (this.executions.has(executionId)) {
      throw new Error(`Execution ${executionId} already exists`)
    }

    // Check maximum concurrent executions
    if (this.executions.size >= MAX_CONCURRENT_EXECUTIONS) {
      // Try to clean up completed executions first
      this._cleanupCompletedExecutions()
      
      if (this.executions.size >= MAX_CONCURRENT_EXECUTIONS) {
        throw new Error(`Maximum concurrent executions (${MAX_CONCURRENT_EXECUTIONS}) reached`)
      }
    }

    // Get or create PubSub channel for this execution
    const pubsub = PubSub.getChannel(executionId)

    // Create execution with full options
    const fullOptions: ExecutionOptions = {
      ...options,
      executionId
    }

    const execution = new Execution(fullOptions, pubsub)
    this.executions.set(executionId, execution)

    // Clear any existing cleanup timer
    this._clearCleanupTimer(executionId)

    Logging.log('ExecutionManager', `Created execution ${executionId} (total: ${this.executions.size})`)
    
    return execution
  }

  /**
   * Get an existing execution instance
   * @param executionId - Execution identifier to retrieve
   * @returns The execution instance or undefined if not found
   */
  get(executionId: string): Execution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * Get or create an execution instance
   * Useful for backwards compatibility with singleton pattern
   * @param executionId - Execution identifier
   * @param options - Options for creation if doesn't exist
   * @returns The execution instance
   */
  getOrCreate(executionId: string, options?: Omit<ExecutionOptions, 'executionId'>): Execution {
    let execution = this.get(executionId)
    
    if (!execution && options) {
      execution = this.create(executionId, options)
    }
    
    if (!execution) {
      throw new Error(`Execution ${executionId} not found and no options provided to create`)
    }
    
    return execution
  }

  /**
   * Delete an execution instance
   * @param executionId - Execution identifier to delete
   * @param immediate - If true, dispose immediately without cleanup timer
   */
  async delete(executionId: string, immediate: boolean = false): Promise<void> {
    const execution = this.executions.get(executionId)
    
    if (!execution) {
      Logging.log('ExecutionManager', `Execution ${executionId} not found for deletion`)
      return
    }

    if (immediate) {
      // Immediate disposal
      await this._disposeExecution(executionId)
    } else {
      // Schedule cleanup after timeout (allows for reconnection)
      this._scheduleCleanup(executionId)
    }
  }

  /**
   * Get all active executions
   * @returns Map of all execution instances
   */
  getAll(): Map<string, Execution> {
    return new Map(this.executions)
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    total: number
    running: number
    completed: number
    failed: number
  } {
    let running = 0
    let completed = 0
    let failed = 0

    for (const execution of this.executions.values()) {
      const state = execution.getState()
      if (state === ExecutionState.RUNNING) running++
      else if (state === ExecutionState.COMPLETED) completed++
      else if (state === ExecutionState.FAILED) failed++
    }

    return {
      total: this.executions.size,
      running,
      completed,
      failed
    }
  }

  /**
   * Cancel an execution
   * @param executionId - Execution to cancel
   */
  cancel(executionId: string): void {
    const execution = this.executions.get(executionId)
    
    if (execution) {
      execution.cancel()
      Logging.log('ExecutionManager', `Cancelled execution ${executionId}`)
    } else {
      Logging.log('ExecutionManager', `Execution ${executionId} not found for cancellation`)
    }
  }

  /**
   * Reset an execution's conversation history
   * @param executionId - Execution to reset
   */
  reset(executionId: string): void {
    const execution = this.executions.get(executionId)
    
    if (execution) {
      execution.reset()
      Logging.log('ExecutionManager', `Reset execution ${executionId}`)
    } else {
      Logging.log('ExecutionManager', `Execution ${executionId} not found for reset`)
    }
  }

  /**
   * Cancel all running executions
   */
  cancelAll(): void {
    for (const [id, execution] of this.executions) {
      if (execution.isRunning()) {
        execution.cancel()
      }
    }
    Logging.log('ExecutionManager', `Cancelled all running executions`)
  }

  /**
   * Dispose all executions and cleanup
   */
  async disposeAll(): Promise<void> {
    // Cancel all cleanup timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer)
    }
    this.cleanupTimers.clear()

    // Dispose all executions
    const disposalPromises = []
    for (const executionId of this.executions.keys()) {
      disposalPromises.push(this._disposeExecution(executionId))
    }

    await Promise.all(disposalPromises)
    
    Logging.log('ExecutionManager', 'Disposed all executions')
  }

  /**
   * Get default execution for backwards compatibility
   * Creates a default execution if it doesn't exist
   */
  getDefault(mode: 'chat' | 'browse' = 'browse'): Execution {
    return this.getOrCreate(DEFAULT_EXECUTION_ID, {
      mode,
      debug: false
    })
  }

  /**
   * Dispose an execution and clean up its resources
   * @private
   */
  private async _disposeExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId)
    
    if (!execution) {
      return
    }

    // Dispose the execution
    await execution.dispose()

    // Remove from map
    this.executions.delete(executionId)

    // Delete PubSub channel
    PubSub.deleteChannel(executionId)

    // Clear cleanup timer
    this._clearCleanupTimer(executionId)

    Logging.log('ExecutionManager', `Disposed execution ${executionId} (remaining: ${this.executions.size})`)
  }

  /**
   * Schedule cleanup of an execution after timeout
   * @private
   */
  private _scheduleCleanup(executionId: string): void {
    // Clear any existing timer
    this._clearCleanupTimer(executionId)

    // Schedule new cleanup
    const timer = setTimeout(async () => {
      Logging.log('ExecutionManager', `Auto-cleanup triggered for execution ${executionId}`)
      await this._disposeExecution(executionId)
    }, EXECUTION_CLEANUP_TIMEOUT)

    this.cleanupTimers.set(executionId, timer)
    
    Logging.log('ExecutionManager', `Scheduled cleanup for execution ${executionId} in ${EXECUTION_CLEANUP_TIMEOUT}ms`)
  }

  /**
   * Clear cleanup timer for an execution
   * @private
   */
  private _clearCleanupTimer(executionId: string): void {
    const timer = this.cleanupTimers.get(executionId)
    if (timer) {
      clearTimeout(timer)
      this.cleanupTimers.delete(executionId)
    }
  }

  /**
   * Clean up completed executions to free resources
   * @private
   */
  private _cleanupCompletedExecutions(): void {
    const toCleanup: string[] = []

    for (const [id, execution] of this.executions) {
      const state = execution.getState()
      if (state === ExecutionState.COMPLETED || 
          state === ExecutionState.FAILED || 
          state === ExecutionState.DISPOSED) {
        toCleanup.push(id)
      }
    }

    for (const id of toCleanup) {
      this._disposeExecution(id).catch(error => {
        Logging.log('ExecutionManager', `Error cleaning up execution ${id}: ${error}`, 'error')
      })
    }

    if (toCleanup.length > 0) {
      Logging.log('ExecutionManager', `Cleaned up ${toCleanup.length} completed executions`)
    }
  }
}