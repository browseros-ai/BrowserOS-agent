import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { ModelMessage } from 'ai'
import { logger } from '../../lib/logger'

export interface CompactionConfig {
  contextWindow: number
  compactionThreshold: number
  toolOutputMaxChars: number
}

const DEFAULT_CONFIG: CompactionConfig = {
  contextWindow: AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW,
  compactionThreshold: 0.6,
  toolOutputMaxChars: 15_000,
}

export function createCompactionPrepareStep(
  configOverrides?: Partial<CompactionConfig>,
) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides }

  return ({ messages }: { messages: ModelMessage[] }) => {
    const truncated = truncateToolOutputs(messages, config.toolOutputMaxChars)

    const estimatedTokens = estimateTokens(truncated)
    const maxTokens = config.contextWindow * config.compactionThreshold

    if (estimatedTokens <= maxTokens) {
      return { messages: truncated }
    }

    logger.warn('Context approaching limit, applying sliding window', {
      estimatedTokens,
      maxTokens: Math.floor(maxTokens),
      messageCount: truncated.length,
    })

    const windowed = slidingWindow(truncated, maxTokens)
    return { messages: windowed }
  }
}

function truncateToolOutputs(
  messages: ModelMessage[],
  maxChars: number,
): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'tool') return msg

    const content = msg.content.map((part) => {
      if (!('output' in part)) return part

      const output = part.output
      if (output.type === 'text' && output.value.length > maxChars) {
        return {
          ...part,
          output: {
            ...output,
            value: `${output.value.slice(0, maxChars)}\n\n[... truncated ${output.value.length - maxChars} characters]`,
          },
        }
      }

      if (output.type === 'json') {
        const serialized = JSON.stringify(output.value)
        if (serialized.length > maxChars) {
          return {
            ...part,
            output: {
              type: 'text' as const,
              value: `${serialized.slice(0, maxChars)}\n\n[... truncated ${serialized.length - maxChars} characters]`,
            },
          }
        }
      }

      return part
    })

    return { ...msg, content }
  })
}

function estimateTokens(messages: ModelMessage[]): number {
  let chars = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          chars += part.text.length
        } else if (
          'output' in part &&
          part.output &&
          typeof part.output === 'object' &&
          'value' in part.output
        ) {
          const val = part.output.value
          chars +=
            typeof val === 'string' ? val.length : JSON.stringify(val).length
        } else if ('input' in part) {
          chars += JSON.stringify(part.input).length
        }
      }
    }
  }
  return Math.ceil(chars / 4)
}

function slidingWindow(
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
