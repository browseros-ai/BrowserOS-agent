import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import {
  type AssistantContent,
  type LanguageModel,
  type ModelMessage,
  pruneMessages,
  streamText,
  type ToolContent,
  type UserContent,
} from 'ai'
import { logger } from '../lib/logger'
import {
  estimateToolResultOutput,
  stripBinaryContent,
  toolResultOutputToText,
} from './compaction-content'
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

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function estimateUserContent(content: UserContent): {
  chars: number
  images: number
} {
  if (typeof content === 'string') {
    return { chars: content.length, images: 0 }
  }

  let chars = 0
  let images = 0

  for (const part of content) {
    if (part.type === 'text') {
      chars += part.text.length
    } else if (part.type === 'image') {
      images++
    } else if (part.type === 'file') {
      images++
    }
  }

  return { chars, images }
}

function estimateAssistantContent(content: AssistantContent): {
  chars: number
  images: number
} {
  if (typeof content === 'string') {
    return { chars: content.length, images: 0 }
  }

  let chars = 0
  let images = 0

  for (const part of content) {
    switch (part.type) {
      case 'text':
      case 'reasoning':
        chars += part.text.length
        break
      case 'tool-call':
        chars += safeJsonStringify(part.input).length
        break
      case 'tool-result': {
        const estimate = estimateToolResultOutput(part.output)
        chars += estimate.chars
        images += estimate.images
        break
      }
      case 'tool-approval-request':
        chars += part.approvalId.length + part.toolCallId.length
        break
      case 'file':
        images++
        break
    }
  }

  return { chars, images }
}

function estimateToolContent(content: ToolContent): {
  chars: number
  images: number
} {
  let chars = 0
  let images = 0

  for (const part of content) {
    if (part.type === 'tool-result') {
      const estimate = estimateToolResultOutput(part.output)
      chars += estimate.chars
      images += estimate.images
    } else {
      chars += part.approvalId.length
      if (part.reason) {
        chars += part.reason.length
      }
    }
  }

  return { chars, images }
}

export function estimateTokens(
  messages: ModelMessage[],
  imageTokenEstimate: number = AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
): number {
  let chars = 0
  let imageCount = 0

  for (const msg of messages) {
    let estimate = { chars: 0, images: 0 }

    switch (msg.role) {
      case 'system':
        estimate = { chars: msg.content.length, images: 0 }
        break
      case 'user':
        estimate = estimateUserContent(msg.content)
        break
      case 'assistant':
        estimate = estimateAssistantContent(msg.content)
        break
      case 'tool':
        estimate = estimateToolContent(msg.content)
        break
    }

    chars += estimate.chars
    imageCount += estimate.images
  }

  return Math.ceil(chars / 3) + imageCount * imageTokenEstimate
}

export interface StepWithUsage {
  usage?: {
    inputTokens?: number | undefined
    outputTokens?: number | undefined
  }
}

export function getCurrentTokenCount(
  steps: ReadonlyArray<StepWithUsage>,
  messages: ModelMessage[],
  config: ComputedConfig,
): number {
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1]
    if (lastStep.usage?.inputTokens != null && lastStep.usage.inputTokens > 0) {
      // Pi-style additive: real usage as base + trailing content added since
      const base = lastStep.usage.inputTokens
      const outputTokens = lastStep.usage.outputTokens ?? 0

      // Estimate trailing tool result messages added after the last model call
      let trailingTokens = 0
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'tool') {
          trailingTokens += estimateTokens(
            [messages[i]],
            config.imageTokenEstimate,
          )
        } else {
          break
        }
      }

      return base + outputTokens + trailingTokens
    }
  }

  // No real usage → full estimation with safety margin
  const estimated = estimateTokens(messages, config.imageTokenEstimate)
  return Math.ceil(estimated * config.safetyMultiplier) + config.fixedOverhead
}

/**
 * Estimate tokens directly from message content with safety margin.
 * Used after pruning/clearing when step usage is stale.
 */
export function estimateTokensForThreshold(
  messages: ModelMessage[],
  config: ComputedConfig,
): number {
  return (
    Math.ceil(
      estimateTokens(messages, config.imageTokenEstimate) *
        config.safetyMultiplier,
    ) + config.fixedOverhead
  )
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
// Tool output truncation
// ---------------------------------------------------------------------------

export function truncateToolOutputs(
  messages: ModelMessage[],
  maxChars: number,
): ModelMessage[] {
  const formatTruncated = (text: string) =>
    `${text.slice(0, maxChars)}\n\n[... truncated ${text.length - maxChars} characters]`

  return messages.map((msg) => {
    if (msg.role !== 'tool') return msg

    const content = msg.content.map((part) => {
      if (part.type !== 'tool-result') return part

      const outputText = toolResultOutputToText(part.output)
      if (outputText.length <= maxChars) return part

      return {
        ...part,
        output: {
          type: 'text' as const,
          value: formatTruncated(outputText),
        },
      }
    })

    return { ...msg, content }
  })
}

// ---------------------------------------------------------------------------
// Clear tool outputs (replace verbose output with placeholder)
// ---------------------------------------------------------------------------

export function clearToolOutputs(
  messages: ModelMessage[],
  keepRecentCount = 2,
): ModelMessage[] {
  // Find indices of tool messages to protect (last N)
  const toolIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') toolIndices.push(i)
  }
  const protectedIndices = new Set(toolIndices.slice(-keepRecentCount))

  let cleared = 0
  const result = messages.map((msg, idx) => {
    if (msg.role !== 'tool' || protectedIndices.has(idx)) return msg

    const content = msg.content.map((part) => {
      if (part.type !== 'tool-result') return part

      const outputText = toolResultOutputToText(part.output)
      if (outputText.length <= AGENT_LIMITS.COMPACTION_CLEAR_OUTPUT_MIN_CHARS) {
        return part
      }

      cleared++
      return {
        ...part,
        output: {
          type: 'text' as const,
          value: `[Cleared — ${outputText.length} chars]`,
        },
      }
    })

    return { ...msg, content }
  })

  if (cleared > 0) {
    logger.info('Cleared tool outputs', {
      clearedCount: cleared,
      protectedCount: protectedIndices.size,
    })
  }

  return result
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

    const triggerThreshold = config.triggerThreshold

    // Stage 0: Check threshold — if under, return untouched (no data loss).
    let currentTokens = getCurrentTokenCount(steps, messages, config)
    if (currentTokens <= triggerThreshold) {
      return { messages, experimental_context: state }
    }

    let current = stripBinaryContent(messages)
    currentTokens = estimateTokensForThreshold(current, config)
    if (currentTokens <= triggerThreshold) {
      return { messages: current, experimental_context: state }
    }

    // Stage 1: Prune — remove old tool call/result pairs beyond recent messages.
    const keepRecent = AGENT_LIMITS.COMPACTION_PRUNE_KEEP_RECENT_MESSAGES
    const pruned = pruneMessages({
      messages: current,
      toolCalls: `before-last-${keepRecent}-messages`,
      emptyMessages: 'remove',
    })
    if (pruned.length < current.length) {
      logger.info('Pruned old tool calls', {
        before: current.length,
        after: pruned.length,
        removed: current.length - pruned.length,
      })
      current = pruned
      // Step usage is stale after removing messages — re-estimate from content.
      // Intentionally conservative (×safetyMultiplier + fixedOverhead) so we
      // don't under-count and hit a provider overflow error downstream.
      currentTokens = estimateTokensForThreshold(current, config)
      if (currentTokens <= triggerThreshold) {
        return { messages: current, experimental_context: state }
      }
    }

    // Stage 2: Truncate large tool outputs to 15K chars (keeps partial content).
    const truncated = truncateToolOutputs(current, config.toolOutputMaxChars)
    currentTokens = estimateTokensForThreshold(truncated, config)
    if (currentTokens <= triggerThreshold) {
      return { messages: truncated, experimental_context: state }
    }
    current = truncated

    // Stage 3: Clear old tool outputs — replace with placeholders, skip last 2.
    const cleared = clearToolOutputs(current)
    currentTokens = estimateTokensForThreshold(cleared, config)
    if (currentTokens <= triggerThreshold) {
      return { messages: cleared, experimental_context: state }
    }

    // Stage 3 didn't resolve — fall through to LLM compaction.
    // Pass `current` (truncated, not cleared) so that toKeep retains
    // meaningful tool outputs for the agent's immediate context.
    logger.warn(
      'Context still over limit after pruning, attempting compaction',
      {
        currentTokens,
        triggerThreshold: Math.floor(triggerThreshold),
        messageCount: current.length,
      },
    )

    // Stage 4: LLM-based compaction with sliding window fallback.
    const compacted = await compactMessages(model, current, config, state)
    return { messages: compacted, experimental_context: state }
  }
}
