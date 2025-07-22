import { AgentConfig, AgentInstructions, AgentResult } from './AgentConfig'
import { AgentContext } from './AgentContext'
import { ConversationHistory } from '../history/ConversationHistory'
import { Message } from '../history/Message'
import { Tool } from '../tools/base/Tool'
import { ToolRegistry } from '../tools/base/ToolRegistry'
import { ModelProvider, ModelRequest } from '../providers/ModelProvider'
import { StreamProcessor } from '../streaming/StreamProcessor'
import { AgentEventEmitter } from '../streaming/EventEmitter'
import { Logging } from '@/lib/utils/Logging'

export class Agent {
  private config: AgentConfig
  private instructions: AgentInstructions
  private tools: Map<string, Tool> = new Map()
  private eventEmitter: AgentEventEmitter = new AgentEventEmitter()

  constructor(config: AgentConfig, instructions: AgentInstructions) {
    this.config = config
    this.instructions = instructions
  }

  // Tool management
  registerTool(tool: Tool): void {
    this.tools.set(tool.definition.name, tool)
    Logging.log('Agent', `Registered tool: ${tool.definition.name}`)
  }

  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  // Event handling
  on = this.eventEmitter.on.bind(this.eventEmitter)
  onAny = this.eventEmitter.onAny.bind(this.eventEmitter)
  off = this.eventEmitter.off.bind(this.eventEmitter)

  // Main execution method
  async run(
    task: string,
    provider: ModelProvider,
    context?: AgentContext
  ): Promise<AgentResult> {
    const agentContext = context || new AgentContext()
    const history = new ConversationHistory()
    const startTime = Date.now()

    try {
      // Emit start event
      await this.eventEmitter.emit({
        type: 'agent.start',
        agentName: this.config.name,
        task,
        timestamp: new Date()
      })

      // Initialize conversation with system prompt
      history.addMessage({
        role: 'system',
        content: this.buildSystemPrompt()
      })

      // Add user task
      history.addMessage({
        role: 'user',
        content: task
      })

      // Main execution loop
      let result: AgentResult | null = null
      const toolCallResults: AgentResult['toolCalls'] = []

      while (agentContext.getIterationCount() < this.config.maxIterations) {
        // Emit iteration start
        await this.eventEmitter.emit({
          type: 'iteration.start',
          iterationNumber: agentContext.getIterationCount() + 1,
          timestamp: new Date()
        })

        // Execute one iteration
        const iterationResult = await this.executeIteration(
          history,
          provider,
          agentContext,
          toolCallResults
        )

        // Check if we're done
        if (iterationResult.done) {
          result = iterationResult.result
          break
        }

        // Increment iteration
        agentContext.incrementIteration()

        // Emit iteration end
        await this.eventEmitter.emit({
          type: 'iteration.end',
          iterationNumber: agentContext.getIterationCount(),
          timestamp: new Date()
        })
      }

      // Create final result if we hit max iterations
      if (!result) {
        result = {
          success: false,
          output: null,
          iterations: agentContext.getIterationCount(),
          toolCalls: toolCallResults,
          error: 'Maximum iterations reached'
        }
      }

      // Emit end event
      await this.eventEmitter.emit({
        type: 'agent.end',
        agentName: this.config.name,
        result,
        totalDuration: Date.now() - startTime,
        timestamp: new Date()
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Emit error event
      await this.eventEmitter.emit({
        type: 'error',
        error: errorMessage,
        timestamp: new Date()
      })

      return {
        success: false,
        output: null,
        iterations: agentContext.getIterationCount(),
        toolCalls: toolCallResults,
        error: errorMessage
      }
    }
  }

  // Execute a single iteration
  private async executeIteration(
    history: ConversationHistory,
    provider: ModelProvider,
    context: AgentContext,
    toolCallResults: AgentResult['toolCalls']
  ): Promise<{ done: boolean; result?: AgentResult }> {
    
    // Prepare request
    const request: ModelRequest = {
      messages: history.formatForLLM(),
      tools: this.getToolsForLLM(),
      temperature: this.config.temperature,
      model: this.config.model,
      stream: this.config.streamResponse
    }

    // Get response from model
    if (this.config.streamResponse) {
      const streamProcessor = new StreamProcessor({
        onContent: (content) => {
          if (this.config.verbose) {
            process.stdout.write(content)
          }
        }
      })

      const stream = provider.getStreamResponse(request)
      const { content, toolCalls } = await streamProcessor.processStream(stream)

      // Add assistant message
      history.addMessage({
        role: 'assistant',
        content,
        toolCalls
      })

      // Process tool calls if any
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          await this.executeToolCall(toolCall, history, context, toolCallResults)
        }
        return { done: false }
      }

      // Check if task is complete
      if (this.isTaskComplete(content)) {
        return {
          done: true,
          result: {
            success: true,
            output: content,
            iterations: context.getIterationCount() + 1,
            toolCalls: toolCallResults
          }
        }
      }

    } else {
      // Non-streaming response
      const response = await provider.getResponse(request)
      
      history.addMessage({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      })

      // Process tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          await this.executeToolCall(toolCall, history, context, toolCallResults)
        }
        return { done: false }
      }

      // Check if task is complete
      if (this.isTaskComplete(response.content)) {
        return {
          done: true,
          result: {
            success: true,
            output: response.content,
            iterations: context.getIterationCount() + 1,
            toolCalls: toolCallResults
          }
        }
      }
    }

    return { done: false }
  }

  // Execute a tool call
  private async executeToolCall(
    toolCall: { id: string; name: string; parameters: unknown },
    history: ConversationHistory,
    context: AgentContext,
    toolCallResults: AgentResult['toolCalls']
  ): Promise<void> {
    const tool = this.tools.get(toolCall.name)
    
    if (!tool) {
      history.addMessage({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: `Error: Tool '${toolCall.name}' not found`
      })
      return
    }

    const startTime = Date.now()

    // Emit tool start event
    await this.eventEmitter.emit({
      type: 'tool.start',
      toolName: toolCall.name,
      parameters: toolCall.parameters,
      timestamp: new Date()
    })

    try {
      // Execute the tool
      const result = await tool.execute(toolCall.parameters, context)
      
      // Add tool result to history
      history.addMessage({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify(result)
      })

      // Track tool call
      toolCallResults.push({
        toolName: toolCall.name,
        parameters: toolCall.parameters,
        result
      })

      // Emit tool end event
      await this.eventEmitter.emit({
        type: 'tool.end',
        toolName: toolCall.name,
        result,
        duration: Date.now() - startTime,
        success: result.success,
        timestamp: new Date()
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Add error to history
      history.addMessage({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: `Error: ${errorMessage}`
      })

      // Emit tool end event with error
      await this.eventEmitter.emit({
        type: 'tool.end',
        toolName: toolCall.name,
        result: { success: false, error: errorMessage },
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date()
      })
    }
  }

  // Build system prompt
  private buildSystemPrompt(): string {
    let prompt = this.instructions.systemPrompt

    // Add tool information
    if (this.tools.size > 0) {
      prompt += '\n\nAvailable tools:\n'
      for (const tool of this.tools.values()) {
        prompt += `- ${tool.definition.name}: ${tool.definition.description}\n`
        if (tool.promptTemplate) {
          prompt += `  ${tool.promptTemplate}\n`
        }
      }
    }

    return prompt
  }

  // Get tools formatted for LLM
  private getToolsForLLM(): any[] {
    return Array.from(this.tools.values()).map(tool => tool.getToolInfo())
  }

  // Check if task is complete (simple heuristic)
  private isTaskComplete(content: string): boolean {
    // Look for completion indicators
    const completionPhrases = [
      'task is complete',
      'task has been completed',
      'successfully completed',
      'done with the task',
      'finished the task',
      'DONE'
    ]
    
    const lowerContent = content.toLowerCase()
    return completionPhrases.some(phrase => lowerContent.includes(phrase))
  }

  // Get agent info
  getInfo(): AgentConfig {
    return this.config
  }
}