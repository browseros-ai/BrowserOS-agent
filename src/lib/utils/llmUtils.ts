import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { TokenCounter } from './TokenCounter'

/**
 * Utility functions for LLM interactions
 */

/**
 * Trims content to fit within max token limits
 * @param content - The content to potentially trim
 * @param executionContext - Context containing max token information
 * @param reservePercent - Percentage of tokens to reserve for response (default: 0.2 = 20%)
 * @returns Trimmed content if needed
 */
export function trimToMaxTokens(
  content: string,
  executionContext: ExecutionContext,
  reservePercent: number = 0.2
): string {
  // Get max tokens from message manager
  const maxTokens = executionContext.messageManager.getMaxTokens()
  
  // Calculate reserve tokens as percentage of max
  const reserveTokens = Math.floor(maxTokens * reservePercent)
  
  // Calculate available tokens (leave room for response)
  const availableTokens = maxTokens - reserveTokens
  
  // Count current tokens
  const currentTokens = TokenCounter.countString(content)
  
  // If within limits, return as-is
  if (currentTokens <= availableTokens) {
    return content
  }
  
  // Calculate how many characters we can keep (roughly)
  const maxChars = availableTokens * 4  // 4 chars per token approximation
  
  // Trim from the middle to preserve beginning and end
  const halfLength = Math.floor(maxChars / 2)
  const start = content.substring(0, halfLength)
  const end = content.substring(content.length - halfLength)
  
  return `${start}\n\n[... content trimmed to fit token limit ...]\n\n${end}`
}
