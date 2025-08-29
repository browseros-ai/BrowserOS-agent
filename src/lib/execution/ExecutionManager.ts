import { Execution, ExecutionOptions } from './Execution'
import { PubSub } from '@/lib/pubsub'
import { Logging } from '@/lib/utils/Logging'

/**
 * Manages all active execution instances.
 * Handles creation, retrieval, and lifecycle management.
 */
export class ExecutionManager {
  private executions: Map<string, Execution> = new Map()
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

    // Get or create PubSub channel for this execution
    const pubsub = PubSub.getChannel(executionId)

    // Create execution with full options
    const fullOptions: ExecutionOptions = {
      ...options,
      executionId
    }

    const execution = new Execution(fullOptions, pubsub)
    this.executions.set(executionId, execution)

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
   * Delete an execution instance
   * @param executionId - Execution identifier to delete
   */
  async delete(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId)
    
    if (!execution) {
      Logging.log('ExecutionManager', `Execution ${executionId} not found for deletion`)
      return
    }

    await this._disposeExecution(executionId)
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
  } {
    let running = 0

    for (const execution of this.executions.values()) {
      if (execution.isRunning()) running++
    }

    return {
      total: this.executions.size,
      running
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
    // Dispose all executions
    const disposalPromises = []
    for (const executionId of this.executions.keys()) {
      disposalPromises.push(this._disposeExecution(executionId))
    }

    await Promise.all(disposalPromises)
    
    Logging.log('ExecutionManager', 'Disposed all executions')
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

    Logging.log('ExecutionManager', `Disposed execution ${executionId} (remaining: ${this.executions.size})`)
  }


}
