import { Execution, ExecutionOptions } from './Execution'
import { PubSub } from '@/lib/pubsub'
import { Logging } from '@/lib/utils/Logging'
import { initializeMemorySystem } from "@/lib/memory";
import { MemoryManager } from "@/lib/memory/MemoryManager";
import { getMemoryConfig } from "@/lib/memory/config";

/**
 * Manages all active execution instances.
 * Handles creation, retrieval, and lifecycle management.
 */
export class ExecutionManager {
  private executions: Map<string, Execution> = new Map()
  private static instance: ExecutionManager | null = null
  private static globalMemoryManager: MemoryManager | null = null

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
   * Get or create singleton MemoryManager
   */
  static async getMemoryManager(): Promise<MemoryManager | null> {
    if (!ExecutionManager.globalMemoryManager) {
      try {
        const memoryConfig = getMemoryConfig()
        ExecutionManager.globalMemoryManager = await initializeMemorySystem(memoryConfig.apiKey, "memory_service")
        
        if (ExecutionManager.globalMemoryManager) {
          Logging.log('ExecutionManager', 'Memory system initialized successfully')
        } else {
          Logging.log('ExecutionManager', 'Memory system initialization returned null - continuing without memory')
        }
      } catch (error) {
        Logging.log('ExecutionManager', `Memory system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        ExecutionManager.globalMemoryManager = null
      }
    }
    return ExecutionManager.globalMemoryManager
  }

  /**
   * Create a new execution instance
   * @param executionId - Unique execution identifier
   * @param options - Execution configuration options
   * @returns The created execution instance
   */
  async create(executionId: string, options: Omit<ExecutionOptions, 'executionId'>): Promise<Execution> {
    // Check if execution already exists
    if (this.executions.has(executionId)) {
      throw new Error(`Execution ${executionId} already exists`)
    }

    // Get or create PubSub channel for this execution
    const pubsub = PubSub.getChannel(executionId)

    const memoryManager = await ExecutionManager.getMemoryManager()

    // Create execution with full options
    const fullOptions: ExecutionOptions = {
      ...options,
      executionId
    }

    const execution = new Execution(fullOptions, pubsub, memoryManager)
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
