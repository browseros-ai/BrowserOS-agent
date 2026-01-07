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
  DEFAULT_CONTEXT_WINDOW: 1_000_000,
  // Compression settings - hybrid approach with minimum headroom
  COMPRESSION_MIN_HEADROOM: 10_000, // Always leave at least 10K tokens for tool responses
  COMPRESSION_MAX_RATIO: 0.75, // Never wait longer than 75% for large models
  COMPRESSION_MIN_RATIO: 0.4, // Never compress too early (before 40%)
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
} as const

export const CONTENT_LIMITS = {
  BODY_CONTEXT_SIZE: 10_000,
  MAX_QUEUE_SIZE: 1_000,
  CONSOLE_META_CHAR: 100,
} as const
