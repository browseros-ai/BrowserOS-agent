import type {
  LanguageModelV3CallOptions,
  LanguageModelV3Message,
  LanguageModelV3Middleware,
  LanguageModelV3Prompt,
} from '@ai-sdk/provider'
import { logger } from '../lib/logger'

const overflowLogger = logger.child({
  key: 'agent.context-overflow-middleware',
})

/**
 * Provider-specific regex patterns for context overflow errors.
 * Adapted from Pi coding agent's overflow detection.
 *
 * @see https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/overflow.ts
 */
const OVERFLOW_PATTERNS: RegExp[] = [
  /prompt is too long/i, // Anthropic
  /input is too long for requested model/i, // Amazon Bedrock
  /exceeds the context window/i, // OpenAI (Completions & Responses API)
  /input token count.*exceeds the maximum/i, // Google (Gemini)
  /maximum prompt length is \d+/i, // xAI (Grok)
  /reduce the length of the messages/i, // Groq
  /maximum context length is \d+ tokens/i, // OpenRouter (all backends)
  /exceeds the limit of \d+/i, // GitHub Copilot
  /exceeds the available context size/i, // llama.cpp server
  /greater than the context length/i, // LM Studio
  /context window exceeds limit/i, // MiniMax
  /exceeded model token limit/i, // Kimi For Coding
  /too large for model with \d+ maximum context length/i, // Mistral
  /model_context_window_exceeded/i, // z.ai non-standard finish_reason
  /context[_ ]length[_ ]exceeded/i, // Generic fallback
  /too many tokens/i, // Generic fallback
  /token limit exceeded/i, // Generic fallback
]

export function isContextOverflowError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message
  return OVERFLOW_PATTERNS.some((p) => p.test(msg))
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

  // Always keep at least the most recent non-system message
  if (keepFrom >= nonSystem.length && nonSystem.length > 0) {
    keepFrom = nonSystem.length - 1
  }

  const kept: LanguageModelV3Prompt = [
    ...systemMessages,
    ...nonSystem.slice(keepFrom),
  ]
  overflowLogger.warn('Emergency prompt truncation', {
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
        if (!isContextOverflowError(error)) throw error
        overflowLogger.warn(
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
        if (!isContextOverflowError(error)) throw error
        overflowLogger.warn(
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
