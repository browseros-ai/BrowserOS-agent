import { Agent } from './Agent'
import { AgentContext } from './AgentContext'
import { AgentResult } from './AgentConfig'
import { ModelProvider } from '../providers/ModelProvider'
import { LangChainAdapter } from '../providers/LangChainAdapter'
import { Logging } from '@/lib/utils/Logging'

export interface AgentRunnerOptions {
  provider?: ModelProvider  // Model provider to use
  context?: AgentContext  // Execution context
  timeout?: number  // Timeout in milliseconds
}

export class AgentRunner {
  private agent: Agent
  private provider: ModelProvider
  private context: AgentContext

  constructor(agent: Agent, options: AgentRunnerOptions = {}) {
    this.agent = agent
    this.provider = options.provider || new LangChainAdapter()
    this.context = options.context || new AgentContext()
  }

  // Run the agent with a task
  async run(task: string): Promise<AgentResult> {
    Logging.log('AgentRunner', `Starting agent '${this.agent.getInfo().name}' with task: ${task}`)
    
    try {
      // Check provider availability
      const isAvailable = await this.provider.isAvailable()
      if (!isAvailable) {
        throw new Error(`Model provider '${this.provider.getName()}' is not available`)
      }

      // Run the agent
      const result = await this.agent.run(task, this.provider, this.context)
      
      Logging.log('AgentRunner', `Agent completed with result: ${result.success ? 'success' : 'failure'}`)
      
      return result
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('AgentRunner', `Agent failed with error: ${errorMessage}`, 'error')
      
      return {
        success: false,
        output: null,
        iterations: 0,
        toolCalls: [],
        error: errorMessage
      }
    }
  }

  // Run with timeout
  async runWithTimeout(task: string, timeoutMs: number): Promise<AgentResult> {
    const timeoutPromise = new Promise<AgentResult>((_, reject) => {
      setTimeout(() => reject(new Error('Agent execution timed out')), timeoutMs)
    })

    try {
      return await Promise.race([
        this.run(task),
        timeoutPromise
      ])
    } catch (error) {
      if (error instanceof Error && error.message === 'Agent execution timed out') {
        Logging.log('AgentRunner', `Agent timed out after ${timeoutMs}ms`, 'warn')
        return {
          success: false,
          output: null,
          iterations: this.context.getIterationCount(),
          toolCalls: [],
          error: 'Execution timed out'
        }
      }
      throw error
    }
  }

  // Get the execution context
  getContext(): AgentContext {
    return this.context
  }

  // Get the model provider
  getProvider(): ModelProvider {
    return this.provider
  }

  // Create a runner with default configuration
  static create(agent: Agent, providerOverrides?: any): AgentRunner {
    return new AgentRunner(agent, {
      provider: new LangChainAdapter(),
      context: new AgentContext()
    })
  }
}