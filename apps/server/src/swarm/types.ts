/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI Swarm Mode - Type Definitions
 *
 * Core types for multi-agent swarm orchestration.
 */

import { z } from 'zod'

// ============================================================================
// Swarm State Types
// ============================================================================

export type SwarmState =
  | 'planning'
  | 'spawning'
  | 'executing'
  | 'aggregating'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type WorkerState =
  | 'pending'
  | 'spawning'
  | 'running'
  | 'completed'
  | 'failed'
  | 'terminated'

// ============================================================================
// Swarm Configuration
// ============================================================================

export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  exponentialFactor: number
}

export interface ResourceLimits {
  memoryMb: number
  cpuPriority: 'low' | 'normal' | 'high'
}

export interface SwarmConfig {
  maxWorkers: number
  workerTimeoutMs: number
  swarmTimeoutMs: number
  retryPolicy: RetryPolicy
  resourceLimits: ResourceLimits
}

// ============================================================================
// Swarm Request/Response
// ============================================================================

export interface SwarmRequest {
  /** Natural language task description */
  task: string
  /** Maximum number of workers (default: auto-detect) */
  maxWorkers?: number
  /** Overall swarm timeout in ms */
  timeoutMs?: number
  /** Output format for final result */
  outputFormat?: 'json' | 'markdown' | 'html'
  /** Conversation ID to inherit context from */
  conversationId?: string
}

export interface SwarmResult {
  swarmId: string
  /** Whether result is partial due to some worker failures */
  partial: boolean
  /** Warnings from failed workers */
  warnings: string[]
  /** Final aggregated result */
  result: unknown
  /** Execution metrics */
  metrics: SwarmMetrics
}

export interface SwarmMetrics {
  totalDurationMs: number
  workerCount: number
  successfulWorkers: number
  failedWorkers: number
  totalActionsPerformed: number
}

// ============================================================================
// Swarm Status
// ============================================================================

export interface Swarm {
  id: string
  task: string
  state: SwarmState
  config: SwarmConfig
  workers: Map<string, Worker>
  createdAt: number
  startedAt?: number
  completedAt?: number
  result?: SwarmResult
  error?: string
}

export interface SwarmStatus {
  swarmId: string
  state: SwarmState
  progress: number
  startedAt: number
  completedAt?: number
  workers: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
  }
  error?: string
}

// ============================================================================
// Worker Types
// ============================================================================

export interface WorkerTask {
  id: string
  instruction: string
  startUrl?: string
  timeoutMs?: number
  /** Task IDs this task depends on */
  dependencies?: string[]
  /** Expected output schema (Zod schema as JSON) */
  outputSchema?: unknown
}

export interface Worker {
  id: string
  swarmId: string
  windowId?: number
  task: WorkerTask
  state: WorkerState
  progress: number
  currentAction?: string
  result?: unknown
  error?: string
  metrics?: WorkerMetrics
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
}

export interface WorkerMetrics {
  durationMs: number
  actionsPerformed: number
  pagesVisited: number
}

// ============================================================================
// Message Protocol
// ============================================================================

export type SwarmMessageType =
  | 'task_assign'
  | 'task_progress'
  | 'task_complete'
  | 'task_failed'
  | 'heartbeat'
  | 'terminate'
  | 'coordination'

export interface SwarmMessage {
  id: string
  timestamp: number
  swarmId: string
  senderId: string
  targetId: string
  type: SwarmMessageType
  payload: unknown
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const SwarmRequestSchema = z.object({
  task: z.string().min(1, 'Task description is required'),
  maxWorkers: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().positive().optional(),
  outputFormat: z.enum(['json', 'markdown', 'html']).optional(),
  conversationId: z.string().optional(),
})

export const WorkerTaskSchema = z.object({
  id: z.string(),
  instruction: z.string(),
  startUrl: z.string().url().optional(),
  timeoutMs: z.number().positive().optional(),
  dependencies: z.array(z.string()).optional(),
  outputSchema: z.unknown().optional(),
})

export const SwarmMessageSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  swarmId: z.string(),
  senderId: z.string(),
  targetId: z.string(),
  type: z.enum([
    'task_assign',
    'task_progress',
    'task_complete',
    'task_failed',
    'heartbeat',
    'terminate',
    'coordination',
  ]),
  payload: z.unknown(),
})

export const TaskProgressPayloadSchema = z.object({
  taskId: z.string(),
  stage: z.string(),
  progress: z.number().min(0).max(100),
  currentAction: z.string().optional(),
})

export const TaskCompletePayloadSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  result: z.unknown(),
  metrics: z.object({
    durationMs: z.number(),
    actionsPerformed: z.number(),
    pagesVisited: z.number(),
  }),
})
