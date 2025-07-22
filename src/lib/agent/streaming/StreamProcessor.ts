import { StreamChunk } from '../providers/ModelProvider'
import { ToolCall } from '../history/Message'

export interface StreamProcessorOptions {
  onContent?: (content: string) => void
  onToolCall?: (toolCall: ToolCall) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export class StreamProcessor {
  private options: StreamProcessorOptions
  private accumulatedContent: string = ''
  private toolCalls: ToolCall[] = []

  constructor(options: StreamProcessorOptions = {}) {
    this.options = options
  }

  async processStream(stream: AsyncIterable<StreamChunk>): Promise<{
    content: string
    toolCalls: ToolCall[]
  }> {
    this.accumulatedContent = ''
    this.toolCalls = []

    try {
      for await (const chunk of stream) {
        this.processChunk(chunk)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.options.onError?.(errorMessage)
      throw error
    }

    return {
      content: this.accumulatedContent,
      toolCalls: this.toolCalls
    }
  }

  private processChunk(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'content':
        if (chunk.content) {
          this.accumulatedContent += chunk.content
          this.options.onContent?.(chunk.content)
        }
        break

      case 'tool_call':
        if (chunk.toolCall) {
          const toolCall: ToolCall = {
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            parameters: chunk.toolCall.parameters
          }
          this.toolCalls.push(toolCall)
          this.options.onToolCall?.(toolCall)
        }
        break

      case 'error':
        if (chunk.error) {
          this.options.onError?.(chunk.error)
        }
        break

      case 'end':
        this.options.onEnd?.()
        break
    }
  }

  getAccumulatedContent(): string {
    return this.accumulatedContent
  }

  getToolCalls(): ToolCall[] {
    return this.toolCalls
  }

  reset(): void {
    this.accumulatedContent = ''
    this.toolCalls = []
  }
}