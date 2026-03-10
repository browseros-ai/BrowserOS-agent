import type { ModelMessage } from 'ai'
import { logger } from '../../lib/logger'
import { estimateTokens } from './estimate-tokens'

export function slidingWindow(
  messages: ModelMessage[],
  maxTokens: number,
): ModelMessage[] {
  let totalTokens = estimateTokens(messages)
  let startIndex = 0

  while (totalTokens > maxTokens && startIndex < messages.length - 2) {
    const msg = messages[startIndex]

    if (msg.role === 'tool') {
      const nextMsg = messages[startIndex + 1]
      if (nextMsg?.role === 'assistant') {
        totalTokens -= estimateTokens([msg, nextMsg])
        startIndex += 2
        continue
      }
    }

    if (msg.role === 'assistant') {
      const nextMsg = messages[startIndex + 1]
      if (nextMsg?.role === 'tool') {
        totalTokens -= estimateTokens([msg, nextMsg])
        startIndex += 2
        continue
      }
    }

    totalTokens -= estimateTokens([msg])
    startIndex++
  }

  if (startIndex === 0) return messages

  logger.info('Sliding window applied', {
    droppedMessages: startIndex,
    remainingMessages: messages.length - startIndex,
    estimatedTokens: estimateTokens(messages.slice(startIndex)),
  })

  return messages.slice(startIndex)
}
