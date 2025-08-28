import { z } from 'zod'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserAgent } from '@/lib/agent/BrowserAgent'
import { ChatAgent } from '@/lib/agent/ChatAgent'
import { langChainProvider } from '@/lib/llm/LangChainProvider'
import { Logging } from '@/lib/utils/Logging'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { ExecutionMetadata } from '@/lib/types/messaging'

// Execution options schema
export const ExecutionOptionsSchema = z.object({
  executionId: z.string(),  // Unique execution identifier
  mode: z.enum(['chat', 'browse']),  // Execution mode
  tabId: z.number().optional(),  // Target tab ID
  tabIds: z.array(z.number()).optional(),  // Multiple tab context
  metadata: z.any().optional(),  // Additional execution metadata
  debug: z.boolean().default(false)  // Debug mode flag
})

export type ExecutionOptions = z.infer<typeof ExecutionOptionsSchema>

// Execution state enum
export enum ExecutionState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  CANCELLING = 'cancelling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISPOSED = 'disposed'
}

/**
 * Represents a single, isolated execution instance.
 * Each execution has its own context, agents, and PubSub channel.
 * This replaces the singleton NxtScape pattern.
 */
export class Execution {
  readonly id: string
  private state: ExecutionState = ExecutionState.CREATED
  private browserContext: BrowserContext | null = null
  private executionContext: ExecutionContext | null = null
  private messageManager: MessageManager | null = null
  private browserAgent: BrowserAgent | null = null
  private chatAgent: ChatAgent | null = null
  private pubsub: PubSubChannel | null = null
  private options: ExecutionOptions
  private startTime: number = 0

  constructor(options: ExecutionOptions, pubsub: PubSubChannel) {
    this.options = ExecutionOptionsSchema.parse(options)
    this.id = this.options.executionId
    this.pubsub = pubsub
    Logging.log('Execution', `Created execution ${this.id} in ${this.options.mode} mode`)
  }

  /**
   * Initialize the execution environment
   * Creates all necessary components for execution
   */
  private async _initialize(): Promise<void> {
    if (this.state !== ExecutionState.CREATED) {
      throw new Error(`Cannot initialize execution in state ${this.state}`)
    }

    this.state = ExecutionState.INITIALIZING
    
    try {
      // Create browser context (lightweight, no puppeteer)
      this.browserContext = new BrowserContext({
        useVision: true
      })

      // Get model capabilities for token limits
      const modelCapabilities = await langChainProvider.getModelCapabilities()
      const maxTokens = modelCapabilities.maxTokens

      // Create message manager
      this.messageManager = new MessageManager(maxTokens)

      // Create execution context with executionId
      this.executionContext = new ExecutionContext({
        executionId: this.id,  // Pass execution ID
        browserContext: this.browserContext,
        messageManager: this.messageManager,
        pubsub: this.pubsub,  // Pass scoped PubSub channel
        debugMode: this.options.debug || false
      })

      // Create appropriate agent based on mode
      if (this.options.mode === 'chat') {
        this.chatAgent = new ChatAgent(this.executionContext)
      } else {
        this.browserAgent = new BrowserAgent(this.executionContext)
      }

      Logging.log('Execution', `Initialized execution ${this.id}`)
    } catch (error) {
      this.state = ExecutionState.FAILED
      throw new Error(`Failed to initialize execution ${this.id}: ${error}`)
    }
  }

  /**
   * Run the execution with the given query
   * @param query - The user's query to execute
   * @param metadata - Optional execution metadata
   */
  async run(query: string, metadata?: ExecutionMetadata): Promise<void> {
    // Initialize if not already done
    if (this.state === ExecutionState.CREATED) {
      await this._initialize()
    }

    this.state = ExecutionState.RUNNING
    this.startTime = Date.now()

    try {
      // Lock to target tab if specified
      if (this.options.tabId && this.browserContext) {
        this.browserContext.lockExecutionToTab(this.options.tabId)
      }

      // Set selected tab IDs for context
      if (this.executionContext) {
        this.executionContext.setSelectedTabIds(this.options.tabIds || [])
        this.executionContext.startExecution(this.options.tabId || 0)
      }

      // Execution running

      // Execute the appropriate agent
      if (this.options.mode === 'chat' && this.chatAgent) {
        await this.chatAgent.execute(query)
      } else if (this.browserAgent) {
        await this.browserAgent.execute(query, metadata || this.options.metadata)
      } else {
        throw new Error(`No agent available for mode ${this.options.mode}`)
      }

      // Success
      this.state = ExecutionState.COMPLETED

      Logging.log('Execution', `Completed execution ${this.id} in ${Date.now() - this.startTime}ms`)

    } catch (error) {
      this.state = ExecutionState.FAILED
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const wasCancelled = error instanceof Error && error.name === 'AbortError'

      if (wasCancelled) {
        this.state = ExecutionState.CANCELLING
      } else {
        this.pubsub?.publishMessage({
          msgId: `error_${this.id}`,
          content: `❌ Error: ${errorMessage}`,
          role: 'error',
          ts: Date.now()
        })
      }

      throw error
    } finally {
      // Always cleanup after execution
      await this._cleanup()
    }
  }

  /**
   * Cancel the execution
   */
  cancel(): void {
    if (this.state !== ExecutionState.RUNNING) {
      Logging.log('Execution', `Cannot cancel execution ${this.id} in state ${this.state}`)
      return
    }

    this.state = ExecutionState.CANCELLING
    
    // Send pause message to the user
    if (this.pubsub) {
      this.pubsub.publishMessage({
        msgId: 'pause_message_id',
        content: '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!',
        role: 'assistant',
        ts: Date.now()
      })
    }
    
    if (this.executionContext) {
      this.executionContext.cancelExecution(true)  // User-initiated
    }
    
    Logging.log('Execution', `Cancelled execution ${this.id}`)
  }

  /**
   * Update tab IDs for this execution
   */
  updateTabIds(tabIds: number[]): void {
    this.options.tabIds = tabIds
    
    // Update browser context if it exists
    if (this.browserContext) {
      // BrowserContext would handle updating its tab connections
      Logging.log('Execution', `Updated tab IDs for execution ${this.id}: [${tabIds.join(', ')}]`)
    }
  }

  /**
   * Reset conversation history while keeping execution alive
   * Used for the RESET_CONVERSATION message
   */
  reset(): void {
    // Stop current task if running
    if (this.state === ExecutionState.RUNNING && this.executionContext) {
      this.executionContext.cancelExecution(false)  // Internal cleanup
    }

    // Clear message history
    this.messageManager?.clear()

    // Reset execution context
    this.executionContext?.reset()

    // Clear PubSub buffer
    this.pubsub?.clearBuffer()

    // Recreate agents with fresh state
    if (this.executionContext) {
      this.browserAgent?.cleanup()
      this.chatAgent?.cleanup()
      
      if (this.options.mode === 'chat') {
        this.chatAgent = new ChatAgent(this.executionContext)
      } else {
        this.browserAgent = new BrowserAgent(this.executionContext)
      }
    }

    this.state = ExecutionState.INITIALIZING

    Logging.log('Execution', `Reset execution ${this.id}`)
  }

  /**
   * Clean up execution resources
   * @private
   */
  private async _cleanup(): Promise<void> {
    // Clean up agents
    this.browserAgent?.cleanup()
    this.chatAgent?.cleanup()

    // End execution context
    if (this.executionContext) {
      this.executionContext.endExecution()
    }

    // Unlock browser context
    if (this.browserContext) {
      await this.browserContext.unlockExecution()
    }

    Logging.log('Execution', `Cleaned up execution ${this.id}`)
  }

  /**
   * Dispose of the execution completely
   * Called when execution is being removed from manager
   */
  async dispose(): Promise<void> {
    if (this.state === ExecutionState.DISPOSED) {
      return
    }

    // Cancel if still running
    if (this.state === ExecutionState.RUNNING) {
      this.cancel()
    }

    // Cleanup all resources
    await this._cleanup()

    // Clear all references
    this.browserContext = null
    this.executionContext = null
    this.messageManager = null
    this.browserAgent = null
    this.chatAgent = null
    
    // Note: Don't dispose pubsub here, let the manager handle it
    this.pubsub = null

    this.state = ExecutionState.DISPOSED
    
    Logging.log('Execution', `Disposed execution ${this.id}`)
  }

  /**
   * Get the current state of the execution
   */
  getState(): ExecutionState {
    return this.state
  }

  /**
   * Check if execution is running
   */
  isRunning(): boolean {
    return this.state === ExecutionState.RUNNING
  }

  /**
   * Get execution status info
   */
  getStatus(): {
    id: string
    state: ExecutionState
    mode: 'chat' | 'browse'
    startTime: number
    duration: number
  } {
    return {
      id: this.id,
      state: this.state,
      mode: this.options.mode,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0
    }
  }
}
