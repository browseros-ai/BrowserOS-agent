import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import { type LanguageModel, type ModelMessage, streamText } from 'ai'
import { logger } from '../../lib/logger'
import {
  buildSummarizationPrompt,
  buildSummarizationSystemPrompt,
  buildTurnPrefixPrompt,
  messagesToTranscript,
} from './compaction-prompt'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompactionConfig {
  contextWindow: number
}

export interface ComputedConfig {
  contextWindow: number
  reserveTokens: number
  triggerRatio: number
  triggerThreshold: number
  keepRecentTokens: number
  minSummarizableTokens: number
  maxSummarizationInput: number
  summarizerMaxOutputTokens: number
  summarizationTimeoutMs: number
  fixedOverhead: number
  safetyMultiplier: number
  imageTokenEstimate: number
  toolOutputMaxChars: number
}

export interface CompactionState {
  existingSummary: string | null
  compactionCount: number
}

// ---------------------------------------------------------------------------
// Adaptive config computation
// ---------------------------------------------------------------------------

export function computeConfig(contextWindow: number): ComputedConfig {
  // Pi-style reserve trigger: compact only when we approach the context limit.
  const reserveTokens =
    contextWindow <= AGENT_LIMITS.COMPACTION_SMALL_CONTEXT_WINDOW
      ? Math.floor(contextWindow * 0.5)
      : AGENT_LIMITS.COMPACTION_RESERVE_TOKENS
  const triggerThreshold = Math.max(0, contextWindow - reserveTokens)
  const triggerRatio = contextWindow > 0 ? triggerThreshold / contextWindow : 0

  const baseMinSummarizableTokens =
    contextWindow <= AGENT_LIMITS.COMPACTION_SMALL_CONTEXT_WINDOW
      ? AGENT_LIMITS.COMPACTION_MIN_SUMMARIZABLE_INPUT_SMALL
      : AGENT_LIMITS.COMPACTION_MIN_SUMMARIZABLE_INPUT

  // Keep a recent tail as a fraction of the trigger budget (capped for large windows).
  const keepRecentTokens = Math.max(
    0,
    Math.min(
      AGENT_LIMITS.COMPACTION_MAX_KEEP_RECENT,
      Math.floor(
        triggerThreshold * AGENT_LIMITS.COMPACTION_KEEP_RECENT_FRACTION,
      ),
    ),
  )

  const availableToSummarize = Math.max(0, triggerThreshold - keepRecentTokens)

  // For tiny/medium windows, never require more tokens than are actually available to summarize.
  const minSummarizableTokens = Math.max(
    AGENT_LIMITS.COMPACTION_MIN_TOKEN_FLOOR,
    Math.min(baseMinSummarizableTokens, availableToSummarize),
  )

  // Pi-style summarization input budget: what remains at the trigger after keeping recent.
  const maxSummarizationInput = Math.min(
    AGENT_LIMITS.COMPACTION_MAX_SUMMARIZATION_INPUT,
    Math.max(minSummarizableTokens, availableToSummarize),
  )

  // Cap summary output to a fraction of reserved headroom.
  const summarizerMaxOutputTokens = Math.max(
    AGENT_LIMITS.COMPACTION_MIN_TOKEN_FLOOR,
    Math.floor(reserveTokens * AGENT_LIMITS.COMPACTION_SUMMARIZER_OUTPUT_RATIO),
  )

  return {
    contextWindow,
    reserveTokens,
    triggerRatio,
    triggerThreshold,
    keepRecentTokens,
    minSummarizableTokens,
    maxSummarizationInput,
    summarizerMaxOutputTokens,
    summarizationTimeoutMs: AGENT_LIMITS.COMPACTION_SUMMARIZATION_TIMEOUT_MS,
    fixedOverhead: AGENT_LIMITS.COMPACTION_FIXED_OVERHEAD,
    safetyMultiplier: AGENT_LIMITS.COMPACTION_SAFETY_MULTIPLIER,
    imageTokenEstimate: AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
    toolOutputMaxChars: AGENT_LIMITS.COMPACTION_TOOL_OUTPUT_MAX_CHARS,
  }
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

function estimateContentPart(part: Record<string, unknown>): {
  chars: number
  images: number
} {
  if ('text' in part && typeof part.text === 'string') {
    return { chars: part.text.length, images: 0 }
  }
  if ('type' in part && part.type === 'image') {
    return { chars: 0, images: 1 }
  }
  if (
    'output' in part &&
    part.output &&
    typeof part.output === 'object' &&
    'value' in (part.output as Record<string, unknown>)
  ) {
    const val = (part.output as { value: unknown }).value
    return {
      chars: typeof val === 'string' ? val.length : JSON.stringify(val).length,
      images: 0,
    }
  }
  if ('input' in part) {
    return { chars: JSON.stringify(part.input).length, images: 0 }
  }
  return { chars: 0, images: 0 }
}

export function estimateTokens(
  messages: ModelMessage[],
  imageTokenEstimate: number = AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
): number {
  let chars = 0
  let imageCount = 0

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        const est = estimateContentPart(part as Record<string, unknown>)
        chars += est.chars
        imageCount += est.images
      }
    }
  }

  return Math.ceil(chars / 4) + imageCount * imageTokenEstimate
}

interface StepWithUsage {
  usage?: { inputTokens?: number | undefined }
}

export function getCurrentTokenCount(
  steps: ReadonlyArray<StepWithUsage>,
  messages: ModelMessage[],
  config: ComputedConfig,
): number {
  // Use real API usage from the last step when available
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1]
    if (lastStep.usage?.inputTokens != null && lastStep.usage.inputTokens > 0) {
      return lastStep.usage.inputTokens
    }
  }

  // Fallback: estimation with safety multiplier + overhead
  const estimated = estimateTokens(messages, config.imageTokenEstimate)
  return Math.ceil(estimated * config.safetyMultiplier) + config.fixedOverhead
}

// ---------------------------------------------------------------------------
// Safe split point detection
// ---------------------------------------------------------------------------

export interface SplitPointResult {
  splitIndex: number
  turnStartIndex: number
  isSplitTurn: boolean
}

export function findSafeSplitPoint(
  messages: ModelMessage[],
  keepRecentTokens: number,
  imageTokenEstimate: number = AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
): SplitPointResult {
  const noSplit: SplitPointResult = {
    splitIndex: -1,
    turnStartIndex: -1,
    isSplitTurn: false,
  }

  if (messages.length <= 2) return noSplit

  let accumulated = 0
  let candidateIndex = -1

  // Walk backward from the end, accumulating token estimates
  for (let i = messages.length - 1; i >= 0; i--) {
    accumulated += estimateTokens([messages[i]], imageTokenEstimate)

    if (accumulated >= keepRecentTokens) {
      candidateIndex = i
      break
    }
  }

  // Never reached the budget — entire conversation is smaller than keepRecent
  if (candidateIndex === -1) return noSplit

  // Walk backward from candidate to find a safe cut point (not a tool message)
  // Cutting before a tool message would orphan its tool call
  while (candidateIndex > 0 && messages[candidateIndex].role === 'tool') {
    candidateIndex--
  }

  // Need at least 1 message in the "to summarize" portion
  if (candidateIndex <= 0) return noSplit

  // Determine if the cut is mid-turn by finding the nearest user message
  if (messages[candidateIndex].role === 'user') {
    return {
      splitIndex: candidateIndex,
      turnStartIndex: -1,
      isSplitTurn: false,
    }
  }

  // Walk backward from splitIndex to find the user message that started this turn
  let turnStart = -1
  for (let i = candidateIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      turnStart = i
      break
    }
  }

  // Only flag as split turn when there's actual history before the turn.
  // When turnStart <= 0, the entire prefix is one chunk — regular summarization is better.
  if (turnStart <= 0) {
    return {
      splitIndex: candidateIndex,
      turnStartIndex: -1,
      isSplitTurn: false,
    }
  }

  return {
    splitIndex: candidateIndex,
    turnStartIndex: turnStart,
    isSplitTurn: true,
  }
}

// ---------------------------------------------------------------------------
// LLM-based summarization
// ---------------------------------------------------------------------------

async function consumeStreamText(
  result: ReturnType<typeof streamText>,
): Promise<string> {
  const chunks: string[] = []
  for await (const chunk of result.textStream) {
    chunks.push(chunk)
  }
  return chunks.join('')
}

async function callSummarizer(
  model: LanguageModel,
  messages: ModelMessage[],
  userPrompt: string,
  timeoutMs: number,
  maxOutputTokens: number,
  logLabel: string,
): Promise<string | null> {
  const transcript = messagesToTranscript(messages)
  if (!transcript.trim()) return null

  const systemPrompt = buildSummarizationSystemPrompt()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      maxOutputTokens,
      messages: [
        {
          role: 'user',
          content: `<conversation_transcript>\n${transcript}\n</conversation_transcript>\n\n${userPrompt}`,
        },
      ],
      abortSignal: controller.signal,
    })

    const text = await consumeStreamText(result)
    return text || null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`${logLabel} failed`, { error: message })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function summarizeMessages(
  model: LanguageModel,
  messagesToSummarize: ModelMessage[],
  existingSummary: string | null,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<string | null> {
  return callSummarizer(
    model,
    messagesToSummarize,
    buildSummarizationPrompt(existingSummary),
    timeoutMs,
    maxOutputTokens,
    'Summarization',
  )
}

async function summarizeTurnPrefix(
  model: LanguageModel,
  turnPrefixMessages: ModelMessage[],
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<string | null> {
  return callSummarizer(
    model,
    turnPrefixMessages,
    buildTurnPrefixPrompt(),
    timeoutMs,
    maxOutputTokens,
    'Turn prefix summarization',
  )
}

// ---------------------------------------------------------------------------
// Tool output truncation (unchanged from original)
// ---------------------------------------------------------------------------

export function truncateToolOutputs(
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

// ---------------------------------------------------------------------------
// Sliding window fallback (unchanged from original)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main compaction orchestrator
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-step compaction logic with split-turn handling
async function compactMessages(
  model: LanguageModel,
  messages: ModelMessage[],
  config: ComputedConfig,
  state: CompactionState,
): Promise<ModelMessage[]> {
  const triggerThreshold = config.triggerThreshold

  // 1. Find safe split point
  const { splitIndex, turnStartIndex, isSplitTurn } = findSafeSplitPoint(
    messages,
    config.keepRecentTokens,
    config.imageTokenEstimate,
  )

  if (splitIndex === -1) {
    logger.info('Cannot find safe split point, using sliding window')
    return slidingWindow(messages, triggerThreshold)
  }

  const toKeep = messages.slice(splitIndex)

  // 2. Partition messages based on split turn detection
  let historyMessages: ModelMessage[]
  let turnPrefixMessages: ModelMessage[] = []

  if (isSplitTurn && turnStartIndex >= 0) {
    historyMessages = messages.slice(0, turnStartIndex)
    turnPrefixMessages = messages.slice(turnStartIndex, splitIndex)
    logger.info('Split turn detected', {
      historyMessages: historyMessages.length,
      turnPrefixMessages: turnPrefixMessages.length,
      toKeepMessages: toKeep.length,
    })
  } else {
    historyMessages = messages.slice(0, splitIndex)
  }

  // Truncate tool outputs for summarization input
  let toSummarize =
    historyMessages.length > 0
      ? truncateToolOutputs(historyMessages, config.toolOutputMaxChars)
      : []
  let truncatedTurnPrefix =
    turnPrefixMessages.length > 0
      ? truncateToolOutputs(turnPrefixMessages, config.toolOutputMaxChars)
      : []

  // 3. Cap summarization input — sliding window the oldest if too large
  if (toSummarize.length > 0) {
    const summarizeTokens = estimateTokens(toSummarize)
    if (summarizeTokens > config.maxSummarizationInput) {
      const excess = summarizeTokens - config.maxSummarizationInput
      logger.info('Capping summarization input, dropping oldest messages', {
        excess,
        maxSummarizationInput: config.maxSummarizationInput,
      })
      toSummarize = slidingWindow(toSummarize, config.maxSummarizationInput)
    }
  }

  if (truncatedTurnPrefix.length > 0) {
    const prefixTokens = estimateTokens(truncatedTurnPrefix)
    if (prefixTokens > config.maxSummarizationInput) {
      logger.info('Capping turn prefix input, dropping oldest messages', {
        excess: prefixTokens - config.maxSummarizationInput,
        maxSummarizationInput: config.maxSummarizationInput,
      })
      truncatedTurnPrefix = slidingWindow(
        truncatedTurnPrefix,
        config.maxSummarizationInput,
      )
    }
  }

  // 4. Skip LLM for trivially small inputs (not worth the cost)
  const totalSummarizable =
    estimateTokens(toSummarize) + estimateTokens(truncatedTurnPrefix)
  if (totalSummarizable < config.minSummarizableTokens) {
    logger.info('Too little content to summarize, using sliding window')
    return slidingWindow(messages, triggerThreshold)
  }

  // 5. Try LLM summarization
  const turnPrefixOutputBudget = Math.max(
    AGENT_LIMITS.COMPACTION_MIN_TOKEN_FLOOR,
    Math.floor(
      config.summarizerMaxOutputTokens *
        AGENT_LIMITS.COMPACTION_TURN_PREFIX_OUTPUT_RATIO,
    ),
  )

  logger.info('Attempting LLM-based compaction', {
    toSummarizeMessages: toSummarize.length,
    toSummarizeTokens: estimateTokens(toSummarize),
    turnPrefixMessages: truncatedTurnPrefix.length,
    turnPrefixTokens: estimateTokens(truncatedTurnPrefix),
    toKeepMessages: toKeep.length,
    toKeepTokens: estimateTokens(toKeep),
    isSplitTurn,
    hasExistingSummary: state.existingSummary != null,
    compactionCount: state.compactionCount,
  })

  let summary: string | null = null

  if (isSplitTurn && truncatedTurnPrefix.length > 0) {
    if (toSummarize.length > 0) {
      // Both history and turn prefix — summarize in parallel
      const [historySummary, turnPrefixSummary] = await Promise.all([
        summarizeMessages(
          model,
          toSummarize,
          state.existingSummary,
          config.summarizationTimeoutMs,
          config.summarizerMaxOutputTokens,
        ),
        summarizeTurnPrefix(
          model,
          truncatedTurnPrefix,
          config.summarizationTimeoutMs,
          turnPrefixOutputBudget,
        ),
      ])

      if (historySummary && turnPrefixSummary) {
        summary = `${historySummary}\n\n---\n\n**Turn Context (split turn):**\n\n${turnPrefixSummary}`
      } else if (historySummary) {
        summary = historySummary
      } else if (turnPrefixSummary) {
        summary = turnPrefixSummary
      }
    } else {
      // Only turn prefix (first and only turn)
      summary = await summarizeTurnPrefix(
        model,
        truncatedTurnPrefix,
        config.summarizationTimeoutMs,
        turnPrefixOutputBudget,
      )
    }
  } else {
    // Non-split turn — standard summarization
    summary = await summarizeMessages(
      model,
      toSummarize,
      state.existingSummary,
      config.summarizationTimeoutMs,
      config.summarizerMaxOutputTokens,
    )
  }

  // 6. Validate summary
  if (!summary) {
    logger.warn('Summarization returned empty, using sliding window fallback')
    return slidingWindow(messages, triggerThreshold)
  }

  const allSummarized = [...toSummarize, ...truncatedTurnPrefix]
  const summaryTokens = Math.ceil(summary.length / 4)
  const originalTokens = estimateTokens(allSummarized)
  if (summaryTokens >= originalTokens) {
    logger.warn(
      'Summary is larger than original, using sliding window fallback',
      {
        summaryTokens,
        originalTokens,
      },
    )
    return slidingWindow(messages, triggerThreshold)
  }

  // 7. Inject summary as first message + keep recent messages
  state.existingSummary = summary
  state.compactionCount++

  logger.info('LLM compaction succeeded', {
    originalMessages: messages.length,
    keptMessages: toKeep.length,
    summaryTokens,
    originalTokens,
    compressionRatio: `${((1 - summaryTokens / originalTokens) * 100).toFixed(0)}%`,
    compactionCount: state.compactionCount,
    isSplitTurn,
  })

  const summaryMessage: ModelMessage = {
    role: 'user',
    content: `${summary}\n\nContinue from where you left off.`,
  }

  return [summaryMessage, ...toKeep]
}

// ---------------------------------------------------------------------------
// prepareStep factory (public API)
// ---------------------------------------------------------------------------

function isCompactionState(v: unknown): v is CompactionState {
  return (
    typeof v === 'object' &&
    v !== null &&
    'compactionCount' in v &&
    typeof (v as CompactionState).compactionCount === 'number'
  )
}

export function createCompactionPrepareStep(
  userConfig?: Partial<CompactionConfig>,
) {
  const contextWindow =
    userConfig?.contextWindow ?? AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW
  const config = computeConfig(contextWindow)

  logger.info('Compaction config computed', {
    contextWindow,
    reserveTokens: config.reserveTokens,
    triggerRatio: config.triggerRatio.toFixed(3),
    triggerAtTokens: Math.floor(config.triggerThreshold),
    keepRecentTokens: config.keepRecentTokens,
    minSummarizableTokens: config.minSummarizableTokens,
    maxSummarizationInput: config.maxSummarizationInput,
    summarizerMaxOutputTokens: config.summarizerMaxOutputTokens,
  })

  return async ({
    messages,
    steps,
    model,
    experimental_context,
  }: {
    messages: ModelMessage[]
    steps: ReadonlyArray<StepWithUsage>
    model: LanguageModel
    experimental_context: unknown
  }) => {
    const state: CompactionState = isCompactionState(experimental_context)
      ? experimental_context
      : { existingSummary: null, compactionCount: 0 }

    // Stage 1: Check if compaction is needed using the current prompt as-is.
    const currentTokens = getCurrentTokenCount(steps, messages, config)
    const triggerThreshold = config.triggerThreshold

    if (currentTokens <= triggerThreshold) {
      return { messages, experimental_context: state }
    }

    logger.warn('Context approaching limit, attempting compaction', {
      currentTokens,
      triggerThreshold: Math.floor(triggerThreshold),
      messageCount: messages.length,
    })

    // Stage 2: LLM-based compaction with sliding window fallback
    const compacted = await compactMessages(model, messages, config, state)
    return { messages: compacted, experimental_context: state }
  }
}
