import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { ComputedConfig } from './types'

export function computeConfig(contextWindow: number): ComputedConfig {
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

  const minSummarizableTokens = Math.max(
    AGENT_LIMITS.COMPACTION_MIN_TOKEN_FLOOR,
    Math.min(baseMinSummarizableTokens, availableToSummarize),
  )

  const maxSummarizationInput = Math.min(
    AGENT_LIMITS.COMPACTION_MAX_SUMMARIZATION_INPUT,
    Math.max(minSummarizableTokens, availableToSummarize),
  )

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
  }
}
