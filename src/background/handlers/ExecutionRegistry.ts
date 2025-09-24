import { Execution } from '@/lib/execution/Execution'
import { Logging } from '@/lib/utils/Logging'

/**
 * Registry that manages Execution instances keyed by executionId.
 * Allows multiple executions to run in parallel while providing
 * helper utilities for lifecycle operations (cancel/reset/dispose).
 */
export class ExecutionRegistry {
  private readonly executions = new Map<string, Execution>()

  get(executionId: string): Execution | undefined {
    return this.executions.get(executionId)
  }

  getOrCreate(executionId: string): Execution {
    if (!this.executions.has(executionId)) {
      console.log(`🆕 ExecutionRegistry: Creating NEW execution for ${executionId}`)
      this.executions.set(executionId, new Execution(executionId))
    } else {
      console.log(`♻️ ExecutionRegistry: Reusing existing execution for ${executionId}`)
    }
    return this.executions.get(executionId)!
  }

  has(executionId: string): boolean {
    return this.executions.has(executionId)
  }

  cancel(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (!execution) return false
    execution.cancel()
    return true
  }

  cancelAll(): void {
    for (const execution of this.executions.values()) {
      execution.cancel()
    }
  }

  reset(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (!execution) return false
    execution.reset()
    return true
  }

  resetAll(): void {
    for (const execution of this.executions.values()) {
      execution.reset()
    }
  } 
  
   /**
   * Dispose and remove an execution from the registry.
   */
  async dispose(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      return false
    }
    await execution.dispose()
    this.executions.delete(executionId)
    Logging.log('ExecutionRegistry', `Disposed execution ${executionId}`)
    return true
  }

  /**
   * Dispose all executions and clear the registry.
   */
  async disposeAll(): Promise<void> {
    for (const [executionId, execution] of this.executions.entries()) {
      await execution.dispose()
      Logging.log('ExecutionRegistry', `Disposed execution ${executionId}`)
    }
    this.executions.clear()
  }

  /**
   * Expose active execution identifiers (useful for diagnostics).
   */
  listExecutionIds(): string[] {
    return Array.from(this.executions.keys())
  }
}
