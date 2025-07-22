import { 
  ModelProvider, 
  ModelRequest, 
  ModelResponse, 
  StreamChunk 
} from './ModelProvider'
import { LangChainProviderFactory } from '@/lib/llm/LangChainProviderFactory'
import { Message } from '../history/Message'
import { 
  BaseMessage, 
  HumanMessage, 
  SystemMessage, 
  AIMessage,
  ToolMessage
} from '@langchain/core/messages'
import { Logging } from '@/lib/utils/Logging'

export class LangChainAdapter implements ModelProvider {
  private factory: typeof LangChainProviderFactory

  constructor(factory: typeof LangChainProviderFactory = LangChainProviderFactory) {
    this.factory = factory
  }

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    try {
      // Create LLM instance
      const llm = await this.factory.createLLM({
        model: request.model,
        temperature: request.temperature
      })

      // Convert messages to LangChain format
      const langchainMessages = this.convertMessagesToLangChain(request.messages)

      // Bind tools if provided
      if (request.tools && request.tools.length > 0) {
        const tools = this.convertToolsToLangChain(request.tools)
        const llmWithTools = llm.bindTools(tools)
        
        // Invoke with tools
        const response = await llmWithTools.invoke(langchainMessages)
        
        return this.convertLangChainResponse(response)
      }

      // Invoke without tools
      const response = await llm.invoke(langchainMessages)
      
      return {
        content: response.content as string,
        finishReason: 'stop'
      }
    } catch (error) {
      Logging.log('LangChainAdapter', `Error in getResponse: ${error}`, 'error')
      throw error
    }
  }

  async *getStreamResponse(request: ModelRequest): AsyncIterable<StreamChunk> {
    try {
      // Create LLM instance
      const llm = await this.factory.createLLM({
        model: request.model,
        temperature: request.temperature
      })

      // Convert messages to LangChain format
      const langchainMessages = this.convertMessagesToLangChain(request.messages)

      // Stream the response
      const stream = await llm.stream(langchainMessages)
      
      for await (const chunk of stream) {
        if (typeof chunk.content === 'string' && chunk.content.length > 0) {
          yield {
            type: 'content',
            content: chunk.content
          }
        }
        
        // Handle tool calls in streaming
        if ('tool_calls' in chunk && chunk.tool_calls && chunk.tool_calls.length > 0) {
          for (const toolCall of chunk.tool_calls) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: toolCall.id || crypto.randomUUID(),
                name: toolCall.name,
                parameters: toolCall.args
              }
            }
          }
        }
      }

      // Send end marker
      yield {
        type: 'end'
      }
    } catch (error) {
      Logging.log('LangChainAdapter', `Error in getStreamResponse: ${error}`, 'error')
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to create an LLM instance to check availability
      await this.factory.createLLM()
      return true
    } catch {
      return false
    }
  }

  getName(): string {
    return 'LangChain'
  }

  // Convert our Message format to LangChain BaseMessage
  private convertMessagesToLangChain(messages: Message[]): BaseMessage[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content)
        case 'user':
          return new HumanMessage(msg.content)
        case 'assistant':
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            return new AIMessage({
              content: msg.content,
              tool_calls: msg.toolCalls.map(tc => ({
                id: tc.id,
                name: tc.name,
                args: tc.parameters
              }))
            })
          }
          return new AIMessage(msg.content)
        case 'tool':
          return new ToolMessage({
            content: msg.content,
            tool_call_id: msg.toolCallId,
            name: msg.name
          })
        default:
          throw new Error(`Unknown message role: ${(msg as any).role}`)
      }
    })
  }

  // Convert tool definitions to LangChain format
  private convertToolsToLangChain(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.parameters
    }))
  }

  // Convert LangChain response to our format
  private convertLangChainResponse(response: any): ModelResponse {
    const result: ModelResponse = {
      content: response.content || '',
      finishReason: 'stop'
    }

    if (response.tool_calls && response.tool_calls.length > 0) {
      result.toolCalls = response.tool_calls.map((tc: any) => ({
        id: tc.id || crypto.randomUUID(),
        name: tc.name,
        parameters: tc.args
      }))
      result.finishReason = 'tool_calls'
    }

    return result
  }
}