/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized limits and thresholds.
 */

export const RATE_LIMITS = {
  DEFAULT_DAILY: 5,
  DEV_DAILY: 100,
  TEST_DAILY: Infinity,
} as const

export const AGENT_LIMITS = {
  MAX_TURNS: 100,
  DEFAULT_CONTEXT_WINDOW: 200_000,

  // Compression settings for context compaction heuristics
  COMPRESSION_MIN_HEADROOM: 10_000,
  COMPRESSION_MAX_RATIO: 0.75,
  COMPRESSION_MIN_RATIO: 0.4,

  // Compaction — adaptive trigger
  COMPACTION_RESERVE_TOKENS: 20_000,

  // Compaction — adaptive keep-recent
  COMPACTION_MAX_KEEP_RECENT: 20_000,
  COMPACTION_KEEP_RECENT_FRACTION: 0.35,
  COMPACTION_SMALL_CONTEXT_WINDOW: 16_000,
  COMPACTION_MIN_SUMMARIZABLE_INPUT: 4_000,
  COMPACTION_MIN_SUMMARIZABLE_INPUT_SMALL: 1_000,

  // Compaction — summarization
  COMPACTION_MIN_TOKEN_FLOOR: 256,
  COMPACTION_TURN_PREFIX_OUTPUT_RATIO: 0.5,
  COMPACTION_MAX_SUMMARIZATION_INPUT: 100_000,
  COMPACTION_SUMMARIZATION_TIMEOUT_MS: 60_000,
  COMPACTION_SUMMARIZER_OUTPUT_RATIO: 0.8,

  // Compaction — estimation (step 0 / no real usage)
  // Covers system prompt (~2.5K tokens) + tool definitions as JSON Schema (~8-9K tokens)
  COMPACTION_FIXED_OVERHEAD: 12_000,
  COMPACTION_SAFETY_MULTIPLIER: 1.3,
  COMPACTION_IMAGE_TOKEN_ESTIMATE: 1_000,

  // Compaction — pruning (before LLM summarization)
  COMPACTION_PRUNE_KEEP_RECENT_MESSAGES: 6,
  COMPACTION_CLEAR_OUTPUT_MIN_CHARS: 100,

  // Compaction — transcript serialization
  COMPACTION_TRANSCRIPT_TOOL_OUTPUT_MAX_CHARS: 2_000,
} as const

export const TOOL_LIMITS = {
  INLINE_PAGE_CONTENT_MAX_CHARS: 5_000,
  FILESYSTEM_READ_MAX_LINES: 500,
  FILESYSTEM_READ_MAX_CHARS: 15_000,
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
} as const

export const CDP_LIMITS = {
  CONNECT_MAX_RETRIES: 3,
  RECONNECT_MAX_RETRIES: 3,
} as const

export const CONTENT_LIMITS = {
  BODY_CONTEXT_SIZE: 10_000,
  MAX_QUEUE_SIZE: 1_000,
  CONSOLE_META_CHAR: 1_000,
} as const
