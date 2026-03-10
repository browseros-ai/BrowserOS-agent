import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import { type LanguageModel, type ModelMessage, pruneMessages } from 'ai'
import { logger } from '../../lib/logger'
import { clearToolOutputs } from './clear-tool-outputs'
import { computeConfig } from './config'
import {
  estimateTokens,
  estimateTokensForThreshold,
  getCurrentTokenCount,
} from './estimate-tokens'
import { slidingWindow } from './sliding-window'
import { findSafeSplitPoint } from './split-point'
import { countBinaryParts, stripBinaryContent } from './strip-binary'
import { summarizeMessages, summarizeTurnPrefix } from './summarize'
import type {
  CompactionConfig,
  CompactionState,
  ComputedConfig,
  StepWithUsage,
} from './types'

function isCompactionState(v: unknown): v is CompactionState {
  return (
    typeof v === 'object' &&
    v !== null &&
    'compactionCount' in v &&
    typeof (v as CompactionState).compactionCount === 'number'
  )
}

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

  let toSummarize = historyMessages.length > 0 ? [...historyMessages] : []
  let turnPrefixForSummary =
    turnPrefixMessages.length > 0 ? [...turnPrefixMessages] : []

  // 3. Cap summarization input
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

  if (turnPrefixForSummary.length > 0) {
    const prefixTokens = estimateTokens(turnPrefixForSummary)
    if (prefixTokens > config.maxSummarizationInput) {
      logger.info('Capping turn prefix input, dropping oldest messages', {
        excess: prefixTokens - config.maxSummarizationInput,
        maxSummarizationInput: config.maxSummarizationInput,
      })
      turnPrefixForSummary = slidingWindow(
        turnPrefixForSummary,
        config.maxSummarizationInput,
      )
    }
  }

  // 4. Skip LLM for trivially small inputs
  const totalSummarizable =
    estimateTokens(toSummarize) + estimateTokens(turnPrefixForSummary)
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
    turnPrefixMessages: turnPrefixForSummary.length,
    turnPrefixTokens: estimateTokens(turnPrefixForSummary),
    toKeepMessages: toKeep.length,
    toKeepTokens: estimateTokens(toKeep),
    isSplitTurn,
    hasExistingSummary: state.existingSummary != null,
    compactionCount: state.compactionCount,
  })

  let summary: string | null = null

  if (isSplitTurn && turnPrefixForSummary.length > 0) {
    if (toSummarize.length > 0) {
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
          turnPrefixForSummary,
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
      summary = await summarizeTurnPrefix(
        model,
        turnPrefixForSummary,
        config.summarizationTimeoutMs,
        turnPrefixOutputBudget,
      )
    }
  } else {
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

  const allSummarized = [...toSummarize, ...turnPrefixForSummary]
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

    // Strip binary content — all downstream operates on clean text.
    const stripped = stripBinaryContent(messages)
    const binaryTokens = countBinaryParts(messages) * config.imageTokenEstimate

    // Stage 0: Check threshold — if under, return ORIGINAL (no data loss).
    const lastInputTokens =
      steps.length > 0 ? steps[steps.length - 1].usage?.inputTokens : undefined
    const hasRealUsage = lastInputTokens != null && lastInputTokens > 0
    let currentTokens =
      getCurrentTokenCount(steps, stripped, config) +
      (hasRealUsage ? 0 : binaryTokens)
    if (currentTokens <= triggerThreshold) {
      return { messages, experimental_context: state }
    }

    let current = stripped

    // Stage 1: Prune old tool call/result pairs beyond recent messages.
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
      currentTokens = estimateTokensForThreshold(current, config)
      if (currentTokens <= triggerThreshold) {
        return { messages: current, experimental_context: state }
      }
    }

    // Stage 2: Clear old tool outputs — replace with placeholders, skip last 3.
    const cleared = clearToolOutputs(current, 3)
    currentTokens = estimateTokensForThreshold(cleared, config)
    if (currentTokens <= triggerThreshold) {
      return { messages: cleared, experimental_context: state }
    }

    logger.warn(
      'Context still over limit after pruning, attempting compaction',
      {
        currentTokens,
        triggerThreshold: Math.floor(triggerThreshold),
        messageCount: current.length,
      },
    )

    // Stage 3: LLM-based compaction with sliding window fallback.
    const compacted = await compactMessages(model, current, config, state)
    return { messages: compacted, experimental_context: state }
  }
}
