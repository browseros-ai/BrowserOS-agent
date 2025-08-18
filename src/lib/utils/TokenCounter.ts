import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages'

/**
 * Utility for counting tokens in messages and strings.
 * Uses rough approximation: 4 characters = 1 token
 */
export class TokenCounter {
  // Constants for token approximation
  private static readonly CHARS_PER_TOKEN = 4
  private static readonly TOKENS_PER_MESSAGE = 3  // Message overhead

  /**
   * Count tokens in a string
   * @param content - The string content to count tokens for
   * @returns Estimated token count
   */
  static countString(content: string): number {
    if (!content) return 0
    return Math.ceil(content.length / TokenCounter.CHARS_PER_TOKEN)
  }

  /**
   * Count tokens in a single message
   * @param message - The message to count tokens for
   * @returns Estimated token count
   */
  static countMessage(message: BaseMessage): number {
    // Use exact count from usage_metadata if available
    if (message instanceof AIMessage && message.usage_metadata?.total_tokens) {
      return message.usage_metadata.total_tokens
    }

    // Extract content as string
    let content = ''
    if (typeof message.content === 'string') {
      content = message.content
    } else if (message.content) {
      content = JSON.stringify(message.content)
    }

    // Base token count
    let tokens = TokenCounter.countString(content) + TokenCounter.TOKENS_PER_MESSAGE

    // Add extra tokens for tool calls in AI messages
    if (message instanceof AIMessage && message.tool_calls) {
      const toolCallsStr = JSON.stringify(message.tool_calls)
      tokens += TokenCounter.countString(toolCallsStr)
    }

    // Add tokens for tool message IDs
    if (message instanceof ToolMessage && message.tool_call_id) {
      tokens += TokenCounter.countString(message.tool_call_id)
    }

    return tokens
  }

  /**
   * Count tokens in an array of messages
   * @param messages - Array of messages to count tokens for
   * @returns Total estimated token count
   */
  static countMessages(messages: BaseMessage[]): number {
    return messages.reduce((total, msg) => total + TokenCounter.countMessage(msg), 0)
  }

  /**
   * Format token count for logging
   * @param tokens - Number of tokens
   * @param label - Optional label for the count
   * @returns Formatted string for logging
   */
  static format(tokens: number, label?: string): string {
    const prefix = label ? `${label}: ` : ''
    if (tokens > 1000000) {
      return `${prefix}~${(tokens / 1000000).toFixed(1)}M tokens`
    } else if (tokens > 1000) {
      return `${prefix}~${(tokens / 1000).toFixed(1)}K tokens`
    }
    return `${prefix}~${tokens} tokens`
  }

  /**
   * Count tokens in a mixed input (string or messages)
   * @param input - String or array of messages
   * @returns Estimated token count
   */
  static count(input: string | BaseMessage | BaseMessage[]): number {
    if (typeof input === 'string') {
      return TokenCounter.countString(input)
    } else if (Array.isArray(input)) {
      return TokenCounter.countMessages(input)
    } else {
      return TokenCounter.countMessage(input)
    }
  }
}