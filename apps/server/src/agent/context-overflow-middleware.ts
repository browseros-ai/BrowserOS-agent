import type {
  LanguageModelV3CallOptions,
  LanguageModelV3Message,
  LanguageModelV3Middleware,
  LanguageModelV3Prompt,
} from '@ai-sdk/provider'
import { logger } from '../lib/logger'

function isContextLengthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('context_length') ||
    msg.includes('too long') ||
    msg.includes('maximum context length') ||
    msg.includes('token limit') ||
    msg.includes('exceeds the model') ||
    msg.includes('max_tokens')
  )
}

function truncatePrompt(
  prompt: LanguageModelV3Prompt,
  contextWindow: number,
): LanguageModelV3Prompt {
  const systemMessages: LanguageModelV3Message[] = []
  const nonSystem: LanguageModelV3Message[] = []
  for (const m of prompt) {
    if (m.role === 'system') systemMessages.push(m)
    else nonSystem.push(m)
  }

  // Target 60% of context window to leave headroom
  const targetChars = contextWindow * 4 * 0.6
  let totalChars = 0
  let keepFrom = nonSystem.length

  for (let i = nonSystem.length - 1; i >= 0; i--) {
    totalChars += JSON.stringify(nonSystem[i].content).length
    if (totalChars > targetChars) break
    keepFrom = i
  }

  const kept: LanguageModelV3Prompt = [
    ...systemMessages,
    ...nonSystem.slice(keepFrom),
  ]
  logger.warn('Emergency prompt truncation', {
    original: prompt.length,
    kept: kept.length,
    dropped: prompt.length - kept.length,
  })
  return kept
}

export function createContextOverflowMiddleware(
  contextWindow: number,
): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate()
      } catch (error) {
        if (!isContextLengthError(error)) throw error
        logger.warn(
          'Context overflow detected in doGenerate, truncating and retrying',
        )
        ;(params as LanguageModelV3CallOptions).prompt = truncatePrompt(
          params.prompt,
          contextWindow,
        )
        return await doGenerate()
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream()
      } catch (error) {
        if (!isContextLengthError(error)) throw error
        logger.warn(
          'Context overflow detected in doStream, truncating and retrying',
        )
        ;(params as LanguageModelV3CallOptions).prompt = truncatePrompt(
          params.prompt,
          contextWindow,
        )
        return await doStream()
      }
    },
  }
}
