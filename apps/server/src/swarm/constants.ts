/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI Swarm Mode - Constants
 *
 * Resource limits, timeouts, and default configurations.
 */

import type { RetryPolicy, ResourceLimits, SwarmConfig } from './types'

// ============================================================================
// Resource Limits
// ============================================================================

export const SWARM_LIMITS = {
  /** Maximum workers per swarm */
  MAX_WORKERS: 10,
  /** Default worker count when auto-detecting */
  DEFAULT_WORKERS: 5,
  /** Minimum workers */
  MIN_WORKERS: 1,
  /** Maximum retries per worker before giving up */
  MAX_RETRIES_PER_WORKER: 3,
  /** Memory limit per worker in MB */
  WORKER_MEMORY_MB: 512,
  /** Maximum concurrent swarms per session */
  MAX_CONCURRENT_SWARMS: 3,
} as const

// ============================================================================
// Timeouts
// ============================================================================

export const SWARM_TIMEOUTS = {
  /** Time to spawn a worker window (ms) */
  WORKER_SPAWN_MS: 10_000,
  /** Heartbeat interval (ms) */
  HEARTBEAT_INTERVAL_MS: 5_000,
  /** Heartbeat timeout - worker considered dead if no heartbeat (ms) */
  HEARTBEAT_TIMEOUT_MS: 15_000,
  /** Default per-task timeout (ms) - 5 minutes */
  TASK_DEFAULT_MS: 300_000,
  /** Default swarm timeout (ms) - 10 minutes */
  SWARM_DEFAULT_MS: 600_000,
  /** Time without progress before considering worker stuck (ms) */
  PROGRESS_STALE_MS: 60_000,
  /** Window ownership polling timeout (ms) */
  WINDOW_OWNERSHIP_TIMEOUT_MS: 500,
  /** Window ownership polling interval (ms) */
  WINDOW_OWNERSHIP_POLL_MS: 50,
} as const

// ============================================================================
// Default Retry Policy
// ============================================================================

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
  exponentialFactor: 2,
}

// ============================================================================
// Default Resource Limits
// ============================================================================

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  memoryMb: SWARM_LIMITS.WORKER_MEMORY_MB,
  cpuPriority: 'low',
}

// ============================================================================
// Default Swarm Configuration
// ============================================================================

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  maxWorkers: SWARM_LIMITS.DEFAULT_WORKERS,
  workerTimeoutMs: SWARM_TIMEOUTS.TASK_DEFAULT_MS,
  swarmTimeoutMs: SWARM_TIMEOUTS.SWARM_DEFAULT_MS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  resourceLimits: DEFAULT_RESOURCE_LIMITS,
}

// ============================================================================
// Message Types
// ============================================================================

export const SWARM_MESSAGE_TYPES = {
  TASK_ASSIGN: 'task_assign',
  TASK_PROGRESS: 'task_progress',
  TASK_COMPLETE: 'task_complete',
  TASK_FAILED: 'task_failed',
  HEARTBEAT: 'heartbeat',
  TERMINATE: 'terminate',
  COORDINATION: 'coordination',
} as const

// ============================================================================
// Special IDs
// ============================================================================

export const SWARM_IDS = {
  /** Master agent sender ID */
  MASTER: 'master',
  /** Broadcast target ID */
  BROADCAST: 'broadcast',
} as const
